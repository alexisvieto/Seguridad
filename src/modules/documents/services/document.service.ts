import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, JsonBlock } from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

export async function createDocument(
  client: Client,
  input: {
    tenant_id: string;
    title: string;
    parent_id?: string | null;
    content: Record<string, unknown>[];
  },
  userId: string,
) {
  const { data, error } = await client
    .from('documents')
    .insert({
      tenant_id: input.tenant_id,
      title: input.title,
      parent_id: input.parent_id ?? null,
      content: input.content as unknown as JsonBlock[],
      created_by: userId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear el documento');
  }

  return data;
}

export async function getDocumentById(client: Client, documentId: string) {
  const { data, error } = await client
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error || !data) {
    throw new AppError('DOCUMENT_NOT_FOUND', 'Documento no encontrado');
  }

  return data;
}

export async function getDocumentsByTenant(
  client: Client,
  tenantId: string,
  parentId: string | null = null,
) {
  let query = client
    .from('documents')
    .select('id, tenant_id, parent_id, title, icon, is_pinned, created_by, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (parentId === null) {
    query = query.is('parent_id', null);
  } else {
    query = query.eq('parent_id', parentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener los documentos');
  }

  return data ?? [];
}

export async function updateDocument(
  client: Client,
  documentId: string,
  input: {
    title?: string;
    content?: Record<string, unknown>[];
    icon?: string | null;
    cover_url?: string | null;
    is_pinned?: boolean;
    parent_id?: string | null;
  },
) {
  const updateData: Database['public']['Tables']['documents']['Update'] = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.content !== undefined) updateData.content = input.content as unknown as JsonBlock[];
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.cover_url !== undefined) updateData.cover_url = input.cover_url;
  if (input.is_pinned !== undefined) updateData.is_pinned = input.is_pinned;
  if (input.parent_id !== undefined) updateData.parent_id = input.parent_id;

  const { data, error } = await client
    .from('documents')
    .update(updateData)
    .eq('id', documentId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el documento');
  }

  return data;
}

export async function deleteDocument(client: Client, documentId: string) {
  const { error } = await client
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al eliminar el documento');
  }
}
