import { Hono } from 'hono';
import { db } from '../db';
import { nodes, edges } from '../db/schema';
import { eq, sql, ilike, and } from 'drizzle-orm';

export const graphRouter = new Hono();

graphRouter.get('/nodes', async (c) => {
  try {
    const type = c.req.query('type');
    const search = c.req.query('search');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = db.select().from(nodes);

    if (type) {
      query = query.where(eq(nodes.type, type as any));
    }

    if (search) {
      query = query.where(ilike(nodes.name, `%${search}%`));
    }

    const results = await query.limit(limit).offset(offset);

    return c.json({
      nodes: results,
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return c.json({ error: 'Failed to fetch nodes' }, 500);
  }
});

graphRouter.get('/nodes/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const node = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, id))
      .limit(1);

    if (!node.length) {
      return c.json({ error: 'Node not found' }, 404);
    }

    const outgoing = await db
      .select()
      .from(edges)
      .where(eq(edges.sourceId, id));

    const incoming = await db
      .select()
      .from(edges)
      .where(eq(edges.targetId, id));

    return c.json({
      node: node[0],
      outgoingEdges: outgoing,
      incomingEdges: incoming,
    });
  } catch (error) {
    console.error('Error fetching node:', error);
    return c.json({ error: 'Failed to fetch node' }, 500);
  }
});

graphRouter.get('/edges', async (c) => {
  try {
    const type = c.req.query('type');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = db.select().from(edges);

    if (type) {
      query = query.where(eq(edges.type, type as any));
    }

    const results = await query.limit(limit).offset(offset);

    return c.json({
      edges: results,
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error fetching edges:', error);
    return c.json({ error: 'Failed to fetch edges' }, 500);
  }
});

graphRouter.get('/subgraph', async (c) => {
  try {
    const nodeId = c.req.query('nodeId');
    const depth = parseInt(c.req.query('depth') || '1');

    if (!nodeId) {
      return c.json({ error: 'nodeId is required' }, 400);
    }

    const centerNode = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);

    if (!centerNode.length) {
      return c.json({ error: 'Node not found' }, 404);
    }

    const subgraphEdges = await db
      .select()
      .from(edges)
      .where(
        sql`${edges.sourceId} = ${nodeId} OR ${edges.targetId} = ${nodeId}`
      );

    const nodeIds = new Set<string>([nodeId]);
    subgraphEdges.forEach(edge => {
      nodeIds.add(edge.sourceId);
      nodeIds.add(edge.targetId);
    });

    const subgraphNodes = await db
      .select()
      .from(nodes)
      .where(sql`${nodes.id} = ANY(${Array.from(nodeIds)})`);

    return c.json({
      nodes: subgraphNodes,
      edges: subgraphEdges,
    });
  } catch (error) {
    console.error('Error fetching subgraph:', error);
    return c.json({ error: 'Failed to fetch subgraph' }, 500);
  }
});

graphRouter.get('/stats', async (c) => {
  try {
    const nodeStats = await db
      .select({
        type: nodes.type,
        count: sql<number>`count(*)::int`,
      })
      .from(nodes)
      .groupBy(nodes.type);

    const edgeStats = await db
      .select({
        type: edges.type,
        count: sql<number>`count(*)::int`,
      })
      .from(edges)
      .groupBy(edges.type);

    const totalNodes = nodeStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalEdges = edgeStats.reduce((sum, stat) => sum + stat.count, 0);

    return c.json({
      nodes: {
        total: totalNodes,
        byType: nodeStats,
      },
      edges: {
        total: totalEdges,
        byType: edgeStats,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});
