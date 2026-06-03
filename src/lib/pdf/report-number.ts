import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';

type Client = SupabaseClient<Database>;

export async function getOrCreateReportNumber(
  client: Client,
  tenantId: string,
  prefix: string,
  table: 'agent_equipment_loans' | 'firearms_assignments' | 'shift_change_reports',
  recordId: string,
): Promise<string> {
  // Check if already has a number
  const { data: existing } = await client
    .from(table)
    .select('report_number')
    .eq('id', recordId)
    .maybeSingle();

  if (existing?.report_number) return existing.report_number;

  // Generate new number atomically
  const { data: result } = await client.rpc('next_report_number', {
    p_tenant_id: tenantId,
    p_prefix: prefix,
  });

  const reportNumber = String(result ?? `${prefix}-0000`);

  // Save it
  await client
    .from(table)
    .update({ report_number: reportNumber } as never)
    .eq('id', recordId);

  return reportNumber;
}
