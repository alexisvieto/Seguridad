import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';

type Client = SupabaseClient<Database>;

const DEFAULT_EXPIRY_SECONDS = 3600;

export async function getSignedUrl(
  client: Client,
  bucket: string,
  path: string,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function getSignedUrls(
  client: Client,
  bucket: string,
  paths: string[],
  expiresIn: number = DEFAULT_EXPIRY_SECONDS,
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);

  if (error || !data) return new Map();

  const result = new Map<string, string>();
  for (const item of data) {
    if (item.signedUrl && item.path) {
      result.set(item.path, item.signedUrl);
    }
  }

  return result;
}
