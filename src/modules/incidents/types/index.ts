export type { IncidentLog, IncidentStatus } from '@/shared/types/database';

export interface CreateIncidentInput {
  tenant_id: string;
  work_station_id: string;
  raw_text: string;
}

export interface UpdateIncidentInput {
  raw_text?: string;
  ai_refined_text?: string | null;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  am_report_sent?: boolean;
}
