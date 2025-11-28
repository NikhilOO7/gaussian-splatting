import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { papersRouter } from './routes/papers';
import { graphRouter } from './routes/graph';
import { ingestRouter } from './routes/ingest';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
  credentials: true,
}));

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.route('/api/papers', papersRouter);
app.route('/api/graph', graphRouter);
app.route('/api/ingest', ingestRouter);

const port = parseInt(process.env.PORT || '3000');

console.log(`Server starting on http://localhost:${port}`);

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = `http://${req.headers.host}${req.url}`;
  const method = req.method || 'GET';

  let body: ArrayBuffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks).buffer;
  }

  const request = new Request(url, {
    method,
    headers: req.headers as Record<string, string>,
    body: body ? body : undefined,
  });

  const response = await app.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const responseBody = await response.text();
  res.end(responseBody);
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
