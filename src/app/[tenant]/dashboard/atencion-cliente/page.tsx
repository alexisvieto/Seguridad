'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'tickets' | 'damages';

interface TicketRow {
  id: string;
  propertyName: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  createdAt: string;
  resolution: string | null;
}

interface DamageRow {
  id: string;
  propertyName: string;
  description: string;
  location: string;
  estimatedCost: number;
  responsible: string;
  status: string;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  queja_personal: 'Queja de Personal',
  solicitud_refuerzo: 'Solicitud de Refuerzo',
  falla_servicio: 'Falla de Servicio',
  otros: 'Otros',
};

const priorityBadge: Record<string, { label: string; cls: string }> = {
  baja: { label: 'Baja', cls: 'bg-zinc-500/15 text-zinc-400' },
  media: { label: 'Media', cls: 'bg-blue-500/15 text-blue-400' },
  alta: { label: 'Alta', cls: 'bg-amber-500/15 text-amber-400' },
  critica: { label: 'Crítica', cls: 'bg-red-500/15 text-red-400' },
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  abierto: { label: 'Abierto', cls: 'bg-red-500/15 text-red-400' },
  en_proceso: { label: 'En Proceso', cls: 'bg-amber-500/15 text-amber-400' },
  resuelto: { label: 'Resuelto', cls: 'bg-lime-500/15 text-lime-400' },
  cerrado: { label: 'Cerrado', cls: 'bg-zinc-500/15 text-zinc-400' },
  bajo_investigacion: { label: 'En Investigación', cls: 'bg-amber-500/15 text-amber-400' },
  aceptado_empresa: { label: 'Aceptado', cls: 'bg-lime-500/15 text-lime-400' },
  rechazado_con_pruebas: { label: 'Rechazado', cls: 'bg-red-500/15 text-red-400' },
  reparado: { label: 'Reparado', cls: 'bg-lime-500/15 text-lime-400' },
};

const responsibleLabels: Record<string, string> = {
  agente_seguridad: 'Agente de Seguridad',
  residente: 'Residente',
  proveedor_externo: 'Proveedor Externo',
  desconocido: 'Desconocido',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AtencionClientePage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tickets');
  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [damages, setDamages] = useState<DamageRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;
    setTenantId(tenant.id);

    const [ticketsRes, damagesRes] = await Promise.all([
      supabase.from('client_tickets').select('*, properties_ph(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('client_damage_reports').select('*, properties_ph(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);

    setTickets((ticketsRes.data ?? []).map((t) => ({
      id: t.id,
      propertyName: (t.properties_ph as { name: string } | null)?.name ?? '',
      category: t.category,
      priority: t.priority,
      status: t.status,
      description: t.description,
      createdAt: t.created_at,
      resolution: null,
    })));

    setDamages((damagesRes.data ?? []).map((d) => ({
      id: d.id,
      propertyName: (d.properties_ph as { name: string } | null)?.name ?? '',
      description: d.description,
      location: d.item_damaged,
      estimatedCost: Number(d.cost_estimate),
      responsible: d.responsible_party,
      status: d.status,
      createdAt: d.created_at,
    })));

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdateTicket = useCallback(async (id: string, newStatus: string) => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.from('client_tickets').update({
        status: newStatus as 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado',
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      setToast('Ticket actualizado');
      setExpandedId(null);
      setResolution('');
      loadData();
    } catch { setToast('Error al actualizar'); }
    finally { setSaving(false); }
  }, [tenantId, resolution, loadData]);

  const handleUpdateDamage = useCallback(async (id: string, newStatus: string) => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.from('client_damage_reports').update({
        status: newStatus as 'bajo_investigacion' | 'aceptado_empresa' | 'rechazado_con_pruebas' | 'reparado',
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      setToast('Reporte actualizado');
      setExpandedId(null);
      loadData();
    } catch { setToast('Error al actualizar'); }
    finally { setSaving(false); }
  }, [tenantId, loadData]);

  const pendingTickets = tickets.filter((t) => t.status === 'abierto' || t.status === 'en_proceso').length;
  const pendingDamages = damages.filter((d) => d.status === 'bajo_investigacion').length;

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Gestión de Servicio</p>
          <h1 className="text-lg font-bold">Atención al Cliente</h1>
        </div>
        <div className="flex items-center gap-3">
          {pendingTickets > 0 && (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">{pendingTickets} ticket{pendingTickets !== 1 ? 's' : ''} pendiente{pendingTickets !== 1 ? 's' : ''}</span>
          )}
          {pendingDamages > 0 && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400">{pendingDamages} daño{pendingDamages !== 1 ? 's' : ''} en investigación</span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800/60 px-6 pt-2">
        <button onClick={() => setTab('tickets')}
          className={`relative rounded-t-lg px-5 py-3 text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${tab === 'tickets' ? 'bg-zinc-800/60 text-zinc-100 border-b-2 border-lime-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Tickets PQR
          {pendingTickets > 0 && <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{pendingTickets}</span>}
        </button>
        <button onClick={() => setTab('damages')}
          className={`relative rounded-t-lg px-5 py-3 text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${tab === 'damages' ? 'bg-zinc-800/60 text-zinc-100 border-b-2 border-lime-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Reportes de Daños
          {pendingDamages > 0 && <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendingDamages}</span>}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* TICKETS */}
        {tab === 'tickets' && (
          <div className="space-y-2">
            {tickets.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-zinc-600">Sin tickets registrados</div>
            ) : tickets.map((t) => {
              const prio = priorityBadge[t.priority] ?? priorityBadge['media']!;
              const stat = statusBadge[t.status] ?? statusBadge['abierto']!;
              const isExpanded = expandedId === t.id;
              return (
                <div key={t.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                    onClick={() => { setExpandedId(isExpanded ? null : t.id); setResolution(t.resolution ?? ''); }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-zinc-600 shrink-0">{formatDate(t.createdAt)}</span>
                      <p className="text-sm font-medium text-zinc-200 truncate">{t.propertyName}</p>
                      <span className="text-xs text-zinc-500 truncate hidden sm:inline">{categoryLabels[t.category] ?? t.category}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${prio.cls}`}>{prio.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stat.cls}`}>{stat.label}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-zinc-800/30 px-5 py-4 space-y-4 bg-zinc-800/10">
                      <div>
                        <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">Descripción del cliente</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">{t.description}</p>
                      </div>
                      {t.resolution && (
                        <div>
                          <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">Resolución</p>
                          <p className="text-sm text-lime-400/80">{t.resolution}</p>
                        </div>
                      )}
                      {(t.status === 'abierto' || t.status === 'en_proceso') && (
                        <div className="space-y-3 border-t border-zinc-800/30 pt-3">
                          <textarea value={resolution} onChange={(e) => setResolution(e.target.value)}
                            placeholder="Escriba la resolución o respuesta al cliente..."
                            rows={3}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none resize-none" />
                          <div className="flex gap-2 justify-end">
                            {t.status === 'abierto' && (
                              <button onClick={() => handleUpdateTicket(t.id, 'en_proceso')} disabled={saving}
                                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40 cursor-pointer">En Proceso</button>
                            )}
                            <button onClick={() => handleUpdateTicket(t.id, 'resuelto')} disabled={saving || !resolution.trim()}
                              className="rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                              {saving ? '...' : 'Resolver'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* DAMAGES */}
        {tab === 'damages' && (
          <div className="space-y-2">
            {damages.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-zinc-600">Sin reportes de daños</div>
            ) : damages.map((d) => {
              const stat = statusBadge[d.status] ?? statusBadge['bajo_investigacion']!;
              const isExpanded = expandedId === d.id;

              return (
                <div key={d.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-zinc-600 shrink-0">{formatDate(d.createdAt)}</span>
                      <p className="text-sm font-medium text-zinc-200 truncate">{d.propertyName}</p>
                      <span className="text-xs text-zinc-500 truncate hidden sm:inline">{d.location}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-amber-400">B/.{d.estimatedCost.toFixed(2)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stat.cls}`}>{stat.label}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-zinc-800/30 px-5 py-4 space-y-3 bg-zinc-800/10">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><span className="text-zinc-500">Ubicación:</span> <span className="text-zinc-200">{d.location}</span></div>
                        <div><span className="text-zinc-500">Costo estimado:</span> <span className="text-amber-400 font-semibold">B/.{d.estimatedCost.toFixed(2)}</span></div>
                        <div><span className="text-zinc-500">Responsable:</span> <span className="text-zinc-200">{responsibleLabels[d.responsible] ?? d.responsible}</span></div>
                      </div>
                      <div>
                        <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">Descripción</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">{d.description}</p>
                      </div>
                      {d.status === 'bajo_investigacion' && (
                        <div className="flex gap-2 justify-end border-t border-zinc-800/30 pt-3">
                          <button onClick={() => handleUpdateDamage(d.id, 'aceptado_empresa')} disabled={saving}
                            className="rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">Aceptar</button>
                          <button onClick={() => handleUpdateDamage(d.id, 'rechazado_con_pruebas')} disabled={saving}
                            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40 cursor-pointer">Rechazar</button>
                          <button onClick={() => handleUpdateDamage(d.id, 'reparado')} disabled={saving}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 cursor-pointer">Reparado</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-lime-600 px-5 py-3 text-sm font-medium text-white shadow-lg animate-[slideUp_0.3s_ease-out]">{toast}</div>}
    </div>
  );
}
