'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PeriodRow {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  agentCount: number;
  totalNet: number;
}

interface Toast {
  type: 'success' | 'error';
  msg: string;
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  abierto: { label: 'Abierto', cls: 'bg-blue-500/15 text-blue-400' },
  calculado: { label: 'Calculado', cls: 'bg-amber-500/15 text-amber-400' },
  cerrado_pagado: { label: 'Pagado', cls: 'bg-lime-500/15 text-lime-400' },
};

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmt(v: number): string {
  return v.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NominaIndexPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Create period
  const [showCreate, setShowCreate] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!tenant) return;
    setTenantId(tenant.id);

    const { data: periodsData } = await supabase
      .from('payroll_periods')
      .select('id, start_date, end_date, status')
      .eq('tenant_id', tenant.id)
      .order('start_date', { ascending: false });

    const rows: PeriodRow[] = [];
    for (const p of periodsData ?? []) {
      const { data: consolidated } = await supabase
        .from('payroll_agent_consolidated')
        .select('net_salary')
        .eq('payroll_period_id', p.id);

      rows.push({
        id: p.id,
        startDate: p.start_date,
        endDate: p.end_date,
        status: p.status,
        agentCount: consolidated?.length ?? 0,
        totalNet: (consolidated ?? []).reduce((s, r) => s + Number(r.net_salary), 0),
      });
    }

    setPeriods(rows);
    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreatePeriod = useCallback(async () => {
    if (!tenantId || !newStart || !newEnd) return;
    setCreateLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('payroll_periods').insert({
        tenant_id: tenantId,
        start_date: newStart,
        end_date: newEnd,
      });

      if (error) {
        setToast({ type: 'error', msg: error.code === '23505' ? 'Ya existe un periodo con esas fechas' : 'Error al crear periodo' });
        setCreateLoading(false);
        return;
      }

      setToast({ type: 'success', msg: 'Periodo creado' });
      setShowCreate(false);
      setNewStart('');
      setNewEnd('');
      loadData();
    } catch {
      setToast({ type: 'error', msg: 'Error al crear periodo' });
    } finally {
      setCreateLoading(false);
    }
  }, [tenantId, newStart, newEnd, loadData]);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <WalletIcon />
          <h1 className="text-lg font-semibold tracking-wide">Nomina Quincenal</h1>
          <span className="text-sm text-zinc-500">{periods.length} periodos</span>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer">
          <PlusIcon /> Nuevo Periodo
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {periods.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60">
              <WalletLgIcon />
            </div>
            <p className="text-sm font-medium text-zinc-400">Sin periodos de nomina</p>
            <p className="text-xs text-zinc-600">Cree un periodo quincenal para empezar a calcular planillas</p>
            <button onClick={() => setShowCreate(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer">
              <PlusIcon /> Crear Primer Periodo
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {periods.map((p) => {
              const badge = statusBadge[p.status] ?? statusBadge['abierto']!;
              return (
                <Link key={p.id} href={`/${tenantSlug}/dashboard/nomina/${p.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-5 py-4 hover:bg-zinc-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{formatDate(p.startDate)} — {formatDate(p.endDate)}</p>
                      <p className="text-xs text-zinc-500">{p.agentCount} agentes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-lime-400">B/.{fmt(p.totalNet)}</p>
                    <p className="text-[10px] text-zinc-600">Neto a pagar</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Period Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Nuevo Periodo Quincenal</h3>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Fecha Inicio</span>
                <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Fecha Fin</span>
                <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleCreatePeriod} disabled={!newStart || !newEnd || createLoading}
                className="flex flex-1 items-center justify-center rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {createLoading ? <Spinner /> : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-[slideUp_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-lime-600 text-white' : 'bg-red-600 text-white'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}
function WalletLgIcon() {
  return (
    <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}
