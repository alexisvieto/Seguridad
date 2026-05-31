'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssignmentType = 'fijo' | 'temporal' | 'mensual';

interface Assignment {
  id: string;
  user_id: string;
  work_station_id: string;
  assignment_type: AssignmentType;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  notes: string;
  profiles: { full_name: string } | null;
  work_stations: { name: string; properties_ph: { name: string } | null } | null;
}

interface AgentOption {
  userId: string;
  fullName: string;
  occupied: boolean;
  occupiedAt: string | null;
}

interface StationOption {
  id: string;
  name: string;
  propertyName: string;
}

const typeConfig: Record<AssignmentType, {
  label: string;
  description: string;
  activeClass: string;
  textClass: string;
  badgeClass: string;
}> = {
  fijo: {
    label: 'Fijo',
    description: 'Indefinido — sin fecha de fin',
    activeClass: 'border-emerald-500/40 bg-emerald-500/10',
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-400',
  },
  temporal: {
    label: 'Temporal',
    description: 'Cobertura por rango de días',
    activeClass: 'border-amber-500/40 bg-amber-500/10',
    textClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-400',
  },
  mensual: {
    label: 'Mensual',
    description: 'Rotación mensual completa',
    activeClass: 'border-blue-500/40 bg-blue-500/10',
    textClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/15 text-blue-400',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TurnosPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);

  // Form state
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('temporal');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0]!;
  });
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('18:00');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [notes, setNotes] = useState('');

  // View date (for the right panel)
  const [viewDate, setViewDate] = useState(() => new Date().toISOString().split('T')[0]!);

  // Agent availability
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Conflict & submission
  const [conflict, setConflict] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // -------------------------------------------------------------------
  // Load initial data
  // -------------------------------------------------------------------

  const loadInitial = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (!tenant) return;
    setTenantId(tenant.id);

    const { data: ws } = await supabase
      .from('work_stations')
      .select('id, name, properties_ph(name)')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name');

    setStations(
      (ws ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        propertyName: (s.properties_ph as { name: string } | null)?.name ?? '',
      })),
    );

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // -------------------------------------------------------------------
  // Load assignments for view date
  // -------------------------------------------------------------------

  const loadAssignments = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/shifts/assignments?tenant_id=${tenantId}&date=${viewDate}`);
      if (res.ok) {
        const { data } = await res.json() as { data: Assignment[] };
        setAssignments(data);
      }
    } catch { /* network error — UI already shows empty state */ }
  }, [tenantId, viewDate]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // -------------------------------------------------------------------
  // Load available agents when params change
  // -------------------------------------------------------------------

  const loadAgents = useCallback(async () => {
    if (!tenantId || !startTime || !endTime || startTime === endTime) return;
    setAgentsLoading(true);
    try {
      const res = await fetch(
        `/api/shifts/assignments?tenant_id=${tenantId}&date=${startDate}&mode=available_agents&start_time=${startTime}&end_time=${endTime}`,
      );
      if (res.ok) {
        const { data } = await res.json() as { data: AgentOption[] };
        setAgents(data);
      }
    } catch { /* network error */ } finally {
      setAgentsLoading(false);
    }
  }, [tenantId, startDate, startTime, endTime]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // -------------------------------------------------------------------
  // Submit assignment
  // -------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!tenantId || !selectedAgent || !selectedStation) return;

    setConflict(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/shifts/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: selectedAgent,
          work_station_id: selectedStation,
          assignment_type: assignmentType,
          start_date: startDate,
          end_date: assignmentType === 'fijo' ? null : endDate,
          start_time: startTime,
          end_time: endTime,
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        try {
          const err = await res.json() as Record<string, unknown>;
          const errorField = err['error'];
          let msg = 'Error al crear la asignación';
          if (typeof errorField === 'string') {
            msg = errorField;
          } else if (errorField && typeof errorField === 'object' && 'message' in errorField) {
            msg = String((errorField as { message: unknown }).message);
          }
          setConflict(msg);
        } catch {
          setConflict('Error al crear la asignación');
        }
        return;
      }

      setSuccessMsg('Asignación creada exitosamente');
      setSelectedAgent('');
      setSelectedStation('');
      setNotes('');
      // Sync right panel to show the new assignment
      setViewDate(startDate);
      loadAssignments();
      loadAgents();
    } catch {
      setConflict('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  }, [tenantId, selectedAgent, selectedStation, assignmentType, startDate, endDate, startTime, endTime, notes, loadAssignments, loadAgents]);

  // Reload assignments when viewDate changes (including after creation sync)
  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // -------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/shifts/assignments?id=${id}`, { method: 'DELETE' });
      loadAssignments();
      loadAgents();
    } catch { /* network error */ }
  }, [loadAssignments, loadAgents]);

  // -------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Gestión Operativa</p>
          <h1 className="text-lg font-bold">Programación de Turnos</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT: Assignment Form ─── */}
        <div className="w-[440px] shrink-0 border-r border-zinc-800/60 overflow-y-auto p-6">
          <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-5">
            Nueva Asignación
          </h2>

          <div className="space-y-5">

            {/* Assignment type selector */}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wide mb-2 block">Tipo de Asignación</label>
              <div className="grid grid-cols-3 gap-2">
                {(['fijo', 'temporal', 'mensual'] as AssignmentType[]).map((type) => {
                  const cfg = typeConfig[type];
                  const isActive = assignmentType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setAssignmentType(type)}
                      className={`rounded-xl border px-3 py-3 text-left transition-all cursor-pointer ${
                        isActive
                          ? cfg.activeClass
                          : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'
                      }`}
                    >
                      <p className={`text-xs font-bold ${isActive ? cfg.textClass : 'text-zinc-300'}`}>
                        {cfg.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-600">{cfg.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wide">
                  {assignmentType === 'fijo' ? 'Fecha Inicio' : 'Desde'}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              {assignmentType !== 'fijo' && (
                <div>
                  <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Hasta</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}
              {assignmentType === 'fijo' && (
                <div className="flex items-end pb-2">
                  <p className="text-xs text-zinc-600 italic">Sin fecha de fin (indefinido)</p>
                </div>
              )}
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Hora Inicio</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Hora Fin</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Station */}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Puesto</label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Seleccionar puesto...</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.propertyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Agent selector */}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wide">
                Agente {agentsLoading && <span className="text-zinc-600">(cargando...)</span>}
              </label>
              <select
                value={selectedAgent}
                onChange={(e) => { setSelectedAgent(e.target.value); setConflict(null); }}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Seleccionar agente...</option>
                {agents.map((a) => (
                  <option
                    key={a.userId}
                    value={a.userId}
                    disabled={a.occupied}
                    className={a.occupied ? 'text-zinc-600' : ''}
                  >
                    {a.fullName}{a.occupied ? ` (Ocupado en ${a.occupiedAt})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Notas (opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Cobertura vacaciones, refuerzo temporal..."
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Conflict message */}
            {conflict && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3">
                <p className="text-sm font-medium text-red-400">{conflict}</p>
              </div>
            )}

            {/* Success message */}
            {successMsg && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
                <p className="text-sm font-medium text-emerald-400">{successMsg}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedAgent || !selectedStation || startTime === endTime}
              className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Guardando...' : 'Asignar Turno'}
            </button>
          </div>
        </div>

        {/* ─── RIGHT: Assignments view ─── */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
              Asignaciones Activas
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-600">Ver día:</label>
              <input
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
              />
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs tabular-nums text-zinc-400">
                {assignments.length}
              </span>
            </div>
          </div>

          {assignments.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-zinc-800/40 bg-zinc-800/10">
              <p className="text-sm text-zinc-600">No hay asignaciones activas para esta fecha</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => {
                const cfg = typeConfig[a.assignment_type];
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-5 py-3.5 transition-colors hover:bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-4">
                      {/* Time block */}
                      <div className="flex flex-col items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 min-w-[60px]">
                        <span className="text-xs font-bold tabular-nums text-emerald-400">{a.start_time.slice(0, 5)}</span>
                        <span className="text-[9px] text-zinc-600">a</span>
                        <span className="text-xs font-bold tabular-nums text-emerald-400">{a.end_time.slice(0, 5)}</span>
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-200">
                            {a.profiles?.full_name ?? 'Agente'}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${cfg.badgeClass}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {a.work_stations?.name ?? 'Puesto'}
                          {a.work_stations?.properties_ph?.name && (
                            <span className="text-zinc-600"> — {a.work_stations.properties_ph.name}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {a.start_date}
                          {a.end_date ? ` → ${a.end_date}` : ' → Indefinido'}
                        </p>
                        {a.notes && (
                          <p className="mt-0.5 text-[10px] text-zinc-600 italic">{a.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                      title="Eliminar asignación"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
