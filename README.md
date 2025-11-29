# Gaussian Splatting Knowledge Graph

A full-stack knowledge graph application that extracts structured relationships from academic papers on 3D Gaussian Splatting using AI agents. The system automatically reads papers, identifies entities (methods, concepts, datasets, metrics), and discovers semantic relationships between them to build a queryable knowledge graph.

## Architecture Overview

```
┌─────────────┐
│   arXiv     │
│   Papers    │
└──────┬──────┘
       │
       ↓
┌─────────────────┐
│  PDF Extraction │
│   (pdf-parse)   │
└──────┬──────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│              AI Agent Pipeline                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐           │
│  │Extractor │→ │ Resolver │→ │  Validator   │           │
│  │  Agent   │  │  Agent   │  │    Agent     │           │
│  └──────────┘  └──────────┘  └──────────────┘           │
│                  (Ollama LLM)                           │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────┐
│  Knowledge Graph │
│   (PostgreSQL)   │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│   REST API       │
│   (Hono)         │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│   React UI       │
│ (Dashboard +     │
│  Explorer +      │
│  Ingestion)      │
└──────────────────┘
```

## Tech Stack

### Backend
- **Hono**: Lightweight web framework for the API server
- **Drizzle ORM**: Type-safe database queries with PostgreSQL
- **Vercel AI SDK + Ollama**: Local LLM inference for agent processing
- **pdf-parse**: Extract text content from PDF files

### Frontend
- **React 18**: UI components with TypeScript
- **Vite**: Fast build tooling
- **TailwindCSS**: Utility-first styling
- **React Router**: Client-side routing
- **React Query**: Server state management
- **React Flow**: Interactive graph visualization

### Infrastructure
- **pnpm workspaces**: Monorepo management
- **PostgreSQL**: Relational database for graph storage
- **Docker Compose**: PostgreSQL containerization
- **Ollama**: Local LLM runtime

### Design Choices

**Why PostgreSQL over a graph database?**
- PostgreSQL provides strong ACID guarantees and mature tooling
- Graph queries can be efficiently handled with proper indexing on source/target IDs
- Drizzle ORM provides excellent TypeScript integration
- Easier deployment and operational simplicity
- JSON columns allow flexible property storage while maintaining relational integrity

**Why three separate agents vs one?**
- Separation of concerns: extraction, resolution, and validation are distinct tasks
- Easier debugging and iteration on each stage
- Better confidence scoring by combining multiple agent outputs
- Enables parallel processing of extraction chunks while maintaining global entity resolution

**Why local LLM (Ollama) vs API?**
- No API costs for processing large numbers of papers
- Data privacy for potentially proprietary research
- Deterministic environment for reproducible results
- Lower latency for batch processing

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose
- Ollama with llama3.1:8b model

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gsplat-kg
```

2. Install dependencies:
```bash
pnpm install
```

3. Install and start Ollama:
```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull llama3.1:8b

# Start Ollama server
ollama serve
```

4. Start PostgreSQL:
```bash
docker-compose up -d
```

5. Set up the database:
```bash
pnpm db:push
```

## Environment Variables

The required environment files are already created:

**apps/api/.env**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_graph
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

**apps/web/.env**
```
VITE_API_URL=http://localhost:3000
```

## Running the Application

Start both backend and frontend:
```bash
pnpm dev
```

Or run them separately:

```bash
# Backend only
pnpm --filter api dev

# Frontend only
pnpm --filter web dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Database: postgresql://localhost:5432

## System Design

### Database Schema

The database uses a hybrid approach: relational tables for core entities with JSON columns for flexible metadata.

**Core Tables:**
- `papers`: Academic papers with metadata
- `authors`: Author information with normalized names
- `paper_authors`: Many-to-many relationship between papers and authors
- `nodes`: Graph entities (papers, methods, concepts, datasets, metrics)
- `edges`: Directed relationships between nodes with confidence scores
- `sources`: Provenance tracking linking edges to source papers and text spans

**Key Design Decisions:**
- UUID primary keys for distributed-friendly identifiers
- Normalized names for fuzzy matching and deduplication
- JSONB columns for flexible properties without schema changes
- Confidence scores (0-1) on edges for relationship strength
- Composite indexes on (source_id, type) and (target_id, type) for efficient graph traversal

### Agent Pipeline

The processing pipeline consists of three specialized agents:

**1. Extractor Agent**
- Reads paper text chunks (2000 chars with 200 char overlap)
- Identifies entity mentions with text span positions
- Detects relationship patterns using predefined verbs
- Prioritizes recall over precision
- Outputs raw entities and relationships with confidence scores

**2. Resolver Agent**
- Maps entity mentions to canonical entities
- Performs fuzzy matching against existing graph nodes
- Handles acronym expansion ("3DGS" → "3D Gaussian Splatting")
- Creates new entities when no match found
- Resolves relationships using canonical entity IDs

**3. Validator Agent**
- Checks temporal consistency (publication dates)
- Verifies entity type compatibility with relationship types
- Adjusts confidence scores based on evidence strength
- Flags contradictions with existing graph
- Filters low-confidence relationships (< 0.4)

### Entity Resolution

Entity resolution uses a multi-strategy approach:

1. **Exact matching**: Normalized name comparison
2. **Fuzzy matching**: String similarity for variations
3. **Acronym expansion**: Context-aware abbreviation matching
4. **Temporal context**: Publication dates for disambiguation

Entities are deduplicated using `normalized_name` field (lowercase, trimmed). New entities are created only when confidence in existing matches is below threshold.

### Provenance Tracking

Every edge in the graph links to source evidence:
- Paper ID where relationship was found
- Section (abstract, introduction, methods, results)
- Extracted text snippet
- Character span positions (start/end)

This enables:
- Verification of AI-extracted relationships
- Confidence scoring based on evidence quality
- Citation of source material
- Debugging and refinement of extraction prompts

## API Reference

### Papers

- `GET /api/papers?limit=20&offset=0` - List papers with pagination
- `GET /api/papers/:id` - Get paper details
- `POST /api/papers` - Create paper manually
- `POST /api/papers/:id/process` - Trigger extraction pipeline

### Graph

- `GET /api/graph/nodes?type=method&search=gaussian` - List nodes with filters
- `GET /api/graph/nodes/:id` - Get node with connected edges
- `GET /api/graph/edges?type=extends` - List edges with filters
- `GET /api/graph/subgraph?nodeId=X&depth=2` - Get N-hop neighborhood
- `GET /api/graph/stats` - Aggregate statistics

### Ingestion

- `POST /api/ingest/arxiv` - Fetch and add paper from arXiv
- `GET /api/ingest/status/:jobId` - Check processing status

## Limitations and Future Work

### Current Limitations

1. **No PDF fetching**: System expects PDF URLs but doesn't implement actual PDF downloads
2. **Synchronous processing**: Paper processing blocks the API thread
3. **No authentication**: Open API with no access control
4. **Limited LLM output parsing**: Basic regex-based JSON extraction may fail on malformed responses
5. **No pagination on graph visualization**: May struggle with graphs > 500 nodes
6. **Static graph layout**: Doesn't use force-directed or other dynamic layouts

### Scaling Improvements

1. **Job queue**: Implement Redis-backed queue for async processing
2. **Worker pool**: Separate worker processes for LLM inference
3. **Caching**: Redis cache for frequently accessed subgraphs
4. **Batch processing**: Process multiple chunks in parallel
5. **Incremental updates**: Update existing papers without full reprocessing
6. **Graph database migration**: Consider Neo4j for complex multi-hop queries

### Feature Enhancements

1. **Citation network**: Extract and visualize paper citations
2. **Author network**: Collaboration graph between researchers
3. **Temporal analysis**: Track concept evolution over time
4. **Conflict resolution**: UI for reviewing and correcting extracted relationships
5. **Export formats**: GraphML, Cypher, RDF for external tools
6. **Search**: Full-text search across papers and entities
7. **Embeddings**: Semantic search using vector similarity

## Development

### Project Structure

```
gsplat-kg/
├── apps/
│   ├── api/              # Backend API
│   │   ├── src/
│   │   │   ├── routes/   # HTTP endpoints
│   │   │   ├── db/       # Schema and queries
│   │   │   ├── agents/   # AI agent logic
│   │   │   ├── services/ # External services
│   │   │   └── pipeline/ # Orchestration
│   │   └── drizzle/      # Migrations
│   │
│   └── web/              # Frontend UI
│       └── src/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           └── lib/
│
├── packages/
│   └── shared/           # Shared types
│
└── docker-compose.yml    # PostgreSQL setup
```

### Key Commands

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker-compose up -d

# Push database schema
pnpm db:push

# Open Drizzle Studio (database GUI)
pnpm db:studio

# Build all packages
pnpm build

# Start development servers
pnpm dev
```

### Bulk Papers
```
2511.21678,2511.21591,2511.21260
```

## License

MIT


## Example Queries

The knowledge graph supports semantic queries through dedicated API endpoints. Here are examples demonstrating the graph's capabilities:

### 1. Find Papers That Improve on 3D Gaussian Splatting

```bash
GET /api/graph/queries/improves-3dgs
```

Response:
```json
{
  "query": "Which methods improve on 3D Gaussian Splatting?",
  "results": [
    {
      "sourceName": "Mip-Splatting",
      "sourceType": "method",
      "relationship": "improves",
      "confidence": "0.85",
      "targetName": "3D Gaussian Splatting"
    },
    {
      "sourceName": "Scaffold-GS",
      "sourceType": "method", 
      "relationship": "improves",
      "confidence": "0.90",
      "targetName": "3D Gaussian Splatting"
    }
  ],
  "count": 2
}
```

### 2. Find Papers That Extend the Original 3DGS Method

```bash
GET /api/graph/queries/extends-3dgs
```

This query finds all methods that explicitly extend or build upon the original Gaussian Splatting approach.

### 3. Find Datasets Used for Evaluation

```bash
GET /api/graph/queries/datasets
```

Returns all dataset nodes and which methods evaluated on them:
```json
{
  "query": "Which datasets are used for evaluation?",
  "results": [
    {
      "dataset": "Mip-NeRF360",
      "usedBy": "3D Gaussian Splatting",
      "confidence": "0.95"
    },
    {
      "dataset": "Tanks and Temples",
      "usedBy": "Scaffold-GS",
      "confidence": "0.88"
    }
  ]
}
```

### 4. Find All Relationships for a Specific Method

```bash
GET /api/graph/queries/method-relationships?name=Gaussian
```

Returns both incoming and outgoing relationships for methods matching the search term.

### 5. Get Provenance for a Relationship

```bash
GET /api/graph/queries/provenance/:edgeId
```

Returns the source evidence for any extracted relationship:
```json
{
  "edge": {
    "id": "uuid",
    "sourceId": "...",
    "targetId": "...",
    "type": "improves",
    "confidence": "0.85"
  },
  "sourceNode": { "name": "Mip-Splatting", "type": "method" },
  "targetNode": { "name": "3D Gaussian Splatting", "type": "method" },
  "provenance": [
    {
      "paperTitle": "Mip-Splatting: Alias-free 3D Gaussian Splatting",
      "paperArxivId": "2311.16493",
      "section": "abstract",
      "extractedText": "We present Mip-Splatting, which addresses aliasing artifacts in 3D Gaussian Splatting..."
    }
  ]
}
```

### 6. Get N-Hop Subgraph

```bash
GET /api/graph/subgraph?nodeId=<uuid>&depth=2
```

Returns all nodes and edges within N hops of a center node, useful for exploring local neighborhoods in the graph.

### Raw SQL Examples

For direct database access, here are equivalent SQL queries:

**Papers improving on 3DGS:**
```sql
SELECT 
  source_nodes.name as improving_method,
  edges.confidence,
  papers.title as source_paper
FROM edges
JOIN nodes source_nodes ON edges.source_id = source_nodes.id
JOIN nodes target_nodes ON edges.target_id = target_nodes.id
LEFT JOIN papers ON source_nodes.paper_id = papers.id
WHERE target_nodes.name ILIKE '%Gaussian Splatting%'
  AND edges.type = 'improves'
ORDER BY edges.confidence DESC;
```

**Methods and their datasets:**
```sql
SELECT 
  method_nodes.name as method,
  dataset_nodes.name as dataset,
  edges.confidence
FROM edges
JOIN nodes method_nodes ON edges.source_id = method_nodes.id
JOIN nodes dataset_nodes ON edges.target_id = dataset_nodes.id
WHERE edges.type = 'evaluates_on'
  AND dataset_nodes.type = 'dataset'
ORDER BY method_nodes.name;
```

**Find all relationships for a concept:**
```sql
WITH target_concept AS (
  SELECT id FROM nodes WHERE name ILIKE '%novel view synthesis%'
)
SELECT 
  'outgoing' as direction,
  n.name as related_entity,
  e.type as relationship,
  e.confidence
FROM edges e
JOIN nodes n ON e.target_id = n.id
WHERE e.source_id IN (SELECT id FROM target_concept)

UNION ALL

SELECT 
  'incoming' as direction,
  n.name as related_entity,
  e.type as relationship,
  e.confidence
FROM edges e
JOIN nodes n ON e.source_id = n.id
WHERE e.target_id IN (SELECT id FROM target_concept);
```

---

## Processing Papers

### Single Paper Processing

```bash
# 1. Ingest paper from arXiv
curl -X POST http://localhost:3000/api/ingest/arxiv \
  -H "Content-Type: application/json" \
  -d '{"arxivId": "2308.04079", "autoProcess": true}'

# 2. Check job status
curl http://localhost:3000/api/ingest/status/<jobId>

# 3. Or manually trigger processing
curl -X POST http://localhost:3000/api/papers/<paperId>/process
```

### Bulk Processing

```bash
# Ingest multiple papers
curl -X POST http://localhost:3000/api/ingest/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "arxivIds": ["2308.04079", "2311.16493", "2312.02126"],
    "autoProcess": true
  }'
```

### Seed Dataset

Get a curated list of Gaussian Splatting papers to ingest:

```bash
curl http://localhost:3000/api/ingest/seed/gaussian-splatting
```

---

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/papers` | GET | List all papers |
| `/api/papers/:id` | GET | Get paper details |
| `/api/papers/:id/process` | POST | Process paper through AI pipeline |
| `/api/graph/nodes` | GET | List nodes with filters |
| `/api/graph/nodes/:id` | GET | Get node with relationships |
| `/api/graph/edges` | GET | List edges with filters |
| `/api/graph/subgraph` | GET | Get N-hop neighborhood |
| `/api/graph/stats` | GET | Get graph statistics |
| `/api/graph/queries/improves-3dgs` | GET | Papers improving on 3DGS |
| `/api/graph/queries/extends-3dgs` | GET | Papers extending 3DGS |
| `/api/graph/queries/datasets` | GET | Datasets and their usage |
| `/api/graph/queries/method-relationships` | GET | Relationships for a method |
| `/api/graph/queries/provenance/:edgeId` | GET | Evidence for a relationship |
| `/api/ingest/arxiv` | POST | Ingest paper from arXiv |
| `/api/ingest/bulk` | POST | Bulk ingest papers |
| `/api/ingest/status/:jobId` | GET | Check ingestion status |
| `/api/ingest/seed/gaussian-splatting` | GET | Get seed paper IDs |