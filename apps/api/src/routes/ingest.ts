import { Hono } from 'hono';
import { db } from '../db';
import { papers } from '../db/schema';

export const ingestRouter = new Hono();

const jobStatus = new Map<string, { status: string; paperId?: string; error?: string }>();

ingestRouter.post('/arxiv', async (c) => {
  try {
    const body = await c.req.json();
    const { arxivId } = body;

    if (!arxivId) {
      return c.json({ error: 'arxivId is required' }, 400);
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    jobStatus.set(jobId, { status: 'processing' });

    setImmediate(async () => {
      try {
        const arxivUrl = `https://arxiv.org/abs/${arxivId}`;
        const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

        const [paper] = await db
          .insert(papers)
          .values({
            title: `Paper from arXiv:${arxivId}`,
            arxivId,
            pdfUrl,
          })
          .returning();

        jobStatus.set(jobId, { status: 'completed', paperId: paper.id });
      } catch (error) {
        console.error('Error ingesting paper:', error);
        jobStatus.set(jobId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    return c.json({ jobId, status: 'queued' }, 202);
  } catch (error) {
    console.error('Error creating ingestion job:', error);
    return c.json({ error: 'Failed to create ingestion job' }, 500);
  }
});

ingestRouter.get('/status/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const status = jobStatus.get(jobId);

    if (!status) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json(status);
  } catch (error) {
    console.error('Error fetching job status:', error);
    return c.json({ error: 'Failed to fetch job status' }, 500);
  }
});
