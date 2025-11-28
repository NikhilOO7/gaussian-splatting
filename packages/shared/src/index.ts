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
  abstract?: string;
  arxivId?: string;
  doi?: string;
  pdfUrl?: string;
  publicationDate?: string;
  venue?: string;
  rawText?: string;
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Node {
  id: string;
  type: NodeType;
  name: string;
  normalizedName?: string;
  description?: string;
  properties?: Record<string, any>;
  paperId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  properties?: Record<string, any>;
  confidence?: string;
  createdAt: Date;
}

export interface GraphStats {
  nodes: {
    total: number;
    byType: Array<{ type: string; count: number }>;
  };
  edges: {
    total: number;
    byType: Array<{ type: string; count: number }>;
  };
}

export interface Subgraph {
  nodes: Node[];
  edges: Edge[];
}
