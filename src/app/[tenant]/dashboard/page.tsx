'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiData {
  monthlyRevenue: number;
  activeContracts: number;
  totalAgents: number;
  agentsRequired: number;
  firearmsInPuestos: number;
  firearmsInAgents: number;
  firearmsInArmory: number;
  vehiclesActive: number;
  vehiclesInShop: number;
  openTickets: number;
}

interface ContractExpiring {
  id: string;
  clientName: string;
  endDate: string;
  monthlyAmount: number;
  daysLeft: number;
}

interface PermitExpiring {
  id: string;
  serialNumber: string;
  type: string;
  brand: string;
  model: string;
  permitNumber: string;
  permitExpiry: string;
  daysLeft: number;
}

interface ModelGroup {
  key: string;
  brand: string;
  model: string;
  type: string;
  count: number;
}

interface LocationInventory {
  id: string;
  name: string;
  total: number;
  models: ModelGroup[];
}

interface PayrollSummary {
  periodLabel: string;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  agentCount: number;
}

interface AIChatResult {
  question: string;
  aiClassification: { category: string; answer: string };
  result: Record<string, unknown>;
}

function fmt(n: number): string {
  return n.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardGerencialPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kpi, setKpi] = useState<KpiData>({ monthlyRevenue: 0, activeContracts: 0, totalAgents: 0, agentsRequired: 0, firearmsInPuestos: 0, firearmsInAgents: 0, firearmsInArmory: 0, vehiclesActive: 0, vehiclesInShop: 0, openTickets: 0 });
  const [contractsExpiring, setContractsExpiring] = useState<ContractExpiring[]>([]);
  const [permitsExpiring, setPermitsExpiring] = useState<PermitExpiring[]>([]);
  const [locationInventory, setLocationInventory] = useState<LocationInventory[]>([]);
  const [payroll, setPayroll] = useState<PayrollSummary | null>(null);

  // AI Chat
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatResult, setChatResult] = useState<AIChatResult | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;
    setTenantId(tenant.id);

    const [contractsRes, membersRes, firearmsRes, assignmentsRes, vehiclesRes, ticketsRes, locsRes, payrollRes] = await Promise.all([
      supabase.from('commercial_contracts').select('id, client_id, start_date, end_date, monthly_amount, agents_required, status, commercial_clients(company_name)').eq('tenant_id', tenant.id),
      supabase.from('memberships').select('user_id').eq('tenant_id', tenant.id),
      supabase.from('firearms_inventory').select('id, serial_number, type, brand, model, permit_number, permit_expiry_date, status, location_id').eq('tenant_id', tenant.id),
      supabase.from('firearms_assignments').select('firearm_id, work_station_id, user_id').eq('tenant_id', tenant.id).is('returned_at', null),
      supabase.from('fleet_vehicles').select('id, status').eq('tenant_id', tenant.id),
      supabase.from('client_tickets').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).in('status', ['abierto', 'en_proceso']),
      supabase.from('firearm_locations').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('payroll_periods').select('id, start_date, end_date, status').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(1),
    ]);

    const contracts = contractsRes.data ?? [];
    const activeContracts = contracts.filter((c) => c.status === 'activo' || c.status === 'vigente');
    const monthlyRevenue = activeContracts.reduce((sum, c) => sum + Number(c.monthly_amount), 0);
    const agentsRequired = activeContracts.reduce((sum, c) => sum + c.agents_required, 0);

    const firearms = firearmsRes.data ?? [];
    const activeAssigns = assignmentsRes.data ?? [];
    const firearmsInPuestos = activeAssigns.filter((a) => 'work_station_id' in a && a.work_station_id !== null).length;
    const firearmsInAgents = activeAssigns.filter((a) => 'user_id' in a && a.user_id !== null).length;

    const vehicles = vehiclesRes.data ?? [];

    setKpi({
      monthlyRevenue,
      activeContracts: activeContracts.length,
      totalAgents: (membersRes.data ?? []).length,
      agentsRequired,
      firearmsInPuestos,
      firearmsInAgents,
      firearmsInArmory: firearms.length - firearmsInPuestos - firearmsInAgents,
      vehiclesActive: vehicles.filter((v) => v.status === 'activo').length,
      vehiclesInShop: vehicles.filter((v) => v.status === 'taller').length,
      openTickets: ticketsRes.count ?? 0,
    });

    // Contracts expiring in 60 days
    setContractsExpiring(
      contracts
        .filter((c) => c.end_date && daysUntil(c.end_date) <= 60 && daysUntil(c.end_date) > 0)
        .map((c) => ({
          id: c.id,
          clientName: (c.commercial_clients as { company_name: string } | null)?.company_name ?? '',
          endDate: c.end_date!,
          monthlyAmount: Number(c.monthly_amount),
          daysLeft: daysUntil(c.end_date!),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft),
    );

    // Permits expiring in 6 months (180 days)
    setPermitsExpiring(
      firearms
        .filter((f) => daysUntil(f.permit_expiry_date) <= 180 && daysUntil(f.permit_expiry_date) > -30)
        .map((f) => ({
          id: f.id,
          serialNumber: f.serial_number,
          type: f.type,
          brand: f.brand,
          model: f.model,
          permitNumber: f.permit_number,
          permitExpiry: f.permit_expiry_date,
          daysLeft: daysUntil(f.permit_expiry_date),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft),
    );

    // Location inventory grouped by model
    const assignedFirearmIds = new Set(activeAssigns.map((a) => a.firearm_id));
    const locMap = new Map<string, { name: string; models: Map<string, { brand: string; model: string; type: string; count: number }> }>();
    for (const l of locsRes.data ?? []) locMap.set(l.id, { name: l.name, models: new Map() });
    for (const f of firearms) {
      if (f.location_id && !assignedFirearmIds.has(f.id) && locMap.has(f.location_id)) {
        const loc = locMap.get(f.location_id)!;
        const key = `${f.brand}-${f.model}-${f.type}`;
        const existing = loc.models.get(key);
        if (existing) {
          existing.count++;
        } else {
          loc.models.set(key, { brand: f.brand, model: f.model, type: f.type, count: 1 });
        }
      }
    }
    setLocationInventory([...locMap.entries()].map(([id, v]) => {
      const models = [...v.models.entries()].map(([key, m]) => ({ key, ...m }));
      return { id, name: v.name, total: models.reduce((s, m) => s + m.count, 0), models };
    }));

    // Payroll summary
    const lastPeriod = (payrollRes.data ?? [])[0];
    if (lastPeriod) {
      const { data: consolidated } = await supabase
        .from('payroll_agent_consolidated')
        .select('gross_salary, social_security_deduction, educational_insurance_deduction, net_salary')
        .eq('payroll_period_id', lastPeriod.id);

      if (consolidated && consolidated.length > 0) {
        const totalDeductions = consolidated.reduce((s, c) => s + Number(c.social_security_deduction) + Number(c.educational_insurance_deduction), 0);
        setPayroll({
          periodLabel: `${new Date(lastPeriod.start_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'short' })} — ${new Date(lastPeriod.end_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'short' })}`,
          totalGross: consolidated.reduce((s, c) => s + Number(c.gross_salary), 0),
          totalNet: consolidated.reduce((s, c) => s + Number(c.net_salary), 0),
          totalDeductions,
          agentCount: consolidated.length,
        });
      }
    }

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // Dismiss permit alert
  const dismissPermit = useCallback((id: string) => {
    setPermitsExpiring((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // AI Chat
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
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Vista Ejecutiva</p>
          <h1 className="text-lg font-bold">Dashboard Gerencial</h1>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 border-b border-zinc-800/60 px-6 py-4 lg:grid-cols-6">
        <KpiCard label="Facturación Mensual" value={`B/.${fmt(kpi.monthlyRevenue)}`} color="lime" />
        <KpiCard label="Contratos Activos" value={String(kpi.activeContracts)} color="default" />
        <KpiCard label="Agentes / Requeridos" value={`${kpi.totalAgents} / ${kpi.agentsRequired}`} color={kpi.totalAgents < kpi.agentsRequired ? 'red' : 'default'} />
        <KpiCard label="Armas en Puestos" value={String(kpi.firearmsInPuestos)} sub={`${kpi.firearmsInAgents} en agentes · ${kpi.firearmsInArmory} en armería`} color="default" />
        <KpiCard label="Flota Activa" value={String(kpi.vehiclesActive)} sub={kpi.vehiclesInShop > 0 ? `${kpi.vehiclesInShop} en taller` : undefined} color={kpi.vehiclesInShop > 0 ? 'amber' : 'default'} />
        <KpiCard label="Tickets Abiertos" value={String(kpi.openTickets)} color={kpi.openTickets > 0 ? 'red' : 'default'} />
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Contracts expiring */}
          {contractsExpiring.length > 0 && (
            <Section title="Contratos por Vencer" count={contractsExpiring.length} accent="amber">
              {contractsExpiring.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{c.clientName}</p>
                    <p className="text-xs text-zinc-500">B/.{fmt(c.monthlyAmount)}/mes · Vence {new Date(c.endDate).toLocaleDateString('es-PA', { day: '2-digit', month: 'short' })}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${c.daysLeft <= 15 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {c.daysLeft} días
                  </span>
                </div>
              ))}
            </Section>
          )}

          {/* Permits expiring */}
          {permitsExpiring.length > 0 && (
            <Section title="Permisos DIASP por Vencer" count={permitsExpiring.length} accent="red">
              {permitsExpiring.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{p.brand} {p.model}</p>
                    <p className="text-xs text-zinc-500 font-mono">{p.serialNumber} · {p.permitNumber}</p>
                    <p className="text-xs text-zinc-600">Vence: {new Date(p.permitExpiry).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${p.daysLeft <= 30 ? 'bg-red-500/15 text-red-400' : p.daysLeft <= 90 ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-500/15 text-zinc-400'}`}>
                      {p.daysLeft <= 0 ? 'VENCIDO' : `${p.daysLeft} días`}
                    </span>
                    <button onClick={() => dismissPermit(p.id)}
                      className="rounded-lg bg-lime-600/20 px-3 py-1 text-[10px] font-semibold text-lime-400 hover:bg-lime-600/30 cursor-pointer">
                      Resuelto
                    </button>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Location inventory grouped by model */}
          {locationInventory.length > 0 && (
            <Section title="Inventario por Armería" count={locationInventory.reduce((s, l) => s + l.total, 0)} accent="default">
              <div className="space-y-3">
                {locationInventory.map((loc) => (
                  <div key={loc.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/30">
                      <p className="text-sm font-semibold text-zinc-100">{loc.name}</p>
                      <span className="rounded-full bg-lime-500/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-lime-400">{loc.total} armas</span>
                    </div>
                    {loc.models.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-zinc-600">Sin armas en esta ubicación</p>
                    ) : (
                      <div className="divide-y divide-zinc-800/20">
                        {loc.models.map((m) => (
                          <div key={m.key} className="flex items-center justify-between px-4 py-2.5">
                            <p className="text-sm text-zinc-200">
                              <span className="font-medium">{m.brand}</span>
                              <span className="text-zinc-400"> {m.model}</span>
                              <span className="text-zinc-600"> · {m.type === 'pistola' ? 'Pistola' : m.type === 'revolver' ? 'Revólver' : 'Escopeta'}</span>
                            </p>
                            <span className="text-sm font-bold tabular-nums text-lime-400 shrink-0 ml-3">{m.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Payroll summary */}
          {payroll && (
            <Section title={`Nómina — ${payroll.periodLabel}`} accent="default">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg bg-zinc-800/30 px-4 py-3 text-center">
                  <p className="text-lg font-bold tabular-nums text-zinc-200">B/.{fmt(payroll.totalGross)}</p>
                  <p className="text-[10px] text-zinc-500">Bruto</p>
                </div>
                <div className="rounded-lg bg-zinc-800/30 px-4 py-3 text-center">
                  <p className="text-lg font-bold tabular-nums text-red-400">B/.{fmt(payroll.totalDeductions)}</p>
                  <p className="text-[10px] text-zinc-500">Deducciones</p>
                </div>
                <div className="rounded-lg bg-zinc-800/30 px-4 py-3 text-center">
                  <p className="text-lg font-bold tabular-nums text-lime-400">B/.{fmt(payroll.totalNet)}</p>
                  <p className="text-[10px] text-zinc-500">Neto</p>
                </div>
                <div className="rounded-lg bg-zinc-800/30 px-4 py-3 text-center">
                  <p className="text-lg font-bold tabular-nums text-zinc-200">{payroll.agentCount}</p>
                  <p className="text-[10px] text-zinc-500">Agentes</p>
                </div>
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT: AI Chat */}
        <div className="hidden lg:flex w-[380px] shrink-0 flex-col border-l border-zinc-800/60">
          <div className="border-b border-zinc-800/40 px-5 py-4">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Asistente IA</h2>
            <p className="mt-1 text-[11px] text-zinc-600">Pregunte sobre sus datos operativos</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {chatResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-600">Resultado</p>
                  <button onClick={() => { setChatResult(null); setChatQuestion(''); }}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer">Nueva consulta</button>
                </div>
                <div className="rounded-xl bg-zinc-700/30 px-4 py-3">
                  <p className="text-xs text-zinc-500">Pregunta</p>
                  <p className="mt-1 text-sm text-zinc-200">{chatResult.question}</p>
                </div>
                <div className="rounded-xl bg-lime-500/5 border border-lime-500/20 px-4 py-3">
                  <p className="text-xs text-lime-500/70">NexGuard360 IA</p>
                  <p className="mt-1 text-sm text-zinc-200">{chatResult.aiClassification.answer}</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <svg className="h-10 w-10 text-lime-500/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                <p className="text-xs text-zinc-500">Ejemplos:</p>
                <div className="space-y-1.5 w-full">
                  {[
                    '¿Dónde pierdo dinero en horas extras?',
                    '¿Cuántos contratos están por vencer?',
                    '¿Cuál es el Bradford Factor de mis agentes?',
                  ].map((q) => (
                    <button key={q} onClick={() => setChatQuestion(q)}
                      className="block w-full rounded-lg bg-zinc-800/50 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800/40 px-4 py-3">
            <div className="flex gap-2">
              <input type="text" value={chatQuestion} onChange={(e) => setChatQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleChat(); }}
                placeholder="Pregunte algo..."
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none" />
              <button onClick={handleChat} disabled={chatLoading || !chatQuestion.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-600 text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                {chatLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
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

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: 'lime' | 'red' | 'amber' | 'default' }) {
  const cls = color === 'lime' ? 'border-lime-500/20 bg-lime-500/5'
    : color === 'red' ? 'border-red-500/20 bg-red-500/5'
    : color === 'amber' ? 'border-amber-500/20 bg-amber-500/5'
    : 'border-zinc-700/30 bg-zinc-800/40';
  const valCls = color === 'lime' ? 'text-lime-400' : color === 'red' ? 'text-red-400' : color === 'amber' ? 'text-amber-400' : 'text-zinc-200';

  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <p className="text-[10px] font-medium tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

function Section({ title, count, accent, children }: { title: string; count?: number; accent: 'lime' | 'red' | 'amber' | 'default'; children: React.ReactNode }) {
  const accentCls = accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : accent === 'lime' ? 'text-lime-400' : 'text-zinc-400';
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className={`text-xs font-semibold tracking-widest uppercase ${accentCls}`}>{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] tabular-nums text-zinc-400">{count}</span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
