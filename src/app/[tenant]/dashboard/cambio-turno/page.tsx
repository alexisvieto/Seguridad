'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShiftType = 'diurno' | 'nocturno';

interface StationStatus {
  workStationId: string;
  stationName: string;
  propertyName: string;
  programmedAgentId: string | null;
  programmedAgentName: string | null;
  actualAgentId: string | null;
  actualAgentName: string | null;
  clockIn: string | null;
  status: 'on_time' | 'late' | 'no_show' | 'relief' | 'unassigned';
  lateMinutes: number;
  waitingAgentId: string | null;
  waitingAgentName: string | null;
}

interface EventRecord {
  id: string;
  workStationId: string;
  stationName: string;
  propertyName: string;
  eventType: string;
  programmedAgentName: string | null;
  actualAgentName: string | null;
  narrative: string;
  arrivalTime: string | null;
  waitingAgentName: string | null;
}

interface ShiftChangeData {
  reportId: string | null;
  reportStatus: string;
  shiftType: ShiftType;
  reportDate: string;
  stations: StationStatus[];
  events: EventRecord[];
  generalObservations: string;
  freePersonnel: string;
}

const statusConfig: Record<string, { label: string; icon: string; cls: string }> = {
  on_time: { label: 'Presente', icon: '●', cls: 'text-emerald-400' },
  late: { label: 'Tardanza', icon: '●', cls: 'text-amber-400' },
  no_show: { label: 'Ausencia', icon: '●', cls: 'text-red-400' },
  relief: { label: 'Relevista', icon: '●', cls: 'text-blue-400' },
  unassigned: { label: 'Sin asignar', icon: '○', cls: 'text-zinc-600' },
};

const eventTypes = [
  { value: 'ausencia', label: 'Ausencia' },
  { value: 'tardanza', label: 'Tardanza' },
  { value: 'suspension', label: 'Suspensión' },
  { value: 'permiso', label: 'Permiso' },
  { value: 'licencia', label: 'Licencia' },
  { value: 'induccion', label: 'Inducción' },
  { value: 'incapacidad', label: 'Incapacidad' },
  { value: 'turno_especial', label: 'Turno Especial' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CambioTurnoPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ShiftChangeData | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [shiftType, setShiftType] = useState<ShiftType>(() => new Date().getHours() < 12 ? 'diurno' : 'nocturno');

  // Event editing
  const [editingStation, setEditingStation] = useState<StationStatus | null>(null);
  const [eventType, setEventType] = useState('ausencia');
  const [narrative, setNarrative] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Report fields
  const [observations, setObservations] = useState('');
  const [freePersonnel, setFreePersonnel] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  // -------------------------------------------------------------------
  // Load tenant
  // -------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();
      if (tenant) setTenantId(tenant.id);
    })();
  }, [tenantSlug]);

  // -------------------------------------------------------------------
  // Load shift change data
  // -------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/shifts/change-report?tenant_id=${tenantId}&date=${selectedDate}&shift_type=${shiftType}`,
      );
      if (res.ok) {
        const { data: result } = await res.json() as { data: ShiftChangeData };
        setData(result);
        setObservations(result.generalObservations);
        setFreePersonnel(result.freePersonnel);
      }
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, [tenantId, selectedDate, shiftType]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Save event narrative
  // -------------------------------------------------------------------

  const handleSaveEvent = useCallback(async () => {
    if (!data?.reportId || !editingStation || !narrative.trim()) return;
    setSaving(true);
    setSaveMsg(null);

    try {
      const res = await fetch('/api/shifts/change-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_event',
          report_id: data.reportId,
          tenant_id: tenantId,
          work_station_id: editingStation.workStationId,
          event_type: eventType,
          programmed_agent_id: editingStation.programmedAgentId,
          actual_agent_id: editingStation.actualAgentId,
          narrative: narrative.trim(),
          arrival_time: editingStation.clockIn
            ? new Date(editingStation.clockIn).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false })
            : null,
          waiting_agent_id: editingStation.waitingAgentId,
        }),
      });

      if (res.ok) {
        setSaveMsg('Evento guardado');
        setEditingStation(null);
        setNarrative('');
        loadData();
      }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }, [data, editingStation, eventType, narrative, tenantId, loadData]);

  // -------------------------------------------------------------------
  // Save observations / free personnel
  // -------------------------------------------------------------------

  const handleSaveFields = useCallback(async () => {
    if (!data?.reportId) return;
    await fetch('/api/shifts/change-report', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_fields',
        report_id: data.reportId,
        general_observations: observations,
        free_personnel: freePersonnel,
      }),
    });
  }, [data, observations, freePersonnel]);

  // -------------------------------------------------------------------
  // Send report
  // -------------------------------------------------------------------

  const handleSend = useCallback(async () => {
    if (!data?.reportId || !tenantId) return;
    setSending(true);
    setSendMsg(null);

    await handleSaveFields();

    try {
      const res = await fetch('/api/shifts/change-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_report',
          report_id: data.reportId,
          tenant_id: tenantId,
        }),
      });

      if (res.ok) {
        setSendMsg('Reporte enviado a gerencia');
        loadData();
      }
    } catch { /* silent */ } finally {
      setSending(false);
    }
  }, [data, tenantId, handleSaveFields, loadData]);

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  const incidentStations = (data?.stations ?? []).filter(
    (s) => s.status === 'no_show' || s.status === 'late' || s.status === 'relief',
  );
  const okStations = (data?.stations ?? []).filter(
    (s) => s.status === 'on_time' || s.status === 'unassigned',
  );

  // -------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------

  if (!tenantId || isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/60 px-6 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Control Operativo</p>
          <h1 className="text-lg font-bold">Cambio de Turno</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
            <button
              onClick={() => setShiftType('diurno')}
              className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                shiftType === 'diurno' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Diurno 06-18
            </button>
            <button
              onClick={() => setShiftType('nocturno')}
              className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                shiftType === 'nocturno' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Nocturno 18-06
            </button>
          </div>
          {data?.reportStatus === 'enviado' && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
              ENVIADO
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT: Station Status + Event Documentation ─── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Incidents requiring documentation */}
          {incidentStations.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold tracking-widest text-red-400 uppercase mb-3">
                Incidencias Detectadas ({incidentStations.length})
              </h2>
              <div className="space-y-2">
                {incidentStations.map((s) => {
                  const cfg = statusConfig[s.status] ?? statusConfig['no_show']!;
                  const hasEvent = data?.events.some((e) => e.workStationId === s.workStationId);
                  const isEditing = editingStation?.workStationId === s.workStationId;
                  const existingEvent = data?.events.find((e) => e.workStationId === s.workStationId);

                  return (
                    <div key={s.workStationId} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 overflow-hidden">
                      {/* Station header */}
                      <div
                        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                        onClick={() => {
                          if (isEditing) {
                            setEditingStation(null);
                          } else {
                            setEditingStation(s);
                            setEventType(s.status === 'late' ? 'tardanza' : 'ausencia');
                            setNarrative(existingEvent?.narrative ?? '');
                            setSaveMsg(null);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-lg ${cfg.cls}`}>{cfg.icon}</span>
                          <div>
                            <p className="text-sm font-semibold text-zinc-200">
                              {s.propertyName} — {s.stationName}
                            </p>
                            <p className="text-xs text-zinc-500">
                              Programado: <span className="text-zinc-300">{s.programmedAgentName ?? '—'}</span>
                              {s.actualAgentName && s.status === 'relief' && (
                                <span> → Relevo: <span className="text-blue-400">{s.actualAgentName}</span></span>
                              )}
                              {s.status === 'late' && s.clockIn && (
                                <span> → Llegó: <span className="text-amber-400">
                                  {new Date(s.clockIn).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span> ({s.lateMinutes} min tarde)</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasEvent && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              Documentado
                            </span>
                          )}
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            s.status === 'no_show' ? 'bg-red-500/15 text-red-400' :
                            s.status === 'late' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-blue-500/15 text-blue-400'
                          }`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Existing narrative preview */}
                      {!isEditing && existingEvent?.narrative && (
                        <div className="border-t border-zinc-800/30 px-5 py-2.5 bg-zinc-800/10">
                          <p className="text-xs text-zinc-400 italic">{existingEvent.narrative}</p>
                        </div>
                      )}

                      {/* Expanded edit form */}
                      {isEditing && (
                        <div className="border-t border-zinc-800/30 px-5 py-4 space-y-3 bg-[#0A1020]/50">
                          <div className="flex items-center gap-3">
                            <select
                              value={eventType}
                              onChange={(e) => setEventType(e.target.value)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                            >
                              {eventTypes.map((et) => (
                                <option key={et.value} value={et.value}>{et.label}</option>
                              ))}
                            </select>
                            {s.waitingAgentName && (
                              <p className="text-[10px] text-zinc-500">
                                En espera: <span className="text-zinc-300">{s.waitingAgentName}</span>
                              </p>
                            )}
                          </div>
                          <textarea
                            value={narrative}
                            onChange={(e) => setNarrative(e.target.value)}
                            placeholder={`Describa lo sucedido en ${s.propertyName}...`}
                            rows={3}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { setEditingStation(null); setNarrative(''); }}
                              className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleSaveEvent}
                              disabled={saving || !narrative.trim()}
                              className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40 cursor-pointer"
                            >
                              {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                          {saveMsg && <p className="text-xs text-emerald-400">{saveMsg}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All OK stations */}
          <div>
            <h2 className="text-xs font-semibold tracking-widest text-emerald-500 uppercase mb-3">
              Puestos Cubiertos ({okStations.length})
            </h2>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {okStations.map((s) => (
                <div key={s.workStationId} className="flex items-center gap-2 rounded-lg border border-zinc-800/30 bg-zinc-800/10 px-4 py-2.5">
                  <span className="text-emerald-400 text-xs">●</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-300 truncate">{s.stationName}</p>
                    <p className="text-[10px] text-zinc-600 truncate">{s.actualAgentName ?? s.propertyName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documented events summary */}
          {(data?.events.length ?? 0) > 0 && (
            <div>
              <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-3">
                Eventos Documentados ({data?.events.length})
              </h2>
              <div className="space-y-1.5">
                {data?.events.map((e) => (
                  <div key={e.id} className="rounded-lg border border-zinc-800/30 bg-zinc-800/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 uppercase">
                        {e.eventType}
                      </span>
                      <span className="text-xs font-medium text-zinc-300">{e.propertyName} — {e.stationName}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{e.narrative}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Report Controls ─── */}
        <div className="w-[360px] shrink-0 border-l border-zinc-800/60 overflow-y-auto p-6 space-y-5">

          <div className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 p-5">
            <h3 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-1">
              Informe del Turno {shiftType === 'diurno' ? 'Diurno' : 'Nocturno'}
            </h3>
            <p className="text-[10px] text-zinc-600 mb-4">
              {new Date(selectedDate).toLocaleDateString('es-PA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2 text-center">
                <p className="text-lg font-bold text-emerald-400">{okStations.length}</p>
                <p className="text-[9px] text-zinc-500">Cubiertos</p>
              </div>
              <div className="rounded-lg bg-red-500/8 border border-red-500/20 px-3 py-2 text-center">
                <p className="text-lg font-bold text-red-400">{incidentStations.filter((s) => s.status === 'no_show').length}</p>
                <p className="text-[9px] text-zinc-500">Ausencias</p>
              </div>
              <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 text-center">
                <p className="text-lg font-bold text-amber-400">{incidentStations.filter((s) => s.status === 'late').length}</p>
                <p className="text-[9px] text-zinc-500">Tardanzas</p>
              </div>
            </div>

            {/* Free personnel */}
            <div className="mb-4">
              <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Personal Libre del Turno</label>
              <textarea
                value={freePersonnel}
                onChange={(e) => setFreePersonnel(e.target.value)}
                onBlur={handleSaveFields}
                placeholder="Nombre de cada agente libre, uno por línea..."
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>

            {/* General observations */}
            <div className="mb-5">
              <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Observaciones Generales</label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                onBlur={handleSaveFields}
                placeholder="Todos los puestos se mantuvieron debidamente cubiertos..."
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>

            {/* PDF link */}
            {data?.reportId && (
              <a
                href={`/api/shifts/change-report/pdf?report_id=${data.reportId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer mb-3"
              >
                <PdfIcon />
                Exportar PDF
              </a>
            )}

            {/* Send button */}
            {data?.reportStatus !== 'enviado' ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-40 cursor-pointer"
              >
                {sending ? 'Enviando...' : 'Enviar Reporte a Gerencia'}
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-center">
                <p className="text-sm font-medium text-emerald-400">Reporte enviado</p>
              </div>
            )}

            {sendMsg && (
              <p className="mt-2 text-xs text-emerald-400 text-center">{sendMsg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PdfIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
