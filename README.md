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
