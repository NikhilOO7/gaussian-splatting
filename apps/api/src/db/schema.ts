import { pgTable, uuid, text, timestamp, boolean, integer, decimal, jsonb, date, pgEnum, primaryKey, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const nodeTypeEnum = pgEnum('node_type', ['paper', 'method', 'concept', 'dataset', 'metric']);

export const edgeTypeEnum = pgEnum('edge_type', [
  'extends',
  'improves',
  'uses',
  'introduces',
  'cites',
  'evaluates_on',
  'compares_to',
  'authored_by'
]);

export const papers = pgTable('papers', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  abstract: text('abstract'),
  arxivId: text('arxiv_id').unique(),
  doi: text('doi'),
  pdfUrl: text('pdf_url'),
  publicationDate: date('publication_date'),
  venue: text('venue'),
  rawText: text('raw_text'),
  processed: boolean('processed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  arxivIdIdx: index('papers_arxiv_id_idx').on(table.arxivId),
  processedIdx: index('papers_processed_idx').on(table.processed),
}));

export const authors = pgTable('authors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name'),
  orcid: text('orcid'),
  affiliations: jsonb('affiliations'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const paperAuthors = pgTable('paper_authors', {
  paperId: uuid('paper_id').notNull().references(() => papers.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  position: integer('position'),
  isCorresponding: boolean('is_corresponding').default(false),
}, (table) => ({
  pk: primaryKey({ columns: [table.paperId, table.authorId] }),
}));

export const nodes = pgTable('nodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: nodeTypeEnum('type').notNull(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name'),
  description: text('description'),
  properties: jsonb('properties'),
  paperId: uuid('paper_id').references(() => papers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('nodes_type_idx').on(table.type),
  normalizedNameIdx: index('nodes_normalized_name_idx').on(table.normalizedName),
  paperIdIdx: index('nodes_paper_id_idx').on(table.paperId),
}));

export const edges = pgTable('edges', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  type: edgeTypeEnum('type').notNull(),
  properties: jsonb('properties'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdIdx: index('edges_source_id_idx').on(table.sourceId),
  targetIdIdx: index('edges_target_id_idx').on(table.targetId),
  typeIdx: index('edges_type_idx').on(table.type),
  sourceTypeIdx: index('edges_source_type_idx').on(table.sourceId, table.type),
  targetTypeIdx: index('edges_target_type_idx').on(table.targetId, table.type),
}));

export const sources = pgTable('sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  edgeId: uuid('edge_id').notNull().references(() => edges.id, { onDelete: 'cascade' }),
  paperId: uuid('paper_id').notNull().references(() => papers.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number'),
  section: text('section'),
  extractedText: text('extracted_text'),
  spanStart: integer('span_start'),
  spanEnd: integer('span_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  edgeIdIdx: index('sources_edge_id_idx').on(table.edgeId),
  paperIdIdx: index('sources_paper_id_idx').on(table.paperId),
}));

export const papersRelations = relations(papers, ({ many }) => ({
  authors: many(paperAuthors),
  nodes: many(nodes),
  sources: many(sources),
}));

export const authorsRelations = relations(authors, ({ many }) => ({
  papers: many(paperAuthors),
}));

export const paperAuthorsRelations = relations(paperAuthors, ({ one }) => ({
  paper: one(papers, {
    fields: [paperAuthors.paperId],
    references: [papers.id],
  }),
  author: one(authors, {
    fields: [paperAuthors.authorId],
    references: [authors.id],
  }),
}));

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  paper: one(papers, {
    fields: [nodes.paperId],
    references: [papers.id],
  }),
  outgoingEdges: many(edges, { relationName: 'source' }),
  incomingEdges: many(edges, { relationName: 'target' }),
}));

export const edgesRelations = relations(edges, ({ one, many }) => ({
  source: one(nodes, {
    fields: [edges.sourceId],
    references: [nodes.id],
    relationName: 'source',
  }),
  target: one(nodes, {
    fields: [edges.targetId],
    references: [nodes.id],
    relationName: 'target',
  }),
  sources: many(sources),
}));

export const sourcesRelations = relations(sources, ({ one }) => ({
  edge: one(edges, {
    fields: [sources.edgeId],
    references: [edges.id],
  }),
  paper: one(papers, {
    fields: [sources.paperId],
    references: [papers.id],
  }),
}));
