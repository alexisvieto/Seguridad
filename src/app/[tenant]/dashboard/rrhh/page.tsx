'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DetailTab = 'ficha' | 'contrato' | 'disciplina';

interface AgentRow {
  userId: string;
  name: string;
  cedula: string | null;
  hireDate: string | null;
  carnetNumber: string | null;
  carnetExpiry: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  contractType: string | null;
  contractStatus: string | null;
  baseSalary: number | null;
  contractStart: string | null;
  mitradelPdf: string | null;
}

interface DisciplinaryRow {
  id: string;
  type: string;
  description: string;
  startDate: string;
  endDate: string | null;
  registeredBy: string | null;
  legalFlag: boolean;
  createdAt: string;
}

interface Toast {
  type: 'success' | 'error';
  msg: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

const disciplineLabels: Record<string, { label: string; cls: string }> = {
  llamado_atencion: { label: 'Llamado de atencion', cls: 'bg-amber-500/15 text-amber-400' },
  falta: { label: 'Falta', cls: 'bg-red-500/15 text-red-400' },
  suspension: { label: 'Suspension', cls: 'bg-red-500/15 text-red-400' },
};

const contractStatusBadge: Record<string, { label: string; cls: string }> = {
  pendiente_sello: { label: 'Pendiente MITRADEL', cls: 'bg-amber-500/15 text-amber-400' },
  activo: { label: 'Activo', cls: 'bg-emerald-500/15 text-emerald-400' },
  vencido: { label: 'Vencido', cls: 'bg-red-500/15 text-red-400' },
  terminado: { label: 'Terminado', cls: 'bg-zinc-500/15 text-zinc-400' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RRHHPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Detail panel
  const [selected, setSelected] = useState<AgentRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('ficha');
  const [disciplinary, setDisciplinary] = useState<DisciplinaryRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Amonestacion form
  const [showAmonForm, setShowAmonForm] = useState(false);
  const [amonType, setAmonType] = useState('llamado_atencion');
  const [amonDesc, setAmonDesc] = useState('');
  const [amonDate, setAmonDate] = useState('');
  const [amonLoading, setAmonLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // -------------------------------------------------------------------
  // Load agents
  // -------------------------------------------------------------------

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!tenant) return;
    setTenantId(tenant.id);

    const { data: members } = await supabase
      .from('memberships').select('user_id, role').eq('tenant_id', tenant.id);

    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) { setIsLoading(false); return; }

    const [profilesRes, hrRes, contractsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', userIds),
      supabase.from('hr_agent_profiles').select('user_id, cedula, hire_date, security_carnet_number, carnet_expiry_date, emergency_contact_name, emergency_contact_phone').eq('tenant_id', tenant.id),
      supabase.from('hr_contracts').select('user_id, contract_type, status, base_salary, start_date, mitradel_sealed_pdf_url').eq('tenant_id', tenant.id).eq('status', 'activo').order('start_date', { ascending: false }),
    ]);

    const nameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
    const hrMap = new Map((hrRes.data ?? []).map((h) => [h.user_id, h]));
    const contractMap = new Map<string, (typeof contractsRes.data extends Array<infer T> | null ? T : never)>();
    for (const c of contractsRes.data ?? []) {
      if (!contractMap.has(c.user_id)) contractMap.set(c.user_id, c);
    }

    setAgents(userIds.map((uid) => {
      const hr = hrMap.get(uid);
      const contract = contractMap.get(uid);
      return {
        userId: uid,
        name: nameMap.get(uid) ?? 'Agente',
        cedula: hr?.cedula ?? null,
        hireDate: hr?.hire_date ?? null,
        carnetNumber: hr?.security_carnet_number ?? null,
        carnetExpiry: hr?.carnet_expiry_date ?? null,
        emergencyName: hr?.emergency_contact_name ?? null,
        emergencyPhone: hr?.emergency_contact_phone ?? null,
        contractType: contract?.contract_type ?? null,
        contractStatus: contract?.status ?? null,
        baseSalary: contract?.base_salary ? Number(contract.base_salary) : null,
        contractStart: contract?.start_date ?? null,
        mitradelPdf: contract?.mitradel_sealed_pdf_url ?? null,
      };
    }));

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Select agent → load disciplinary
  // -------------------------------------------------------------------

  const selectAgent = useCallback(async (agent: AgentRow) => {
    setSelected(agent);
    setDetailTab('ficha');
    setDetailLoading(true);
    setShowAmonForm(false);

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from('hr_disciplinary_records')
      .select('id, record_type, description, start_date, end_date, registered_by, legal_validity_flag, created_at')
      .eq('user_id', agent.userId)
      .order('start_date', { ascending: false });

    setDisciplinary((data ?? []).map((d) => ({
      id: d.id,
      type: d.record_type,
      description: d.description,
      startDate: d.start_date,
      endDate: d.end_date,
      registeredBy: d.registered_by,
      legalFlag: d.legal_validity_flag,
      createdAt: d.created_at,
    })));

    setDetailLoading(false);
  }, []);

  // -------------------------------------------------------------------
  // Register amonestacion
  // -------------------------------------------------------------------

  const handleAmonestacion = useCallback(async () => {
    if (!selected || !tenantId || !amonDesc.trim() || !amonDate) return;
    setAmonLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('hr_disciplinary_records').insert({
        tenant_id: tenantId,
        user_id: selected.userId,
        record_type: amonType as 'llamado_atencion' | 'falta' | 'suspension',
        description: amonDesc.trim(),
        start_date: amonDate,
        registered_by: user?.id ?? null,
        legal_validity_flag: true,
      });

      if (error) throw error;

      setToast({ type: 'success', msg: 'Amonestacion registrada' });
      setShowAmonForm(false);
      setAmonDesc('');
      setAmonDate('');
      selectAgent(selected);
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar amonestacion' });
    } finally {
      setAmonLoading(false);
    }
  }, [selected, tenantId, amonType, amonDesc, amonDate, selectAgent]);

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

      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <UserIcon />
          <h1 className="text-lg font-semibold tracking-wide">Expedientes de Personal</h1>
          <span className="text-sm text-zinc-500">{agents.length} agentes</span>
        </div>
      </header>

      {/* MASTER-DETAIL */}
      <div className="flex flex-1 overflow-hidden">

        {/* AGENT LIST (40%) */}
        <div className="w-[40%] shrink-0 overflow-y-auto border-r border-zinc-800/60">
          {agents.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60">
                <UserLgIcon />
              </div>
              <p className="text-sm font-medium text-zinc-400">Sin agentes registrados</p>
              <p className="text-xs text-zinc-600">Use el Admin CLI para agregar personal</p>
            </div>
          ) : (
            <ul>
              {agents.map((agent) => {
                const isSelected = selected?.userId === agent.userId;
                const cBadge = agent.contractStatus ? (contractStatusBadge[agent.contractStatus] ?? contractStatusBadge['activo']!) : null;

                return (
                  <li key={agent.userId}>
                    <button onClick={() => selectAgent(agent)}
                      className={`flex w-full items-center gap-3 border-b border-zinc-800/40 px-5 py-4 text-left transition-colors cursor-pointer min-h-[60px] ${
                        isSelected ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/30'
                      }`}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400">
                        {agent.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100 truncate">{agent.name}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                          {agent.cedula && <span className="font-mono">{agent.cedula}</span>}
                          {cBadge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cBadge.cls}`}>{cBadge.label}</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* DETAIL PANEL (60%) */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
              <UserLgIcon />
              <p className="text-sm">Seleccione un agente</p>
            </div>
          ) : detailLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Agent header */}
              <div className="border-b border-zinc-800/60 px-6 py-4">
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {selected.cedula && <span className="font-mono mr-3">{selected.cedula}</span>}
                  {selected.hireDate && <span>Desde {formatDate(selected.hireDate)}</span>}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-zinc-800/60 px-6 pt-2">
                {([
                  { key: 'ficha' as DetailTab, label: 'Ficha Operativa' },
                  { key: 'contrato' as DetailTab, label: 'Contrato' },
                  { key: 'disciplina' as DetailTab, label: `Disciplinario (${disciplinary.length})` },
                ]).map((t) => (
                  <button key={t.key} onClick={() => setDetailTab(t.key)}
                    className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer min-h-[40px] ${
                      detailTab === t.key ? 'bg-zinc-800/60 text-zinc-100 border-b-2 border-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-6">

                {/* FICHA OPERATIVA */}
                {detailTab === 'ficha' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoCard label="Cedula" value={selected.cedula ?? 'No registrada'} />
                    <InfoCard label="Fecha de Contratacion" value={selected.hireDate ? formatDate(selected.hireDate) : 'No registrada'} />
                    <InfoCard label="Carnet DIASP" value={selected.carnetNumber ?? 'No registrado'} />
                    <InfoCard label="Vencimiento Carnet" value={selected.carnetExpiry ? formatDate(selected.carnetExpiry) : 'No registrado'}
                      alert={selected.carnetExpiry && new Date(selected.carnetExpiry) < new Date() ? 'VENCIDO' : undefined} />
                    <InfoCard label="Contacto de Emergencia" value={selected.emergencyName ?? 'No registrado'} />
                    <InfoCard label="Telefono Emergencia" value={selected.emergencyPhone ?? 'No registrado'} />
                  </div>
                )}

                {/* CONTRATO */}
                {detailTab === 'contrato' && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoCard label="Tipo de Contrato" value={selected.contractType === 'indefinido' ? 'Indefinido' : selected.contractType === 'definido' ? 'Definido' : 'Sin contrato'} />
                      <InfoCard label="Salario Mensual" value={selected.baseSalary ? `B/.${selected.baseSalary.toFixed(2)}` : 'No definido'} />
                      <InfoCard label="Fecha de Inicio" value={selected.contractStart ? formatDate(selected.contractStart) : 'No registrada'} />
                      <InfoCard label="Tarifa por Hora" value={selected.baseSalary ? `B/.${(selected.baseSalary / 240).toFixed(2)}/h` : 'No definida'} />
                    </div>

                    {/* Contract status */}
                    <div className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-zinc-500">Estado del Contrato</p>
                          {selected.contractStatus && (
                            <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                              (contractStatusBadge[selected.contractStatus] ?? contractStatusBadge['activo']!).cls
                            }`}>
                              {(contractStatusBadge[selected.contractStatus] ?? contractStatusBadge['activo']!).label}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500">Sello MITRADEL</p>
                          <p className={`text-sm font-medium ${selected.mitradelPdf ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {selected.mitradelPdf ? 'Documento sellado' : 'Pendiente'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DISCIPLINARIO */}
                {detailTab === 'disciplina' && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Historial Disciplinario</p>
                      <button onClick={() => setShowAmonForm(!showAmonForm)}
                        className="flex min-h-[40px] items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 cursor-pointer">
                        <PlusIcon /> {showAmonForm ? 'Cancelar' : 'Registrar Amonestacion'}
                      </button>
                    </div>

                    {/* Form */}
                    {showAmonForm && (
                      <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                        <label className="block">
                          <span className="text-xs font-medium text-zinc-400">Tipo de Falta</span>
                          <select value={amonType} onChange={(e) => setAmonType(e.target.value)}
                            className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[44px] focus:border-red-500 focus:outline-none cursor-pointer">
                            <option value="llamado_atencion">Llamado de atencion</option>
                            <option value="falta">Falta</option>
                            <option value="suspension">Suspension</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-zinc-400">Descripcion de los Hechos</span>
                          <textarea value={amonDesc} onChange={(e) => setAmonDesc(e.target.value)} rows={3} maxLength={5000} placeholder="Detalle la situacion..."
                            className="mt-1 block w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 focus:outline-none" />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-zinc-400">Fecha del Suceso</span>
                          <input type="date" value={amonDate} onChange={(e) => setAmonDate(e.target.value)}
                            className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[44px] focus:border-red-500 focus:outline-none" />
                        </label>
                        <button onClick={handleAmonestacion} disabled={!amonDesc.trim() || !amonDate || amonLoading}
                          className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40 cursor-pointer">
                          {amonLoading ? <Spinner /> : 'Confirmar Registro'}
                        </button>
                      </div>
                    )}

                    {/* List */}
                    {disciplinary.length === 0 && !showAmonForm ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                          <CheckIcon />
                        </div>
                        <p className="text-sm text-zinc-500">Sin registros disciplinarios</p>
                        <p className="text-xs text-zinc-600">Expediente limpio</p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {disciplinary.map((d) => {
                          const badge = disciplineLabels[d.type] ?? disciplineLabels['llamado_atencion']!;
                          return (
                            <li key={d.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-5 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                                  <span className="text-xs text-zinc-500">{formatDate(d.startDate)}</span>
                                </div>
                                {d.legalFlag && (
                                  <span className="text-[10px] text-emerald-500/70">Validez legal</span>
                                )}
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{d.description}</p>
                              {d.endDate && (
                                <p className="mt-1 text-xs text-zinc-500">Hasta: {formatDate(d.endDate)}</p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-[slideUp_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoCard({ label, value, alert }: { label: string; value: string; alert?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-4 py-3">
      <p className="text-[11px] font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-200">{value}</p>
      {alert && <p className="mt-0.5 text-[11px] font-semibold text-red-400">{alert}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function UserIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
    </svg>
  );
}

function UserLgIcon() {
  return (
    <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}
