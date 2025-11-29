export type NodeType = 'paper' | 'method' | 'concept' | 'dataset' | 'metric';

export type EdgeType = 
  | 'extends' 
  | 'improves' 
  | 'uses' 
  | 'introduces' 
  | 'cites' 
  | 'evaluates_on' 
  | 'compares_to' 
  | 'authored_by';

export interface Paper {
  id: string;
  title: string;
  abstract: string | null;
  arxivId: string | null;
  doi: string | null;
  pdfUrl: string | null;
  publicationDate: string | null;
  venue: string | null;
  rawText: string | null;
  processed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Author {
  id: string;
  name: string;
  normalizedName: string | null;
  orcid: string | null;
  affiliations: Record<string, any> | null;
  createdAt: string;
}

export interface Node {
  id: string;
  type: NodeType;
  name: string;
  normalizedName: string | null;
  description: string | null;
  properties: Record<string, any> | null;
  paperId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  properties: Record<string, any> | null;
  confidence: string | null;
  createdAt: string;
}

export interface Source {
  id: string;
  edgeId: string;
  paperId: string;
  pageNumber: number | null;
  section: string | null;
  extractedText: string | null;
  spanStart: number | null;
  spanEnd: number | null;
  createdAt: string;
}

export interface GraphStats {
  nodes: {
    total: number;
    byType: Array<{ type: NodeType; count: number }>;
  };
  edges: {
    total: number;
    byType: Array<{ type: EdgeType; count: number }>;
  };
  papers?: {
    total: number;
    processed: number;
  };
}

export interface Subgraph {
  nodes: Node[];
  edges: Edge[];
  center?: Node;
  depth?: number;
}

export interface NodeWithEdges {
  node: Node;
  outgoingEdges: Array<Edge & { targetNode?: Node }>;
  incomingEdges: Array<Edge & { sourceNode?: Node }>;
}

export interface EntityMention {
  mention: string;
  type: 'method' | 'concept' | 'dataset' | 'metric' | 'paper_reference';
  spanStart: number;
  spanEnd: number;
  confidence: number;
}

export interface Relationship {
  subject: string;
  predicate: string;
  object: string;
  evidenceText: string;
  confidence: number;
}

export interface ExtractorOutput {
  entities: EntityMention[];
  relationships: Relationship[];
}

export interface ResolvedEntity {
  mention: string;
  canonicalId: string | null;
  canonicalName: string;
  type: 'method' | 'concept' | 'dataset' | 'metric' | 'paper';
  isNew: boolean;
  confidence: number;
}

export interface ResolvedRelationship {
  sourceId: string;
  targetId: string;
  type: string;
  confidence: number;
  evidence: string;
}

export interface ResolverOutput {
  resolvedEntities: ResolvedEntity[];
  resolvedRelationships: ResolvedRelationship[];
}

export interface ValidationOutput {
  accepted: ResolvedRelationship[];
  rejected: Array<{
    relationship: ResolvedRelationship;
    reason: string;
  }>;
  confidenceAdjustments: Array<{
    relationshipId: string;
    originalConfidence: number;
    adjustedConfidence: number;
    reason: string;
  }>;
}

export interface ProcessingStats {
  chunksProcessed: number;
  entitiesExtracted: number;
  entitiesCreated: number;
  relationshipsCreated: number;
  relationshipsRejected: number;
}

export interface JobStatus {
  status: 'queued' | 'fetching_metadata' | 'downloading_pdf' | 'extracting_text' | 'processing' | 'completed' | 'failed';
  paperId?: string;
  error?: string;
  progress?: string;
}