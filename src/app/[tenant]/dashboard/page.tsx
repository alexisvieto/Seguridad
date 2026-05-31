'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttendanceMetrics {
  totalShifts: number;
  uniqueAgents: number;
  lateCount: number;
  absentDays: number;
}

interface TopAgent {
  name: string;
  shifts: number;
  lateCount: number;
}

interface FleetRank {
  plate: string;
  model: string;
  incidents: number;
}

interface AIChatResult {
  question: string;
  aiClassification: { category: string; answer: string };
  result: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardAnalyticsPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Date range
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0]!;
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]!);

  // Metrics
  const [attendance, setAttendance] = useState<AttendanceMetrics>({ totalShifts: 0, uniqueAgents: 0, lateCount: 0, absentDays: 0 });
  const [perfectAgents, setPerfectAgents] = useState<TopAgent[]>([]);
  const [punctualAgents, setPunctualAgents] = useState<TopAgent[]>([]);
  const [fleetRanking, setFleetRanking] = useState<FleetRank[]>([]);

  // AI Chat
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatResult, setChatResult] = useState<AIChatResult | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  // -------------------------------------------------------------------
  // Load data
  // -------------------------------------------------------------------

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!tenant) return;
    setTenantId(tenant.id);

    const fromISO = `${dateFrom}T00:00:00Z`;
    const toISO = `${dateTo}T23:59:59Z`;

    const [shiftsRes, membersRes, vehiclesRes, violationsRes] = await Promise.all([
      supabase.from('agent_shifts').select('user_id, clock_in')
        .eq('tenant_id', tenant.id).gte('clock_in', fromISO).lte('clock_in', toISO),
      supabase.from('memberships').select('user_id').eq('tenant_id', tenant.id).in('role', ['editor', 'admin']),
      supabase.from('fleet_vehicles').select('id, plate_number, brand_model').eq('tenant_id', tenant.id),
      supabase.from('geofence_violations').select('vehicle_id').eq('tenant_id', tenant.id),
    ]);

    const shifts = shiftsRes.data ?? [];
    const members = membersRes.data ?? [];

    // Attendance metrics
    const uniqueAgents = new Set(shifts.map((s) => s.user_id));
    let lateCount = 0;
    const shiftsByAgent = new Map<string, number>();
    const lateByAgent = new Map<string, number>();

    for (const s of shifts) {
      shiftsByAgent.set(s.user_id, (shiftsByAgent.get(s.user_id) ?? 0) + 1);
      const mins = new Date(s.clock_in).getUTCMinutes();
      const hour = new Date(s.clock_in).getUTCHours();
      if ((hour === 6 || hour === 18) && mins > 15) {
        lateCount++;
        lateByAgent.set(s.user_id, (lateByAgent.get(s.user_id) ?? 0) + 1);
      }
    }

    const totalDays = Math.ceil((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86400000);
    const expectedShifts = members.length * Math.round(totalDays * 0.85);
    const absentDays = Math.max(0, expectedShifts - shifts.length);

    setAttendance({ totalShifts: shifts.length, uniqueAgents: uniqueAgents.size, lateCount, absentDays });

    // Perfect attendance
    const maxShifts = Math.max(...shiftsByAgent.values(), 0);
    const perfectIds = [...shiftsByAgent.entries()]
      .filter(([, count]) => count >= maxShifts * 0.95)
      .map(([id]) => id);

    const { data: perfectProfiles } = perfectIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', perfectIds)
      : { data: [] };

    setPerfectAgents((perfectProfiles ?? []).map((p) => ({
      name: p.full_name, shifts: shiftsByAgent.get(p.id) ?? 0, lateCount: 0,
    })));

    // Punctual agents (zero late)
    const punctualIds = [...shiftsByAgent.keys()].filter((id) => !lateByAgent.has(id));
    const { data: punctualProfiles } = punctualIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', punctualIds)
      : { data: [] };

    setPunctualAgents((punctualProfiles ?? []).map((p) => ({
      name: p.full_name, shifts: shiftsByAgent.get(p.id) ?? 0, lateCount: 0,
    })));

    // Fleet ranking
    const violationCounts = new Map<string, number>();
    for (const v of violationsRes.data ?? []) {
      violationCounts.set(v.vehicle_id, (violationCounts.get(v.vehicle_id) ?? 0) + 1);
    }

    setFleetRanking(
      (vehiclesRes.data ?? [])
        .map((v) => ({ plate: v.plate_number, model: v.brand_model, incidents: violationCounts.get(v.id) ?? 0 }))
        .sort((a, b) => a.incidents - b.incidents),
    );

    setIsLoading(false);
  }, [tenantSlug, dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // AI Chat
  // -------------------------------------------------------------------

  const handleChat = useCallback(async () => {
    if (!chatQuestion.trim()) return;
    setChatLoading(true);
    setChatResult(null);

    try {
      const res = await fetch('/api/analytics/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: chatQuestion.trim() }),
      });

      if (res.ok) {
        const { data } = await res.json() as { data: AIChatResult };
        setChatResult(data);
      }
    } catch { /* silent */ } finally {
      setChatLoading(false);
    }
  }, [chatQuestion]);

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

      {/* HEADER + DATE RANGE */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/60 px-6 py-3">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Analitica Avanzada</p>
          <h1 className="text-lg font-bold">Dashboard Gerencial</h1>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none" />
          <span className="text-xs text-zinc-600">a</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none" />
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 border-b border-zinc-800/60 px-6 py-4">
        <KpiCard label="Turnos Registrados" value={String(attendance.totalShifts)} sub={`${attendance.uniqueAgents} agentes`} />
        <KpiCard label="Tardanzas" value={String(attendance.lateCount)} accent={attendance.lateCount > 0 ? 'amber' : undefined} sub="en el rango" />
        <KpiCard label="Ausencias Estimadas" value={String(attendance.absentDays)} accent={attendance.absentDays > 10 ? 'red' : undefined} sub="turnos sin marcacion" />
        <KpiCard label="Vehiculos en Flota" value={String(fleetRanking.length)} sub={`${fleetRanking.filter((v) => v.incidents === 0).length} sin incidencias`} />
      </div>

      {/* MAIN */}
      <div className="flex flex-1 gap-6 overflow-hidden p-6">

        {/* LEFT: Rankings */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">

          {/* Perfect Attendance */}
          <div className="rounded-2xl border border-zinc-800/40 bg-zinc-800/20 p-5">
            <h2 className="text-xs font-semibold tracking-widest text-emerald-500 uppercase">Record de Asistencia Perfecta</h2>
            <p className="mt-1 text-[11px] text-zinc-600">Agentes con mayor numero de turnos en el rango seleccionado</p>
            {perfectAgents.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-600">Sin datos en el rango seleccionado</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {perfectAgents.slice(0, 5).map((a, i) => (
                  <li key={a.name} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
                      }`}>{i + 1}</span>
                      <span className="text-sm text-zinc-200">{a.name}</span>
                    </div>
                    <span className="text-sm tabular-nums text-emerald-400 font-semibold">{a.shifts} turnos</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Punctuality */}
          <div className="rounded-2xl border border-zinc-800/40 bg-zinc-800/20 p-5">
            <h2 className="text-xs font-semibold tracking-widest text-blue-400 uppercase">Puntualidad de Hierro</h2>
            <p className="mt-1 text-[11px] text-zinc-600">Agentes con cero tardanzas registradas</p>
            {punctualAgents.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-600">Todos los agentes registran tardanzas</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {punctualAgents.slice(0, 5).map((a) => (
                  <li key={a.name} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-4 py-2.5">
                    <span className="text-sm text-zinc-200">{a.name}</span>
                    <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-medium text-blue-400">0 tardanzas</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fleet Ranking */}
          <div className="rounded-2xl border border-zinc-800/40 bg-zinc-800/20 p-5">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Ranking Preservacion de Flota</h2>
            <p className="mt-1 text-[11px] text-zinc-600">Vehiculos ordenados por menor incidencias</p>
            {fleetRanking.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-600">Sin vehiculos registrados</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {fleetRanking.map((v, i) => (
                  <li key={v.plate} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
                      }`}>{i + 1}</span>
                      <div>
                        <span className="text-sm font-mono text-zinc-200">{v.plate}</span>
                        <span className="ml-2 text-xs text-zinc-500">{v.model}</span>
                      </div>
                    </div>
                    <span className={`text-sm tabular-nums font-medium ${v.incidents === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {v.incidents} incid.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: AI Chat */}
        <div className="flex w-[380px] shrink-0 flex-col rounded-2xl border border-zinc-800/40 bg-zinc-800/20">
          <div className="border-b border-zinc-800/40 px-5 py-4">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Asistente IA</h2>
            <p className="mt-1 text-[11px] text-zinc-600">Pregunte sobre sus datos operativos en lenguaje natural</p>
          </div>

          {/* Chat result */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {chatResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-600">Resultado</p>
                  <button
                    onClick={() => { setChatResult(null); setChatQuestion(''); }}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Nueva consulta
                  </button>
                </div>
                <div className="rounded-xl bg-zinc-700/30 px-4 py-3">
                  <p className="text-xs text-zinc-500">Pregunta</p>
                  <p className="mt-1 text-sm text-zinc-200">{chatResult.question}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
                  <p className="text-xs text-emerald-500/70">NexGuard360 IA</p>
                  <p className="mt-1 text-sm text-zinc-200">{chatResult.aiClassification.answer}</p>
                  <ChatResultData result={chatResult.result} />
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <AIIcon />
                <p className="text-xs text-zinc-500">Ejemplos de preguntas:</p>
                <div className="space-y-1.5">
                  {[
                    '¿Quien no falto en todo el año?',
                    '¿Quien llega siempre a tiempo?',
                    '¿Donde pierdo dinero en horas extras?',
                    '¿Cual es el Factor de Bradford?',
                    '¿Cual vehiculo cuesta mas por kilometro?',
                    '¿Cual vehiculo tiene menos daños?',
                  ].map((q) => (
                    <button key={q} onClick={() => { setChatQuestion(q); }}
                      className="block w-full rounded-lg bg-zinc-800/50 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="border-t border-zinc-800/40 px-4 py-3">
            <div className="flex gap-2">
              <input type="text" value={chatQuestion} onChange={(e) => setChatQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleChat(); }}
                placeholder="Pregunte algo..."
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
              <button onClick={handleChat} disabled={chatLoading || !chatQuestion.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 cursor-pointer">
                {chatLoading ? <Spinner /> : <SendIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChatResultData({ result }: { result: Record<string, unknown> }) {
  if (!result || typeof result !== 'object') return null;
  const type = result['type'] as string | undefined;

  // Agents list (attendance, punctuality, bradford)
  if ('agents' in result && Array.isArray(result['agents'])) {
    const agents = result['agents'] as Array<Record<string, unknown>>;
    const isBradford = type === 'bradford';

    return (
      <div className="mt-3">
        {'title' in result && <p className="text-[11px] font-semibold text-zinc-400 mb-2">{String(result['title'] ?? '')}</p>}
        <ul className="space-y-1">
          {agents.slice(0, 8).map((a, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2 text-xs">
              <span className="text-zinc-200">{String(a['name'] ?? '')}</span>
              <div className="flex items-center gap-3">
                {a['shifts'] !== undefined && <span className="text-emerald-400">{String(a['shifts'])} turnos</span>}
                {a['lateCount'] !== undefined && Number(a['lateCount']) === 0 && <span className="text-blue-400">0 tardanzas</span>}
                {isBradford && (
                  <>
                    <span className="tabular-nums text-zinc-400">{String(a['bradford'] ?? 0)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      a['severity'] === 'Critico' ? 'bg-red-500/15 text-red-400' :
                      a['severity'] === 'Alto' ? 'bg-amber-500/15 text-amber-400' :
                      a['severity'] === 'Moderado' ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-emerald-500/15 text-emerald-400'
                    }`}>{String(a['severity'] ?? '')}</span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Vehicles list (fleet, cpk)
  if ('vehicles' in result && Array.isArray(result['vehicles'])) {
    const vehicles = result['vehicles'] as Array<Record<string, unknown>>;
    const isCPK = type === 'fleet_cpk';

    return (
      <div className="mt-3">
        {'title' in result && <p className="text-[11px] font-semibold text-zinc-400 mb-2">{String(result['title'] ?? '')}</p>}
        <ul className="space-y-1">
          {vehicles.slice(0, 8).map((v, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2 text-xs">
              <span className="font-mono text-zinc-200">{String(v['plate'])} <span className="text-zinc-500">{String(v['model'] ?? '')}</span></span>
              <div className="flex items-center gap-3">
                {isCPK ? (
                  <>
                    <span className="tabular-nums text-zinc-300">B/.{String(v['cpk'] ?? 0)}/km</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      v['rating'] === 'Critico' ? 'bg-red-500/15 text-red-400' :
                      v['rating'] === 'Elevado' ? 'bg-amber-500/15 text-amber-400' :
                      v['rating'] === 'Normal' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-emerald-500/15 text-emerald-400'
                    }`}>{String(v['rating'] ?? '')}</span>
                  </>
                ) : (
                  <span className="text-emerald-400">{String(v['incidents'] ?? 0)} incid.</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Overtime breakdown (by agent + property + periods)
  if ('byAgent' in result || ('periods' in result && Array.isArray(result['periods']))) {
    const byAgent = (result['byAgent'] as Array<Record<string, unknown>> | undefined) ?? [];
    const byProperty = (result['byProperty'] as Array<Record<string, unknown>> | undefined) ?? [];
    const periods = (result['periods'] as Array<Record<string, unknown>> | undefined) ?? [];

    return (
      <div className="mt-3 space-y-4">
        {'title' in result && <p className="text-[11px] font-semibold text-zinc-400 mb-1">{String(result['title'] ?? '')}</p>}

        {/* By Property — WHERE */}
        {byProperty.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-amber-500/70 uppercase mb-1.5">Por propiedad (donde)</p>
            <ul className="space-y-1">
              {byProperty.map((p, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2 text-xs">
                  <div>
                    <span className="text-zinc-200 font-medium">{String(p['property'])}</span>
                    <span className="ml-2 text-zinc-500">{String(p['agents'])} agentes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">{String(p['overtimeHours'])}h</span>
                    <span className="text-amber-400 font-semibold">B/.{String(p['otCost'])}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* By Agent — WHO */}
        {byAgent.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase mb-1.5">Por agente (quien)</p>
            <ul className="space-y-1">
              {byAgent.map((a, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2 text-xs">
                  <span className="text-zinc-200">{String(a['name'])}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">{String(a['overtimeHours'])}h</span>
                    <span className="text-amber-400 font-semibold">B/.{String(a['otCost'])}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* By Period — WHEN */}
        {periods.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase mb-1.5">Por periodo (cuando)</p>
            <ul className="space-y-1">
              {periods.map((p, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2 text-xs">
                  <span className="text-zinc-200">{String(p['label'])}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">{String(p['overtimeHours'])}h</span>
                    <span className="text-amber-400">B/.{String(p['otCost'])}</span>
                    <span className="text-zinc-600">{String(p['otRatio'])}%</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result['totalOTCost'] !== undefined && (
          <div className="flex items-center justify-between border-t border-zinc-700/30 pt-2 text-xs">
            <span className="text-zinc-400">Costo total extras</span>
            <span className="font-bold text-amber-400">B/.{String(result['totalOTCost'])}</span>
          </div>
        )}
      </div>
    );
  }

  // Generic info
  if ('message' in result) {
    return <p className="mt-2 text-sm text-zinc-300">{String(result['message'])}</p>;
  }

  return null;
}

function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: 'amber' | 'red';
}) {
  const valueCls = accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : 'text-zinc-200';
  return (
    <div className={`rounded-xl border px-5 py-4 ${
      accent === 'red' ? 'border-red-500/20 bg-red-500/5' : accent === 'amber' ? 'border-amber-500/20 bg-amber-500/5' : 'border-zinc-700/30 bg-zinc-800/40'
    }`}>
      <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueCls}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function AIIcon() {
  return (
    <svg className="h-10 w-10 text-emerald-500/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}
