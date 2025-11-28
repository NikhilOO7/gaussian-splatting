import { db } from '../db';
import { papers, nodes, edges, sources } from '../db/schema';
import { eq } from 'drizzle-orm';
import { extractEntitiesAndRelationships } from '../agents/extractor';
import { resolveEntities } from '../agents/resolver';
import { validateRelationships } from '../agents/validator';
import { chunkText } from '../services/pdf';

export async function processPaper(paperId: string): Promise<void> {
  try {
    const [paper] = await db
      .select()
      .from(papers)
      .where(eq(papers.id, paperId))
      .limit(1);

    if (!paper) {
      throw new Error(`Paper not found: ${paperId}`);
    }

    if (!paper.rawText) {
      throw new Error(`Paper has no raw text: ${paperId}`);
    }

    console.log(`Processing paper: ${paper.title}`);

    const chunks = chunkText(paper.rawText, 2000, 200);
    console.log(`Split into ${chunks.length} chunks`);

    const existingNodes = await db.select().from(nodes).limit(1000);

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);

      const extractorOutput = await extractEntitiesAndRelationships({
        paperId,
        chunkIndex: i,
        text: chunks[i],
        section: i === 0 ? 'abstract' : 'body',
      });

      console.log(`Extracted ${extractorOutput.entities.length} entities, ${extractorOutput.relationships.length} relationships`);

      const resolverOutput = await resolveEntities(extractorOutput, existingNodes);

      console.log(`Resolved ${resolverOutput.resolvedEntities.length} entities, ${resolverOutput.resolvedRelationships.length} relationships`);

      const graphContext = {
        nodes: existingNodes.slice(0, 50),
        edges: [],
      };

      const validationOutput = await validateRelationships(resolverOutput, graphContext);

      console.log(`Validated: ${validationOutput.accepted.length} accepted, ${validationOutput.rejected.length} rejected`);

      for (const entity of resolverOutput.resolvedEntities) {
        if (entity.isNew) {
          const [newNode] = await db
            .insert(nodes)
            .values({
              type: entity.type === 'paper_reference' ? 'paper' : entity.type,
              name: entity.canonicalName,
              normalizedName: entity.canonicalName.toLowerCase(),
              paperId: paperId,
            })
            .returning();

          entity.canonicalId = newNode.id;
          existingNodes.push(newNode);
        }
      }

      for (const relationship of validationOutput.accepted) {
        const [edge] = await db
          .insert(edges)
          .values({
            sourceId: relationship.sourceId,
            targetId: relationship.targetId,
            type: relationship.type as any,
            confidence: relationship.confidence.toString(),
          })
          .returning();

        await db.insert(sources).values({
          edgeId: edge.id,
          paperId: paperId,
          section: i === 0 ? 'abstract' : 'body',
          extractedText: relationship.evidence,
        });
      }
    }

    await db
      .update(papers)
      .set({ processed: true, updatedAt: new Date() })
      .where(eq(papers.id, paperId));

    console.log(`Finished processing paper: ${paper.title}`);
  } catch (error) {
    console.error(`Error processing paper ${paperId}:`, error);
    throw error;
  }
}
