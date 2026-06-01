'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { generatePanamaACH, type ACHGenerationResult } from '@/lib/payroll/ach-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeriodInfo {
  id: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  status: 'abierto' | 'calculado' | 'cerrado_pagado';
}

interface AgentPayroll {
  id: string;
  userId: string;
  agentName: string;
  ratePerHour: number;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  addition: number;
  deduction: number;
  gross: number;
  ss: number;
  ei: number;
  net: number;
}

interface Toast {
  type: 'success' | 'error';
  msg: string;
}

interface ACHWarning {
  agentName: string;
  missingFields: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PA', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatCurrency(v: number): string {
  return v.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  abierto: { label: 'Abierto', cls: 'bg-blue-500/15 text-blue-400 ring-blue-500/30' },
  calculado: { label: 'Calculado', cls: 'bg-amber-500/15 text-amber-400 ring-amber-500/30' },
  cerrado_pagado: { label: 'Cerrado / Pagado', cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' },
};

const SS_RATE = 0.0975;
const EI_RATE = 0.0125;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PayrollPeriodPage() {
  const params = useParams<{ tenant: string; periodId: string }>();
  const tenantSlug = params.tenant;
  const periodId = params.periodId;

  const [period, setPeriod] = useState<PeriodInfo | null>(null);
  const [agents, setAgents] = useState<AgentPayroll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'recalc' | 'export' | 'close' | null>(null);
  const [achWarnings, setAchWarnings] = useState<ACHWarning[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);

  const debounceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const agentsRef = useRef(agents);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

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

    const { data: tenant } = await supabase
      .from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!tenant) return;

    const { data: periodData } = await supabase
      .from('payroll_periods')
      .select('id, tenant_id, start_date, end_date, status')
      .eq('id', periodId)
      .maybeSingle();

    if (!periodData) { setIsLoading(false); return; }

    setPeriod({
      id: periodData.id,
      tenantId: periodData.tenant_id,
      startDate: periodData.start_date,
      endDate: periodData.end_date,
      status: periodData.status as PeriodInfo['status'],
    });

    const { data: consolidated } = await supabase
      .from('payroll_agent_consolidated')
      .select('*')
      .eq('payroll_period_id', periodId)
      .order('net_salary', { ascending: false });

    const userIds = (consolidated ?? []).map((c) => c.user_id);
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    setAgents(
      (consolidated ?? []).map((c) => ({
        id: c.id,
        userId: c.user_id,
        agentName: nameMap.get(c.user_id) ?? 'Agente',
        ratePerHour: Number(c.rate_per_hour),
        regularHours: Number(c.regular_hours_accumulated),
        overtimeHours: Number(c.overtime_hours_accumulated),
        holidayHours: Number(c.holiday_hours_accumulated),
        addition: Number(c.adjustments_addition),
        deduction: Number(c.adjustments_deduction),
        gross: Number(c.gross_salary),
        ss: Number(c.social_security_deduction),
        ei: Number(c.educational_insurance_deduction),
        net: Number(c.net_salary),
      })),
    );

    setIsLoading(false);
  }, [tenantSlug, periodId]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Inline editing with debounced save
  // -------------------------------------------------------------------

  const handleAdjustment = useCallback((
    agentId: string,
    field: 'addition' | 'deduction',
    value: number,
  ) => {
    // Optimistic local update with correct CSS/SE calculation (before deductions)
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== agentId) return a;

        const newAddition = field === 'addition' ? value : a.addition;
        const newDeduction = field === 'deduction' ? value : a.deduction;

        const totalHours = a.regularHours + a.overtimeHours + a.holidayHours;
        const basePay = r2(totalHours * a.ratePerHour);
        const gross = r2(basePay + newAddition);
        const ss = r2(gross * SS_RATE);
        const ei = r2(gross * EI_RATE);
        const net = r2(Math.max(0, gross - ss - ei - newDeduction));

        return { ...a, addition: newAddition, deduction: newDeduction, gross, ss, ei, net };
      }),
    );

    // Debounced DB save — uses ref to avoid stale closure
    const existing = debounceTimers.current.get(agentId);
    if (existing) clearTimeout(existing);

    debounceTimers.current.set(
      agentId,
      setTimeout(async () => {
        const agent = agentsRef.current.find((a) => a.id === agentId);
        if (!agent) return;

        const supabase = getSupabaseBrowserClient();
        await supabase
          .from('payroll_agent_consolidated')
          .update({
            adjustments_addition: agent.addition,
            adjustments_deduction: agent.deduction,
            gross_salary: agent.gross,
            social_security_deduction: agent.ss,
            educational_insurance_deduction: agent.ei,
            net_salary: agent.net,
          })
          .eq('id', agentId);
      }, 800),
    );
  }, []);

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

  const handleRecalculate = useCallback(async () => {
    if (!period) return;
    setActionLoading('recalc');

    try {
      const supabase = getSupabaseBrowserClient();

      // Reopen period if calculated
      if (period.status === 'calculado') {
        await supabase.from('payroll_periods').update({ status: 'abierto' }).eq('id', periodId);
      }

      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: period.tenantId, period_id: periodId }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: { message: string } };
        throw new Error(err.error.message);
      }

      setToast({ type: 'success', msg: 'Nomina recalculada exitosamente' });
      await loadData();
    } catch {
      setToast({ type: 'error', msg: 'Error al recalcular la nomina' });
    } finally {
      setActionLoading(null);
    }
  }, [period, periodId, loadData]);

  const handleExportACH = useCallback(async () => {
    if (!period) return;
    setActionLoading('export');
    setAchWarnings([]);

    try {
      const supabase = getSupabaseBrowserClient();

      const userIds = agents.filter((a) => a.net > 0).map((a) => a.userId);
      const { data: hrProfiles } = userIds.length > 0
        ? await supabase
            .from('hr_agent_profiles')
            .select('user_id, cedula, bank_code, bank_name, bank_account_number, bank_account_type')
            .in('user_id', userIds)
        : { data: [] };

      const profileMap = new Map(
        (hrProfiles ?? []).map((p) => [p.user_id, p]),
      );

      const achAgents = agents
        .filter((a) => a.net > 0)
        .map((a) => {
          const profile = profileMap.get(a.userId);
          return {
            cedula: profile?.cedula ?? null,
            agentName: a.agentName,
            bankCode: profile?.bank_code ?? null,
            bankAccountNumber: profile?.bank_account_number ?? null,
            bankAccountType: profile?.bank_account_type ?? null,
            netSalary: a.net,
          };
        });

      const periodLabel = `PLANILLA ${formatDate(period.startDate)} ${formatDate(period.endDate)}`;
      const companyAccount = '0000000000';

      const result: ACHGenerationResult = generatePanamaACH(achAgents, companyAccount, periodLabel);

      if (result.missingBankData.length > 0) {
        setAchWarnings(result.missingBankData);
      }

      if (result.agentCount === 0) {
        setToast({ type: 'error', msg: 'Ningun agente tiene datos bancarios completos para exportar' });
        setActionLoading(null);
        return;
      }

      const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);

      setToast({
        type: result.success ? 'success' : 'error',
        msg: result.success
          ? `ACH descargado: ${result.agentCount} agentes, B/.${result.totalAmount.toFixed(2)}`
          : `ACH parcial: ${result.missingBankData.length} agentes sin datos bancarios`,
      });
    } catch {
      setToast({ type: 'error', msg: 'Error al generar el archivo ACH' });
    } finally {
      setActionLoading(null);
    }
  }, [agents, period]);

  const handleClosePeriod = useCallback(async () => {
    if (!period) return;
    setActionLoading('close');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from('payroll_periods')
        .update({ status: 'cerrado_pagado' })
        .eq('id', periodId);

      if (error) throw error;

      setPeriod((prev) => prev ? { ...prev, status: 'cerrado_pagado' } : null);
      setToast({ type: 'success', msg: 'Periodo cerrado y bloqueado' });
    } catch {
      setToast({ type: 'error', msg: 'Error al cerrar el periodo' });
    } finally {
      setActionLoading(null);
    }
  }, [period, periodId]);

  // -------------------------------------------------------------------
  // Aggregates
  // -------------------------------------------------------------------

  const totalHours = agents.reduce((s, a) => s + a.regularHours + a.overtimeHours + a.holidayHours, 0);
  const totalGross = agents.reduce((s, a) => s + a.gross, 0);
  const totalDeductions = agents.reduce((s, a) => s + a.ss + a.ei, 0);
  const totalNet = agents.reduce((s, a) => s + a.net, 0);

  const isLocked = period?.status === 'cerrado_pagado';

  // -------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          <p className="text-sm tracking-widest text-zinc-500 uppercase">Cargando nomina...</p>
        </div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <p className="text-sm text-zinc-500">Periodo no encontrado</p>
      </div>
    );
  }

  const sBadge = statusConfig[period.status] ?? statusConfig['abierto']!;

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* HEADER */}
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Informe de Planilla</p>
              <h1 className="text-xl font-bold">
                {formatDate(period.startDate)} — {formatDate(period.endDate)}
              </h1>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${sBadge.cls}`}>
              {sBadge.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecalculate}
              disabled={isLocked || actionLoading !== null}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
            >
              {actionLoading === 'recalc' ? <Spinner /> : <RecalcIcon />}
              Recalcular
            </button>
            <button
              onClick={handleExportACH}
              disabled={agents.length === 0 || actionLoading !== null}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
            >
              {actionLoading === 'export' ? <Spinner /> : <DownloadIcon />}
              Exportar ACH
            </button>
            <button
              onClick={handleClosePeriod}
              disabled={isLocked || period.status !== 'calculado' || actionLoading !== null}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40 cursor-pointer"
            >
              {actionLoading === 'close' ? <Spinner /> : <LockIcon />}
              Cerrar Periodo
            </button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 border-b border-zinc-800/60 px-6 py-4">
        <KpiCard label="Total Horas" value={`${formatCurrency(totalHours)}h`} sub={`${agents.length} agentes`} />
        <KpiCard label="Salario Bruto" value={`B/.${formatCurrency(totalGross)}`} accent="emerald" />
        <KpiCard label="Deducciones" value={`B/.${formatCurrency(totalDeductions)}`} sub="SS 9.75% + SE 1.25%" accent="amber" />
        <KpiCard label="Neto a Pagar" value={`B/.${formatCurrency(totalNet)}`} sub="Monto ACH" accent="emerald" highlight />
      </div>

      {/* ACH WARNINGS */}
      {achWarnings.length > 0 && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-6 py-3">
          <p className="text-sm font-semibold text-amber-400">
            {achWarnings.length} agente{achWarnings.length > 1 ? 's' : ''} sin datos bancarios completos
          </p>
          <ul className="mt-2 space-y-1">
            {achWarnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-300/80">
                <span className="font-medium text-amber-300">{w.agentName}</span>
                {' — Falta: '}
                {w.missingFields.join(', ')}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setAchWarnings([])}
            className="mt-2 text-xs text-amber-500/60 hover:text-amber-400 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className="flex-1 overflow-auto">
        {agents.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-zinc-500">No hay registros calculados para este periodo</p>
              <p className="mt-1 text-xs text-zinc-600">Presione "Recalcular" para procesar las marcas de asistencia</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#0C1020]">
              <tr className="border-b border-zinc-800">
                <Th>Agente</Th>
                <Th right>Tarifa/H</Th>
                <Th right>H. Regular</Th>
                <Th right>H. Extra</Th>
                <Th right>Reconocim.</Th>
                <Th right>Rebajas</Th>
                <Th right>Bruto</Th>
                <Th right>S.S.</Th>
                <Th right>S.E.</Th>
                <Th right>Neto</Th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100 truncate max-w-[180px]">{agent.agentName}</p>
                  </td>
                  <TdNum>{agent.ratePerHour.toFixed(2)}</TdNum>
                  <TdNum>{agent.regularHours.toFixed(2)}</TdNum>
                  <TdNum cls={agent.overtimeHours > 0 ? 'text-amber-400' : undefined}>
                    {agent.overtimeHours.toFixed(2)}
                  </TdNum>

                  {/* Inline editable: Addition */}
                  <td className="px-2 py-2">
                    <NumericInput
                      value={agent.addition}
                      disabled={isLocked}
                      onChange={(v) => handleAdjustment(agent.id, 'addition', v)}
                    />
                  </td>

                  {/* Inline editable: Deduction */}
                  <td className="px-2 py-2">
                    <NumericInput
                      value={agent.deduction}
                      disabled={isLocked}
                      onChange={(v) => handleAdjustment(agent.id, 'deduction', v)}
                    />
                  </td>

                  <TdNum cls="font-semibold">{formatCurrency(agent.gross)}</TdNum>
                  <TdNum cls="text-red-400/70">{formatCurrency(agent.ss)}</TdNum>
                  <TdNum cls="text-red-400/70">{formatCurrency(agent.ei)}</TdNum>
                  <TdNum cls="font-bold text-emerald-400">{formatCurrency(agent.net)}</TdNum>
                </tr>
              ))}
            </tbody>

            {/* Totals row */}
            <tfoot className="sticky bottom-0 bg-[#0C1020] border-t-2 border-zinc-700">
              <tr>
                <td className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-400 uppercase">Totales</td>
                <td />
                <TdNum cls="font-semibold">{formatCurrency(agents.reduce((s, a) => s + a.regularHours, 0))}</TdNum>
                <TdNum cls="font-semibold text-amber-400">{formatCurrency(agents.reduce((s, a) => s + a.overtimeHours, 0))}</TdNum>
                <TdNum cls="font-semibold">{formatCurrency(agents.reduce((s, a) => s + a.addition, 0))}</TdNum>
                <TdNum cls="font-semibold">{formatCurrency(agents.reduce((s, a) => s + a.deduction, 0))}</TdNum>
                <TdNum cls="font-bold">{formatCurrency(totalGross)}</TdNum>
                <TdNum cls="font-semibold text-red-400">{formatCurrency(agents.reduce((s, a) => s + a.ss, 0))}</TdNum>
                <TdNum cls="font-semibold text-red-400">{formatCurrency(agents.reduce((s, a) => s + a.ei, 0))}</TdNum>
                <TdNum cls="font-bold text-emerald-400 text-base">{formatCurrency(totalNet)}</TdNum>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-[slideUp_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, accent, highlight }: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'amber';
  highlight?: boolean;
}) {
  const borderCls = accent === 'emerald'
    ? 'border-emerald-500/20'
    : accent === 'amber'
      ? 'border-amber-500/20'
      : 'border-zinc-700/30';

  const bgCls = highlight ? 'bg-emerald-500/8' : 'bg-zinc-800/40';

  return (
    <div className={`rounded-xl border ${borderCls} ${bgCls} px-5 py-4`}>
      <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${
        accent === 'emerald' ? 'text-emerald-400' : accent === 'amber' ? 'text-amber-400' : 'text-zinc-200'
      }`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function TdNum({ children, cls }: { children: React.ReactNode; cls?: string }) {
  return (
    <td className={`px-4 py-3 text-right tabular-nums ${cls ?? 'text-zinc-300'}`}>
      {children}
    </td>
  );
}

function NumericInput({ value, disabled, onChange }: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(value.toFixed(2));

  useEffect(() => {
    setLocal(value.toFixed(2));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
    setLocal(sanitized);
  };

  const handleBlur = () => {
    const parsed = parseFloat(local);
    const final = isNaN(parsed) || parsed < 0 ? 0 : r2(parsed);
    setLocal(final.toFixed(2));
    if (final !== value) {
      onChange(final);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className="w-24 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-2 text-right text-sm tabular-nums text-zinc-200 focus:border-emerald-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
    />
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function RecalcIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />;
}
