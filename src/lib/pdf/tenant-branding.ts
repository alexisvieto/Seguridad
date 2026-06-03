import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';

export interface TenantBranding {
  name: string;
  logoUrl: string | null;
  address: string;
  phone: string;
  email: string;
  website: string;
  regulatoryEntity: string;
  currencySymbol: string;
}

export async function getTenantBranding(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantBranding> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, logo_url, settings')
    .eq('id', tenantId)
    .maybeSingle();

  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const branding = (settings['branding'] ?? {}) as Record<string, string>;
  const regional = (settings['regional'] ?? {}) as Record<string, string>;
  const firearms = (settings['firearms'] ?? {}) as Record<string, string>;

  return {
    name: tenant?.name ?? '',
    logoUrl: branding['logo_url'] || tenant?.logo_url || '/brand/logo-nexguard360-light.svg',
    address: branding['address'] ?? '',
    phone: branding['phone'] ?? '',
    email: branding['email'] ?? '',
    website: branding['website'] ?? '',
    regulatoryEntity: firearms['regulatory_entity'] ?? 'DIASP',
    currencySymbol: regional['currency_symbol'] ?? 'B/.',
  };
}
