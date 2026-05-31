export type {
  ClientTicket,
  ClientDamageReport,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  DamageResponsible,
  DamageStatus,
} from '@/shared/types/database';

export interface CreateTicketInput {
  tenant_id: string;
  property_id: string;
  category: 'queja_personal' | 'solicitud_refuerzo' | 'falla_servicio' | 'otros';
  subject: string;
  description: string;
  priority?: 'baja' | 'media' | 'alta' | 'critica';
}

export interface CreateDamageReportInput {
  tenant_id: string;
  property_id: string;
  work_station_id?: string;
  item_damaged: string;
  responsible_party: 'agente_seguridad' | 'residente' | 'proveedor_externo' | 'desconocido';
  description: string;
  cost_estimate?: number;
  evidence_urls?: string[];
}
