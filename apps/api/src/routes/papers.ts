import { Hono } from 'hono';
import { db } from '../db';
import { papers } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export const papersRouter = new Hono();

papersRouter.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const allPapers = await db
      .select()
      .from(papers)
      .orderBy(desc(papers.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      papers: allPapers,
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error fetching papers:', error);
    return c.json({ error: 'Failed to fetch papers' }, 500);
  }
});

papersRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const paper = await db
      .select()
      .from(papers)
      .where(eq(papers.id, id))
      .limit(1);

    if (!paper.length) {
      return c.json({ error: 'Paper not found' }, 404);
    }

    return c.json(paper[0]);
  } catch (error) {
    console.error('Error fetching paper:', error);
    return c.json({ error: 'Failed to fetch paper' }, 500);
  }
});

papersRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { title, abstract, arxivId, doi, pdfUrl, publicationDate, venue } = body;

    if (!title) {
      return c.json({ error: 'Title is required' }, 400);
    }

    const [newPaper] = await db
      .insert(papers)
      .values({
        title,
        abstract,
        arxivId,
        doi,
        pdfUrl,
        publicationDate,
        venue,
      })
      .returning();

    return c.json(newPaper, 201);
  } catch (error) {
    console.error('Error creating paper:', error);
    return c.json({ error: 'Failed to create paper' }, 500);
  }
});

papersRouter.post('/:id/process', async (c) => {
  try {
    const id = c.req.param('id');

    const paper = await db
      .select()
      .from(papers)
      .where(eq(papers.id, id))
      .limit(1);

    if (!paper.length) {
      return c.json({ error: 'Paper not found' }, 404);
    }

    return c.json({
      message: 'Processing started',
      paperId: id,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error processing paper:', error);
    return c.json({ error: 'Failed to start processing' }, 500);
  }
});
