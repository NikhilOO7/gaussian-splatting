import { db } from '../db';
import { papers, nodes, edges, sources } from '../db/schema';
import { eq, ilike } from 'drizzle-orm';
import { extractEntitiesAndRelationships } from '../agents/extractor';
import { resolveEntities } from '../agents/resolver';
import { validateRelationships } from '../agents/validator';
import { chunkText, detectSection } from '../services/pdf';

interface ProcessingStats {
  chunksProcessed: number;
  entitiesExtracted: number;
  entitiesCreated: number;
  relationshipsCreated: number;
  relationshipsRejected: number;
}

export async function processPaper(paperId: string): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    chunksProcessed: 0,
    entitiesExtracted: 0,
    entitiesCreated: 0,
    relationshipsCreated: 0,
    relationshipsRejected: 0,
  };

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

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing paper: ${paper.title}`);
    console.log(`${'='.repeat(60)}\n`);

    const paperNode = await getOrCreatePaperNode(paper);

    const chunks = chunkText(paper.rawText, 2000, 200);
    console.log(`Split into ${chunks.length} chunks`);

    // Update status to extracting_entities
    await db
      .update(papers)
      .set({
        processingStatus: 'extracting_entities',
        processingProgress: 0
      })
      .where(eq(papers.id, paperId));

    const entityMap = new Map<string, string>();

    for (let i = 0; i < chunks.length; i++) {
      console.log(`\n--- Processing chunk ${i + 1}/${chunks.length} ---`);

      // Update progress after each chunk
      const progress = Math.floor((i / chunks.length) * 100);
      await db
        .update(papers)
        .set({ processingProgress: progress })
        .where(eq(papers.id, paperId));
      
      const section = detectSection(chunks[i], i, chunks.length);
      console.log(`Detected section: ${section}`);

      try {
        const extractorOutput = await extractEntitiesAndRelationships({
          paperId,
          chunkIndex: i,
          text: chunks[i],
          section,
        });

        stats.entitiesExtracted += extractorOutput.entities.length;
        console.log(`Extracted ${extractorOutput.entities.length} entities, ${extractorOutput.relationships.length} relationships`);

        if (extractorOutput.entities.length === 0 && extractorOutput.relationships.length === 0) {
          console.log('No extractions from this chunk, skipping...');
          stats.chunksProcessed++;
          continue;
        }

        const existingNodes = await db
          .select()
          .from(nodes)
          .limit(500);

        const resolverOutput = await resolveEntities(extractorOutput, existingNodes);
        console.log(`Resolved ${resolverOutput.resolvedEntities.length} entities`);
        if (resolverOutput.resolvedRelationships.length > 0) {
          console.log(`Resolved ${resolverOutput.resolvedRelationships.length} relationships:`);
          resolverOutput.resolvedRelationships.forEach(rel => {
            console.log(`  ${rel.sourceName} --[${rel.type}]--> ${rel.targetName}`);
          });
        }

        for (const entity of resolverOutput.resolvedEntities) {
          if (entity.isNew && !entityMap.has(entity.canonicalName.toLowerCase())) {
            const existingByName = await db
              .select()
              .from(nodes)
              .where(ilike(nodes.normalizedName, entity.canonicalName.toLowerCase()))
              .limit(1);

            if (existingByName.length > 0) {
              entityMap.set(entity.canonicalName.toLowerCase(), existingByName[0].id);
              entity.canonicalId = existingByName[0].id;
              entity.isNew = false;
            } else {
              const nodeType = entity.type === 'paper_reference' ? 'paper' : entity.type;
              
              const [newNode] = await db
                .insert(nodes)
                .values({
                  type: nodeType as any,
                  name: entity.canonicalName,
                  normalizedName: entity.canonicalName.toLowerCase(),
                  paperId: nodeType === 'paper' ? null : paperId,
                })
                .returning();

              entityMap.set(entity.canonicalName.toLowerCase(), newNode.id);
              entity.canonicalId = newNode.id;
              stats.entitiesCreated++;
              console.log(`Created new ${nodeType}: ${entity.canonicalName}`);
            }
          } else if (entity.canonicalId) {
            entityMap.set(entity.canonicalName.toLowerCase(), entity.canonicalId);
          }
        }

        const graphContext = {
          nodes: existingNodes.slice(0, 50),
          paperDate: paper.publicationDate,
        };

        const validationOutput = await validateRelationships(resolverOutput, graphContext);
        console.log(`Validated: ${validationOutput.accepted.length} accepted, ${validationOutput.rejected.length} rejected`);

        stats.relationshipsRejected += validationOutput.rejected.length;

        for (const relationship of validationOutput.accepted) {
          try {
            // Relationships have canonical entity NAMES, not UUIDs
            // Look them up in entityMap which maps canonicalName.toLowerCase() -> UUID
            const sourceId = entityMap.get(relationship.sourceName?.toLowerCase()) ||
                            findEntityId(entityMap, relationship.sourceName);
            const targetId = entityMap.get(relationship.targetName?.toLowerCase()) ||
                            findEntityId(entityMap, relationship.targetName);

            if (!sourceId || !targetId) {
              console.warn(`Could not find node IDs for relationship:`);
              console.warn(`  Source: "${relationship.sourceName}" -> ${sourceId || 'NOT FOUND'}`);
              console.warn(`  Target: "${relationship.targetName}" -> ${targetId || 'NOT FOUND'}`);
              console.warn(`  Available entities in map: ${Array.from(entityMap.keys()).join(', ')}`);
              continue;
            }

            if (!isValidEdgeType(relationship.type)) {
              console.warn(`Invalid edge type: ${relationship.type}, defaulting to 'uses'`);
              relationship.type = 'uses';
            }

            const [edge] = await db
              .insert(edges)
              .values({
                sourceId,
                targetId,
                type: relationship.type as any,
                confidence: String(relationship.confidence || 0.5),
              })
              .returning();

            await db.insert(sources).values({
              edgeId: edge.id,
              paperId: paperId,
              section: section,
              extractedText: relationship.evidence?.slice(0, 1000),
            });

            stats.relationshipsCreated++;
          } catch (relError) {
            console.error(`Error creating relationship:`, relError);
          }
        }

        stats.chunksProcessed++;
      } catch (chunkError) {
        console.error(`Error processing chunk ${i}:`, chunkError);
        stats.chunksProcessed++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await db
      .update(papers)
      .set({
        processed: true,
        processingStatus: 'completed',
        processingProgress: 100,
        updatedAt: new Date()
      })
      .where(eq(papers.id, paperId));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Finished processing paper: ${paper.title}`);
    console.log(`Stats: ${JSON.stringify(stats, null, 2)}`);
    console.log(`${'='.repeat(60)}\n`);

    return stats;
  } catch (error) {
    console.error(`Error processing paper ${paperId}:`, error);
    throw error;
  }
}

async function getOrCreatePaperNode(paper: any): Promise<string> {
  const existing = await db
    .select()
    .from(nodes)
    .where(eq(nodes.paperId, paper.id))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [paperNode] = await db
    .insert(nodes)
    .values({
      type: 'paper',
      name: paper.title,
      normalizedName: paper.title.toLowerCase(),
      paperId: paper.id,
      description: paper.abstract?.slice(0, 500),
    })
    .returning();

  return paperNode.id;
}

function findEntityId(entityMap: Map<string, string>, name: string): string | null {
  if (!name) return null;
  
  const normalized = name.toLowerCase();
  
  if (entityMap.has(normalized)) {
    return entityMap.get(normalized)!;
  }

  for (const [key, value] of entityMap.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return value;
    }
  }

  return null;
}

function isValidEdgeType(type: string): boolean {
  const validTypes = ['extends', 'improves', 'uses', 'introduces', 'cites', 'evaluates_on', 'compares_to', 'authored_by'];
  return validTypes.includes(type);
}

export async function reprocessPaper(paperId: string): Promise<ProcessingStats> {
  await db.delete(edges).where(
    eq(edges.sourceId, paperId)
  );

  const paperNodes = await db
    .select()
    .from(nodes)
    .where(eq(nodes.paperId, paperId));

  for (const node of paperNodes) {
    await db.delete(edges).where(eq(edges.sourceId, node.id));
    await db.delete(edges).where(eq(edges.targetId, node.id));
  }

  await db.delete(nodes).where(eq(nodes.paperId, paperId));

  await db
    .update(papers)
    .set({ processed: false })
    .where(eq(papers.id, paperId));

  return processPaper(paperId);
}