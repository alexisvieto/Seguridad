export type { Document, JsonBlock } from '@/shared/types/database';

export interface CreateDocumentInput {
  tenant_id: string;
  title?: string;
  parent_id?: string | null;
  content?: unknown[];
}

export interface UpdateDocumentInput {
  title?: string;
  content?: unknown[];
  icon?: string | null;
  cover_url?: string | null;
  is_pinned?: boolean;
  parent_id?: string | null;
}
