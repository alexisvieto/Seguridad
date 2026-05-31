'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PayrollMetrics {
  periodLabel: string | null;
  periodStatus: string | null;
  totalGross: number;
  totalNet: number;
  totalOvertimeHours: number;
  agentCount: number;
}

interface ComplianceAlerts {
  contractsPendingSeal: number;
  trainingExpiringSoon: number;
  trainingExpired: number;
}

interface IncidentAnalytics {
  last30DaysTotal: number;
  openIncidents: number;
  resolvedIncidents: number;
}

interface DashboardData {
  payroll: PayrollMetrics;
  compliance: ComplianceAlerts;
  incidents: IncidentAnalytics;
  generatedAt: string;
}

interface PeriodBar {
  label: string;
  regular: number;
  overtime: number;
}

interface AlertItem {
  id: string;
  type: 'danger' | 'warning';
  message: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number): string {
  return v.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExecutiveDashboardPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [data, setData] = useState<DashboardData | null>(null);
  const [periods, setPeriods] = useState<PeriodBar[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // Fetch executive API
      const res = await fetch('/api/dashboard/executive');
      if (!res.ok) return;
      const json = await res.json() as { data: DashboardData };
      setData(json.data);

      // Fetch last 3 periods for chart
      const supabase = getSupabaseBrowserClient();
      const { data: tenant } = await supabase
        .from('tenants').select('id').eq('slug', tenantSlug).single();
      if (!tenant) return;

      const { data: recentPeriods } = await supabase
        .from('payroll_periods')
        .select('id, start_date, end_date')
        .eq('tenant_id', tenant.id)
        .in('status', ['calculado', 'cerrado_pagado'])
        .order('end_date', { ascending: false })
        .limit(3);

      const bars: PeriodBar[] = [];
      for (const p of (recentPeriods ?? []).reverse()) {
        const { data: consolidated } = await supabase
          .from('payroll_agent_consolidated')
          .select('regular_hours_accumulated, overtime_hours_accumulated')
          .eq('payroll_period_id', p.id);

        const regular = (consolidated ?? []).reduce((s, r) => s + Number(r.regular_hours_accumulated), 0);
        const overtime = (consolidated ?? []).reduce((s, r) => s + Number(r.overtime_hours_accumulated), 0);

        const startParts = p.start_date.split('-');
        const label = `${startParts[2]}/${startParts[1]}`;
        bars.push({ label, regular, overtime });
      }
      setPeriods(bars);

      // Build alerts
      const alertList: AlertItem[] = [];

      // Training expired
      if (json.data.compliance.trainingExpired > 0) {
        alertList.push({
          id: 'training-expired',
          type: 'danger',
          message: `${json.data.compliance.trainingExpired} certificacion${json.data.compliance.trainingExpired > 1 ? 'es' : ''} vencida${json.data.compliance.trainingExpired > 1 ? 's' : ''}`,
          detail: 'Agentes con cursos DIASP o capacitaciones obligatorias expiradas',
        });
      }

      // Training expiring soon
      if (json.data.compliance.trainingExpiringSoon > 0) {
        alertList.push({
          id: 'training-expiring',
          type: 'warning',
          message: `${json.data.compliance.trainingExpiringSoon} certificacion${json.data.compliance.trainingExpiringSoon > 1 ? 'es' : ''} por vencer en 30 dias`,
          detail: 'Programar recertificacion antes de la fecha limite',
        });
      }

      // Contracts pending seal
      if (json.data.compliance.contractsPendingSeal > 0) {
        alertList.push({
          id: 'mitradel-pending',
          type: 'danger',
          message: `${json.data.compliance.contractsPendingSeal} contrato${json.data.compliance.contractsPendingSeal > 1 ? 's' : ''} pendiente${json.data.compliance.contractsPendingSeal > 1 ? 's' : ''} de sello MITRADEL`,
          detail: 'Riesgo de multa por operar sin contrato sellado',
        });
      }

      // Open incidents
      if (json.data.incidents.openIncidents > 0) {
        alertList.push({
          id: 'incidents-open',
          type: json.data.incidents.openIncidents > 5 ? 'danger' : 'warning',
          message: `${json.data.incidents.openIncidents} incidente${json.data.incidents.openIncidents > 1 ? 's' : ''} abierto${json.data.incidents.openIncidents > 1 ? 's' : ''} sin resolver`,
          detail: `${json.data.incidents.resolvedIncidents} resueltos en los ultimos 30 dias`,
        });
      }

      setAlerts(alertList);
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Skeleton
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">
        <header className="border-b border-zinc-800/60 px-6 py-4">
          <div className="h-4 w-48 rounded bg-zinc-800 animate-pulse" />
          <div className="mt-2 h-7 w-72 rounded bg-zinc-800 animate-pulse" />
        </header>
        <div className="grid grid-cols-4 gap-4 border-b border-zinc-800/60 px-6 py-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-800/40 bg-zinc-800/30 px-5 py-6">
              <div className="h-3 w-24 rounded bg-zinc-700 animate-pulse" />
              <div className="mt-3 h-8 w-32 rounded bg-zinc-700 animate-pulse" />
              <div className="mt-2 h-2 w-20 rounded bg-zinc-800 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="flex flex-1 gap-6 p-6">
          <div className="flex-1 rounded-2xl border border-zinc-800/40 bg-zinc-800/20 p-6">
            <div className="h-4 w-40 rounded bg-zinc-700 animate-pulse" />
            <div className="mt-6 flex items-end gap-6 h-48">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex-1 flex gap-1">
                  <div className="flex-1 rounded-t bg-zinc-700/50 animate-pulse" style={{ height: `${40 + i * 25}%` }} />
                  <div className="flex-1 rounded-t bg-zinc-800/50 animate-pulse" style={{ height: `${20 + i * 10}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="w-[360px] rounded-2xl border border-zinc-800/40 bg-zinc-800/20 p-6">
            <div className="h-4 w-32 rounded bg-zinc-700 animate-pulse" />
            <div className="mt-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-zinc-800/50 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <p className="text-sm text-zinc-500">Error al cargar el dashboard ejecutivo</p>
      </div>
    );
  }

  // Chart scale
  const maxBarValue = Math.max(
    ...periods.map((p) => p.regular + p.overtime),
    1,
  );

  const netPct = pct(data.payroll.totalNet, data.payroll.totalGross);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* HEADER */}
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Centro de Comando</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight">NexGuard360</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-500">{tenantSlug}</span>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 border-b border-zinc-800/60 px-6 py-4">

        {/* Payroll Cost */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Planilla Quincenal</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-400">B/.{fmt(data.payroll.totalNet)}</p>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Neto</span>
              <span>Bruto B/.{fmt(data.payroll.totalGross)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-zinc-800">
              <div
                className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${netPct}%` }}
              />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-zinc-600">{data.payroll.agentCount} agentes</p>
        </div>

        {/* Overtime */}
        <div className={`rounded-xl border px-5 py-4 ${
          data.payroll.totalOvertimeHours > 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-zinc-700/30 bg-zinc-800/40'
        }`}>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Horas Extras Planas</p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums ${
            data.payroll.totalOvertimeHours > 0 ? 'text-amber-400' : 'text-zinc-600'
          }`}>
            {fmt(data.payroll.totalOvertimeHours)}h
          </p>
          <p className="mt-1.5 text-xs text-zinc-600">Acumuladas en el periodo</p>
        </div>

        {/* MITRADEL Risk */}
        <div className={`rounded-xl border px-5 py-4 ${
          data.compliance.contractsPendingSeal > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-zinc-700/30 bg-zinc-800/40'
        }`}>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Riesgo MITRADEL</p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums ${
            data.compliance.contractsPendingSeal > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-600'
          }`}>
            {data.compliance.contractsPendingSeal}
          </p>
          <p className="mt-1.5 text-xs text-zinc-600">
            {data.compliance.contractsPendingSeal > 0 ? 'contratos sin sellar' : 'todo en regla'}
          </p>
        </div>

        {/* Incidents */}
        <div className={`rounded-xl border px-5 py-4 ${
          data.incidents.openIncidents > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-zinc-700/30 bg-zinc-800/40'
        }`}>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Incidentes Activos</p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums ${
            data.incidents.openIncidents > 0 ? 'text-red-400' : 'text-zinc-600'
          }`}>
            {data.incidents.openIncidents}
          </p>
          <p className="mt-1.5 text-xs text-zinc-600">
            {data.incidents.last30DaysTotal} total en 30 dias
          </p>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 gap-6 overflow-hidden p-6">

        {/* ============================================================ */}
        {/* CHART: Efficiency (Bar Chart)                                 */}
        {/* ============================================================ */}
        <div className="flex flex-1 flex-col rounded-2xl border border-zinc-800/40 bg-zinc-800/20 p-6">
          <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
            Eficiencia Operativa — Ultimos 3 Periodos
          </h2>
          <p className="mt-1 text-[11px] text-zinc-600">
            Horas ordinarias (tope 96/agente) vs horas extras planas acumuladas
          </p>

          {periods.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-zinc-600">Sin periodos calculados aun</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-1 items-end gap-8">
              {periods.map((p) => {
                const regularH = pct(p.regular, maxBarValue);
                const overtimeH = pct(p.overtime, maxBarValue);

                return (
                  <div key={p.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full items-end gap-1.5" style={{ height: '100%', minHeight: 120 }}>
                      {/* Regular */}
                      <div className="relative flex-1 rounded-t-lg bg-emerald-500/20 transition-all duration-500"
                        style={{ height: `${Math.max(regularH, 4)}%` }}>
                        <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-emerald-500/40" style={{ height: '100%' }} />
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-emerald-400">
                          {Math.round(p.regular)}h
                        </span>
                      </div>
                      {/* Overtime */}
                      <div className="relative flex-1 rounded-t-lg bg-amber-500/20 transition-all duration-500"
                        style={{ height: `${Math.max(overtimeH, 4)}%` }}>
                        <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-amber-500/40" style={{ height: '100%' }} />
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-amber-400">
                          {Math.round(p.overtime)}h
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">{p.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 border-t border-zinc-800/40 pt-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded bg-emerald-500/40" />
              <span className="text-[11px] text-zinc-500">Horas Ordinarias</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded bg-amber-500/40" />
              <span className="text-[11px] text-zinc-500">Horas Extras Planas</span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ALERTS PANEL                                                  */}
        {/* ============================================================ */}
        <div className="flex w-[360px] shrink-0 flex-col rounded-2xl border border-zinc-800/40 bg-zinc-800/20 p-6">
          <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
            Alertas Criticas
          </h2>

          {alerts.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckIcon />
                </div>
                <p className="mt-3 text-sm text-zinc-500">Sin alertas pendientes</p>
                <p className="mt-1 text-xs text-zinc-600">La operacion funciona con normalidad</p>
              </div>
            </div>
          ) : (
            <ul className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`rounded-xl border px-4 py-3 ${
                    alert.type === 'danger'
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-amber-500/20 bg-amber-500/5'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      alert.type === 'danger' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                    }`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${
                        alert.type === 'danger' ? 'text-red-300' : 'text-amber-300'
                      }`}>
                        {alert.message}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">{alert.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Summary footer */}
          <div className="mt-4 border-t border-zinc-800/40 pt-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-zinc-200">{data.incidents.resolvedIncidents}</p>
                <p className="text-[10px] text-zinc-600">Resueltos 30d</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-zinc-200">
                  {data.compliance.trainingExpired + data.compliance.trainingExpiringSoon}
                </p>
                <p className="text-[10px] text-zinc-600">Certs en riesgo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
