'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'incidents' | 'tickets' | 'damages';

interface IncidentRow {
  id: string;
  stationName: string;
  refinedText: string;
  status: string;
  createdAt: string;
}

interface TicketRow {
  id: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface DamageRow {
  id: string;
  stationName: string;
  itemDamaged: string;
  responsibleParty: string;
  description: string;
  costEstimate: number;
  evidenceUrls: string[];
  status: string;
  createdAt: string;
}

interface PropertyInfo {
  id: string;
  name: string;
  tenantId: string;
}

interface Toast {
  type: 'success' | 'error';
  msg: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PA', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const ticketStatusBadge: Record<string, { label: string; cls: string }> = {
  abierto: { label: 'Abierto', cls: 'bg-blue-500/15 text-blue-400' },
  en_proceso: { label: 'En proceso', cls: 'bg-amber-500/15 text-amber-400' },
  resuelto: { label: 'Resuelto', cls: 'bg-lime-500/15 text-lime-400' },
  cerrado: { label: 'Cerrado', cls: 'bg-zinc-500/15 text-zinc-400' },
};

const priorityBadge: Record<string, { label: string; cls: string }> = {
  baja: { label: 'Baja', cls: 'text-zinc-500' },
  media: { label: 'Media', cls: 'text-blue-400' },
  alta: { label: 'Alta', cls: 'text-amber-400' },
  critica: { label: 'Crítica', cls: 'text-red-400 font-semibold' },
};

const damageStatusBadge: Record<string, { label: string; cls: string }> = {
  bajo_investigacion: { label: 'En investigación', cls: 'bg-amber-500/15 text-amber-400' },
  aceptado_empresa: { label: 'Aceptado', cls: 'bg-blue-500/15 text-blue-400' },
  rechazado_con_pruebas: { label: 'Rechazado', cls: 'bg-red-500/15 text-red-400' },
  reparado: { label: 'Reparado', cls: 'bg-lime-500/15 text-lime-400' },
};

const categoryLabels: Record<string, string> = {
  queja_personal: 'Queja de personal',
  solicitud_refuerzo: 'Solicitud de refuerzo',
  falla_servicio: 'Falla de servicio',
  otros: 'Otros',
};

const responsibleLabels: Record<string, string> = {
  agente_seguridad: 'Agente de seguridad',
  residente: 'Residente',
  proveedor_externo: 'Proveedor externo',
  desconocido: 'Desconocido',
};

const incidentStatusDot: Record<string, string> = {
  open: 'bg-red-500',
  in_progress: 'bg-amber-500',
  resolved: 'bg-lime-500',
  closed: 'bg-zinc-500',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientePortalPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [tab, setTab] = useState<Tab>('incidents');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [damages, setDamages] = useState<DamageRow[]>([]);

  // New ticket form
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [tCategory, setTCategory] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tPriority, setTPriority] = useState('media');
  const [tLoading, setTLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // -------------------------------------------------------------------
  // Load data
  // -------------------------------------------------------------------

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Find the property linked to this user via memberships + tenant
    const { data: tenant } = await supabase
      .from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;

    // Get properties in this tenant (client sees the first one they manage)
    const { data: properties } = await supabase
      .from('properties_ph')
      .select('id, name, tenant_id')
      .eq('tenant_id', tenant.id)
      .limit(1);

    const prop = properties?.[0];
    if (!prop) { setIsLoading(false); return; }
    setProperty({ id: prop.id, name: prop.name, tenantId: prop.tenant_id });

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Get work station IDs for this property
    const { data: stations } = await supabase
      .from('work_stations')
      .select('id, name')
      .eq('property_id', prop.id);

    const stationIds = (stations ?? []).map((s) => s.id);
    const stationMap = new Map((stations ?? []).map((s) => [s.id, s.name]));

    const [incidentsRes, ticketsRes, damagesRes] = await Promise.all([
      stationIds.length > 0
        ? supabase
            .from('incidents_log')
            .select('id, work_station_id, raw_text, ai_refined_text, status, created_at')
            .in('work_station_id', stationIds)
            .gte('created_at', fortyEightHoursAgo)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('client_tickets')
        .select('id, category, subject, description, priority, status, created_at')
        .eq('property_id', prop.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('client_damage_reports')
        .select('id, work_station_id, item_damaged, responsible_party, description, cost_estimate, evidence_urls, status, created_at')
        .eq('property_id', prop.id)
        .order('created_at', { ascending: false }),
    ]);

    setIncidents(
      (incidentsRes.data ?? []).map((i) => ({
        id: i.id,
        stationName: stationMap.get(i.work_station_id) ?? 'Puesto',
        refinedText: i.ai_refined_text ?? i.raw_text,
        status: i.status,
        createdAt: i.created_at,
      })),
    );

    setTickets(
      (ticketsRes.data ?? []).map((t) => ({
        id: t.id,
        category: t.category,
        subject: t.subject,
        description: t.description,
        priority: t.priority,
        status: t.status,
        createdAt: t.created_at,
      })),
    );

    setDamages(
      (damagesRes.data ?? []).map((d) => ({
        id: d.id,
        stationName: d.work_station_id ? (stationMap.get(d.work_station_id) ?? '') : '',
        itemDamaged: d.item_damaged,
        responsibleParty: d.responsible_party,
        description: d.description,
        costEstimate: Number(d.cost_estimate),
        evidenceUrls: d.evidence_urls,
        status: d.status,
        createdAt: d.created_at,
      })),
    );

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Submit ticket
  // -------------------------------------------------------------------

  const submitTicket = useCallback(async () => {
    if (!property || !tCategory || !tSubject.trim() || !tDescription.trim()) return;
    setTLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { error } = await supabase.from('client_tickets').insert({
        tenant_id: property.tenantId,
        property_id: property.id,
        category: tCategory as 'queja_personal' | 'solicitud_refuerzo' | 'falla_servicio' | 'otros',
        subject: tSubject.trim(),
        description: tDescription.trim(),
        priority: tPriority as 'baja' | 'media' | 'alta' | 'critica',
        created_by: user.id,
      });

      if (error) throw error;

      setToast({ type: 'success', msg: 'Ticket creado correctamente' });
      setShowTicketForm(false);
      setTCategory('');
      setTSubject('');
      setTDescription('');
      setTPriority('media');
      loadData();
    } catch {
      setToast({ type: 'error', msg: 'Error al crear el ticket' });
    } finally {
      setTLoading(false);
    }
  }, [property, tCategory, tSubject, tDescription, tPriority, loadData]);

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------

  const openTickets = tickets.filter((t) => t.status === 'abierto' || t.status === 'en_proceso').length;
  const pendingDamages = damages.filter((d) => d.status === 'bajo_investigacion').length;

  // -------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
          <p className="text-sm tracking-widest text-zinc-500 uppercase">Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <p className="text-sm text-zinc-500">No hay propiedades asignadas a su cuenta</p>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* HEADER */}
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Portal del Cliente</p>
        <h1 className="mt-0.5 text-xl font-bold text-zinc-100">{property.name}</h1>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 border-b border-zinc-800/60 px-6 py-4">
        <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/40 px-5 py-4">
          <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Novedades 48h</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-200">{incidents.length}</p>
        </div>
        <div className={`rounded-xl border px-5 py-4 ${openTickets > 0 ? 'border-blue-500/20 bg-blue-500/8' : 'border-zinc-700/30 bg-zinc-800/40'}`}>
          <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Tickets Activos</p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${openTickets > 0 ? 'text-blue-400' : 'text-zinc-600'}`}>{openTickets}</p>
        </div>
        <div className={`rounded-xl border px-5 py-4 ${pendingDamages > 0 ? 'border-amber-500/20 bg-amber-500/8' : 'border-zinc-700/30 bg-zinc-800/40'}`}>
          <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Daños Pendientes</p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${pendingDamages > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{pendingDamages}</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-zinc-800/60 px-6 pt-2">
        {([
          { key: 'incidents' as Tab, label: 'Novedades', count: incidents.length },
          { key: 'tickets' as Tab, label: 'Tickets', count: openTickets },
          { key: 'damages' as Tab, label: 'Daños', count: pendingDamages },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-t-lg px-5 py-3 text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
              tab === t.key
                ? 'bg-zinc-800/60 text-zinc-100 border-b-2 border-lime-500'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] tabular-nums text-zinc-300">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ============================================================ */}
        {/* TAB: Incidents (48h)                                          */}
        {/* ============================================================ */}
        {tab === 'incidents' && (
          <div className="space-y-3">
            {incidents.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-zinc-600">Sin novedades en las últimas 48 horas</p>
                <p className="mt-1 text-xs text-zinc-700">El servicio opera con normalidad</p>
              </div>
            ) : (
              incidents.map((inc) => (
                <div key={inc.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${incidentStatusDot[inc.status] ?? 'bg-zinc-500'}`} />
                      <span className="text-xs font-medium text-zinc-400">{inc.stationName}</span>
                    </div>
                    <span className="text-xs text-zinc-600">{timeAgo(inc.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{inc.refinedText}</p>
                  <p className="mt-2 text-[11px] text-zinc-600">{formatDateTime(inc.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: Tickets                                                  */}
        {/* ============================================================ */}
        {tab === 'tickets' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Mis Tickets</h2>
              <button
                onClick={() => setShowTicketForm(!showTicketForm)}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lime-500 cursor-pointer"
              >
                <PlusIcon />
                {showTicketForm ? 'Cancelar' : 'Abrir Nuevo Ticket'}
              </button>
            </div>

            {/* New ticket form */}
            {showTicketForm && (
              <div className="mb-6 rounded-2xl border border-zinc-700/30 bg-zinc-800/30 p-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Categoría</span>
                  <select value={tCategory} onChange={(e) => setTCategory(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                    <option value="">Seleccionar...</option>
                    <option value="queja_personal">Queja de personal</option>
                    <option value="solicitud_refuerzo">Solicitud de refuerzo</option>
                    <option value="falla_servicio">Falla de servicio</option>
                    <option value="otros">Otros</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Asunto</span>
                  <input type="text" value={tSubject} onChange={(e) => setTSubject(e.target.value)} maxLength={300} placeholder="Resuma el asunto..."
                    className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Descripción</span>
                  <textarea value={tDescription} onChange={(e) => setTDescription(e.target.value)} rows={4} maxLength={5000} placeholder="Detalle la situación..."
                    className="mt-1 block w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Prioridad</span>
                  <select value={tPriority} onChange={(e) => setTPriority(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </label>
                <button onClick={submitTicket} disabled={!tCategory || !tSubject.trim() || !tDescription.trim() || tLoading}
                  className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-lime-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                  {tLoading ? <Spinner /> : 'Enviar Ticket'}
                </button>
              </div>
            )}

            {/* Ticket list */}
            {tickets.length === 0 && !showTicketForm ? (
              <p className="py-16 text-center text-sm text-zinc-600">No hay tickets registrados</p>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => {
                  const sBadge = ticketStatusBadge[ticket.status] ?? ticketStatusBadge['abierto']!;
                  const pBadge = priorityBadge[ticket.priority] ?? priorityBadge['media']!;
                  return (
                    <div key={ticket.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${sBadge.cls}`}>{sBadge.label}</span>
                            <span className={`text-[11px] ${pBadge.cls}`}>{pBadge.label}</span>
                          </div>
                          <p className="mt-1.5 text-sm font-medium text-zinc-100">{ticket.subject}</p>
                          <p className="mt-1 text-xs text-zinc-500 truncate">{categoryLabels[ticket.category] ?? ticket.category}</p>
                        </div>
                        <span className="shrink-0 text-xs text-zinc-600">{timeAgo(ticket.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{ticket.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: Damages                                                  */}
        {/* ============================================================ */}
        {tab === 'damages' && (
          <div>
            {damages.length === 0 ? (
              <p className="py-16 text-center text-sm text-zinc-600">No hay reportes de daños</p>
            ) : (
              <div className="space-y-3">
                {damages.map((dmg) => {
                  const badge = damageStatusBadge[dmg.status] ?? damageStatusBadge['bajo_investigacion']!;
                  const isRejected = dmg.status === 'rechazado_con_pruebas';
                  return (
                    <div key={dmg.id} className={`rounded-xl border px-5 py-4 ${
                      isRejected ? 'border-red-500/20 bg-red-500/5' : 'border-zinc-800/40 bg-zinc-800/20'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                            {dmg.stationName && <span className="text-[11px] text-zinc-500">{dmg.stationName}</span>}
                          </div>
                          <p className="mt-1.5 text-sm font-medium text-zinc-100">{dmg.itemDamaged}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Responsable: {responsibleLabels[dmg.responsibleParty] ?? dmg.responsibleParty}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {dmg.costEstimate > 0 && (
                            <p className="text-sm font-semibold tabular-nums text-zinc-200">
                              ${dmg.costEstimate.toLocaleString('es-PA', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                          <p className="text-xs text-zinc-600">{timeAgo(dmg.createdAt)}</p>
                        </div>
                      </div>

                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{dmg.description}</p>

                      {/* Evidence photos */}
                      {dmg.evidenceUrls.length > 0 && dmg.status === 'bajo_investigacion' && (
                        <div className="mt-3 flex gap-2 overflow-x-auto">
                          {dmg.evidenceUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500 hover:bg-zinc-700 transition-colors cursor-pointer">
                              <PhotoIcon />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Rejection notice */}
                      {isRejected && (
                        <div className="mt-3 rounded-lg bg-red-500/10 px-4 py-3">
                          <p className="text-xs font-medium text-red-400">Resultado de la investigación</p>
                          <p className="mt-1 text-xs leading-relaxed text-red-300/80">
                            La empresa de seguridad ha aportado evidencias (registros de cámaras, bitácoras y testimonios)
                            que determinan que el daño no es atribuible al agente asignado. El caso se considera cerrado
                            con pruebas documentales.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-[slideUp_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-lime-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  );
}

function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}
