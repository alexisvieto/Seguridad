'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { NotificationBanner } from './notification-banner';
import { IncidentDetailModal, type IncidentDetail } from './incident-detail-modal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StationCard {
  id: string;
  name: string;
  propertyName: string;
  propertyId: string;
  isActive: boolean;
  agentName: string | null;
  clockIn: string | null;
  gpsValidated: boolean;
  shiftId: string | null;
}

interface IncidentFeed {
  id: string;
  stationName: string;
  propertyName: string;
  refinedText: string;
  status: string;
  createdAt: string;
}

interface EmergencyContact {
  name: string;
  phone: string;
  role: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  open: { label: 'ABIERTO', cls: 'bg-red-500/20 text-red-400 ring-red-500/30' },
  in_progress: { label: 'EN CURSO', cls: 'bg-amber-500/20 text-amber-400 ring-amber-500/30' },
  resolved: { label: 'RESUELTO', cls: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30' },
  closed: { label: 'CERRADO', cls: 'bg-zinc-500/20 text-zinc-400 ring-zinc-500/30' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LiveMonitorPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [stations, setStations] = useState<StationCard[]>([]);
  const [incidents, setIncidents] = useState<IncidentFeed[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState<Map<string, EmergencyContact[]>>(new Map());
  const [activeNotification, setActiveNotification] = useState<IncidentDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // -------------------------------------------------------------------
  // Initial data load
  // -------------------------------------------------------------------

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (!tenant) return;
    setTenantId(tenant.id);

    const [stationsRes, shiftsRes, incidentsRes] = await Promise.all([
      supabase
        .from('work_stations')
        .select('id, name, is_active, property_id, properties_ph(name, contact_emergency)')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('agent_shifts')
        .select('id, work_station_id, clock_in, clock_in_gps, user_id, profiles(full_name)')
        .eq('tenant_id', tenant.id)
        .is('clock_out', null),
      supabase
        .from('incidents_log')
        .select('id, raw_text, ai_refined_text, status, created_at, work_stations(name, properties_ph(name))')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const activeShifts = new Map(
      (shiftsRes.data ?? []).map((s) => [
        s.work_station_id,
        {
          shiftId: s.id,
          agentName: s.profiles?.full_name ?? 'Agente',
          clockIn: s.clock_in,
          gpsValidated: Boolean(s.clock_in_gps && typeof s.clock_in_gps === 'object' && 'lat' in (s.clock_in_gps as unknown as Record<string, unknown>)),
        },
      ]),
    );

    const contactMap = new Map<string, EmergencyContact[]>();

    const cards: StationCard[] = (stationsRes.data ?? []).map((ws) => {
      const shift = activeShifts.get(ws.id);
      const propName = ws.properties_ph?.name ?? 'Sin propiedad';
      const emergencyContacts = (ws.properties_ph?.contact_emergency ?? []) as EmergencyContact[];

      if (emergencyContacts.length > 0) {
        contactMap.set(ws.property_id, emergencyContacts);
      }

      return {
        id: ws.id,
        name: ws.name,
        propertyName: propName,
        propertyId: ws.property_id,
        isActive: ws.is_active,
        agentName: shift?.agentName ?? null,
        clockIn: shift?.clockIn ?? null,
        gpsValidated: shift?.gpsValidated ?? false,
        shiftId: shift?.shiftId ?? null,
      };
    });

    setContacts(contactMap);
    setStations(cards);

    setIncidents(
      (incidentsRes.data ?? []).map((inc) => ({
        id: inc.id,
        stationName: inc.work_stations?.name ?? '',
        propertyName: inc.work_stations?.properties_ph?.name ?? '',
        refinedText: inc.ai_refined_text ?? inc.raw_text,
        status: inc.status,
        createdAt: inc.created_at,
      })),
    );

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------------
  // Realtime subscriptions
  // -------------------------------------------------------------------

  useEffect(() => {
    if (!tenantId) return;

    const supabase = getSupabaseBrowserClient();

    const shiftsChannel = supabase
      .channel('shifts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_shifts',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const rec = payload.new as Record<string, unknown>;

          if (payload.eventType === 'INSERT') {
            setStations((prev) =>
              prev.map((s) =>
                s.id === String(rec['work_station_id'] ?? '')
                  ? {
                      ...s,
                      shiftId: String(rec['id'] ?? ''),
                      agentName: 'Agente (en línea)',
                      clockIn: String(rec['clock_in'] ?? ''),
                      gpsValidated: Boolean(rec['clock_in_gps']),
                    }
                  : s,
              ),
            );
          }

          if (payload.eventType === 'UPDATE' && rec['clock_out']) {
            setStations((prev) =>
              prev.map((s) =>
                s.shiftId === String(rec['id'] ?? '')
                  ? { ...s, shiftId: null, agentName: null, clockIn: null, gpsValidated: false }
                  : s,
              ),
            );
          }
        },
      )
      .subscribe();

    const incidentsChannel = supabase
      .channel('incidents-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidents_log',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const rec = payload.new as Record<string, unknown>;
          const newIncident = {
            id: String(rec['id'] ?? ''),
            stationName: '',
            propertyName: '',
            refinedText: String(rec['ai_refined_text'] ?? rec['raw_text'] ?? ''),
            status: String(rec['status'] ?? 'open'),
            createdAt: String(rec['created_at'] ?? new Date().toISOString()),
          };
          setIncidents((prev) => [newIncident, ...prev.slice(0, 99)]);

          setActiveNotification({
            id: newIncident.id,
            stationName: newIncident.stationName,
            propertyName: newIncident.propertyName,
            agentName: '',
            incidentType: 'Novedad de Campo',
            refinedText: newIncident.refinedText,
            status: newIncident.status,
            createdAt: newIncident.createdAt,
            hasImage: false,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shiftsChannel);
      supabase.removeChannel(incidentsChannel);
    };
  }, [tenantId]);

  // -------------------------------------------------------------------
  // Derived KPIs
  // -------------------------------------------------------------------

  const activeCount = stations.filter((s) => s.shiftId !== null).length;
  const vacantCount = stations.filter((s) => s.shiftId === null).length;
  const lastIncident = incidents[0] ?? null;

  // -------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          <p className="text-sm tracking-widest text-zinc-500 uppercase">Cargando monitor...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="relative flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* ─── Notification Banner + Modal (Fase 2) ─── */}
      <NotificationBanner incident={activeNotification} onBannerClick={() => setIsModalOpen(true)} />
      <IncidentDetailModal
        incident={activeNotification}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tenantSlug={tenantSlug}
      />

      {/* ============================================================ */}
      {/* TOP BAR                                                       */}
      {/* ============================================================ */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-lg font-semibold tracking-wide text-zinc-100">
            NOC Monitor
          </h1>
          <span className="text-sm text-zinc-500">{tenantSlug}</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="font-mono text-2xl tabular-nums tracking-wider text-zinc-300">
            {clock.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </span>
          <span className="text-xs text-zinc-600 uppercase tracking-widest">
            {clock.toLocaleDateString('es-PA', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </div>
      </header>

      {/* ============================================================ */}
      {/* KPI BAR                                                       */}
      {/* ============================================================ */}
      <div className="grid grid-cols-3 gap-4 border-b border-zinc-800/60 px-6 py-4">
        {/* Active */}
        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-5 py-4">
          <p className="text-xs font-medium tracking-widest text-emerald-500/70 uppercase">Puestos Activos</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-emerald-400">{activeCount}</p>
          <p className="mt-1 text-xs text-zinc-500">de {stations.length} puestos</p>
        </div>

        {/* Vacant */}
        <div className={`rounded-xl border px-5 py-4 ${
          vacantCount > 0
            ? 'bg-red-500/8 border-red-500/20'
            : 'bg-zinc-800/40 border-zinc-700/30'
        }`}>
          <p className={`text-xs font-medium tracking-widest uppercase ${
            vacantCount > 0 ? 'text-red-500/70' : 'text-zinc-500'
          }`}>
            Puestos Vacantes
          </p>
          <p className={`mt-1 text-4xl font-bold tabular-nums ${
            vacantCount > 0 ? 'text-red-400' : 'text-zinc-600'
          }`}>
            {vacantCount}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {vacantCount > 0 ? 'requieren atención' : 'todo cubierto'}
          </p>
        </div>

        {/* Last incident */}
        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 px-5 py-4">
          <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Última Novedad</p>
          {lastIncident ? (
            <>
              <p className="mt-1 text-lg font-semibold text-zinc-200 truncate">
                {lastIncident.propertyName || lastIncident.stationName || 'Puesto'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                hace {timeAgo(lastIncident.createdAt)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-lg text-zinc-600">Sin novedades</p>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MAIN CONTENT: Grid + Feed                                     */}
      {/* ============================================================ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ---------------------------------------------------------- */}
        {/* STATION GRID                                                */}
        {/* ---------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {stations.map((station) => {
              const isOccupied = station.shiftId !== null;
              const propertyContacts = contacts.get(station.propertyId) ?? [];
              const supervisor = propertyContacts.find((c) =>
                c.role.toLowerCase().includes('supervisor'),
              ) ?? propertyContacts[0];

              return (
                <div
                  key={station.id}
                  className={`relative rounded-xl border px-4 py-4 transition-colors ${
                    isOccupied
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-red-500/40 bg-red-500/5 animate-pulse'
                  }`}
                >
                  {/* Status dot */}
                  <div className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${
                    isOccupied ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />

                  {/* Station info */}
                  <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase truncate pr-6">
                    {station.propertyName}
                  </p>
                  <p className="mt-0.5 text-base font-semibold text-zinc-100 truncate">
                    {station.name}
                  </p>

                  {isOccupied ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <AgentIcon />
                        <span className="text-sm text-zinc-300 truncate">
                          {station.agentName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon />
                        <span className="text-xs text-zinc-500">
                          Entrada {station.clockIn ? formatTimeShort(station.clockIn) : '--:--'}
                        </span>
                      </div>
                      {station.gpsValidated && (
                        <div className="flex items-center gap-2">
                          <GpsIcon />
                          <span className="text-xs text-emerald-500/80">GPS Validado</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-400">
                        Sin agente asignado
                      </p>
                      {supervisor && (
                        <a
                          href={`tel:${supervisor.phone}`}
                          className="mt-2 flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25 cursor-pointer"
                        >
                          <PhoneIcon />
                          <span className="truncate">
                            {supervisor.name} &middot; {supervisor.phone}
                          </span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {stations.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-zinc-600">No hay puestos configurados</p>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- */}
        {/* INCIDENT FEED                                               */}
        {/* ---------------------------------------------------------- */}
        <aside className="hidden w-[380px] shrink-0 flex-col border-l border-zinc-800/60 lg:flex">
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-3">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
              Feed de Novedades
            </h2>
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs tabular-nums text-zinc-400">
              {incidents.length}
            </span>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto">
            {incidents.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-zinc-700">Sin novedades registradas</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/40">
                {incidents.map((inc) => {
                  const badge = statusLabels[inc.status] ?? statusLabels['open']!;
                  return (
                    <li
                      key={inc.id}
                      className="px-5 py-4 transition-colors hover:bg-zinc-800/20 cursor-pointer"
                      onClick={() => {
                        setActiveNotification({
                          id: inc.id,
                          stationName: inc.stationName,
                          propertyName: inc.propertyName,
                          agentName: '',
                          incidentType: 'Novedad de Campo',
                          refinedText: inc.refinedText,
                          status: inc.status,
                          createdAt: inc.createdAt,
                          hasImage: false,
                        });
                        setIsModalOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-zinc-500">
                          {formatTime(inc.createdAt)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ${badge?.cls ?? ''}`}>
                          {badge?.label ?? 'ABIERTO'}
                        </span>
                      </div>
                      {(inc.propertyName || inc.stationName) && (
                        <p className="mt-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase truncate">
                          {inc.propertyName}{inc.stationName ? ` — ${inc.stationName}` : ''}
                        </p>
                      )}
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
                        {inc.refinedText}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Icons (inline, no deps)
// ---------------------------------------------------------------------------

function AgentIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function GpsIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500/80" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}
