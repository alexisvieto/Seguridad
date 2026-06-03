'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryType = 'completo' | 'tardanza' | 'falta_sin_aviso' | 'falta_con_aviso' | 'dia_libre' | 'relevo' | 'relevo_por_falto';

interface AgentRow {
  userId: string;
  name: string;
  entries: Map<string, CellData>;
}

interface CellData {
  id: string | null;
  type: EntryType;
  hours: number;
  bonus: number;
  penalty: number;
}

const entryConfig: Record<EntryType, { label: string; short: string; color: string; defaultHours: number }> = {
  completo: { label: 'Turno Completo', short: '✓', color: '#84CC16', defaultHours: 12 },
  tardanza: { label: 'Tardanza', short: 'T', color: '#F59E0B', defaultHours: 12 },
  falta_sin_aviso: { label: 'Falta sin Aviso', short: 'F!', color: '#DC2626', defaultHours: 0 },
  falta_con_aviso: { label: 'Falta con Aviso (24h)', short: 'F', color: '#EF4444', defaultHours: 0 },
  dia_libre: { label: 'Día Libre', short: '—', color: '#64748B', defaultHours: 0 },
  relevo: { label: 'Relevo', short: 'R', color: '#3B82F6', defaultHours: 12 },
  relevo_por_falto: { label: 'Relevo por Falto', short: 'RF', color: '#8B5CF6', defaultHours: 12 },
};

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(start + 'T12:00:00');
  const endDate = new Date(end + 'T12:00:00');
  while (d <= endDate) {
    days.push(d.toISOString().split('T')[0]!);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlanillaOperativaPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Period
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.getDate() <= 15
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-16`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.getDate() <= 15
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
  });

  // Edit modal
  const [editAgent, setEditAgent] = useState<{ userId: string; name: string; date: string } | null>(null);
  const [editType, setEditType] = useState<EntryType>('completo');
  const [editHours, setEditHours] = useState('12');
  const [editBonus, setEditBonus] = useState('0');
  const [editPenalty, setEditPenalty] = useState('0');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const days = getDaysInRange(startDate, endDate);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;
    setTenantId(tenant.id);

    const { data: members } = await supabase.from('memberships').select('user_id').eq('tenant_id', tenant.id).in('role', ['editor', 'admin']);
    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) { setIsLoading(false); return; }

    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const { data: entries } = await supabase
      .from('operative_paysheet')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate);

    const entryMap = new Map<string, CellData>();
    for (const e of entries ?? []) {
      entryMap.set(`${e.user_id}_${e.shift_date}`, {
        id: e.id,
        type: e.entry_type as EntryType,
        hours: Number(e.hours),
        bonus: Number(e.bonus),
        penalty: Number(e.penalty),
      });
    }

    setAgents(userIds.map((uid) => ({
      userId: uid,
      name: nameMap.get(uid) ?? 'Agente',
      entries: new Map(days.map((d) => {
        const key = `${uid}_${d}`;
        return [d, entryMap.get(key) ?? { id: null, type: 'completo' as EntryType, hours: 12, bonus: 0, penalty: 0 }];
      })),
    })).sort((a, b) => a.name.localeCompare(b.name)));

    setIsLoading(false);
  }, [tenantSlug, startDate, endDate, days]);

  useEffect(() => { loadData(); }, [loadData]);

  const openEdit = useCallback((agent: AgentRow, date: string) => {
    const cell = agent.entries.get(date);
    setEditAgent({ userId: agent.userId, name: agent.name, date });
    setEditType(cell?.type ?? 'completo');
    setEditHours(String(cell?.hours ?? 12));
    setEditBonus(String(cell?.bonus ?? 0));
    setEditPenalty(String(cell?.penalty ?? 0));
    setEditNotes('');
  }, []);

  const handleTypeChange = useCallback((type: EntryType) => {
    setEditType(type);
    const cfg = entryConfig[type];
    setEditHours(String(cfg.defaultHours));
    if (type === 'falta_sin_aviso') { setEditPenalty('15'); setEditBonus('0'); }
    else if (type === 'relevo_por_falto') { setEditBonus('15'); setEditPenalty('0'); }
    else { setEditBonus('0'); setEditPenalty('0'); }
  }, []);

  const handleSave = useCallback(async () => {
    if (!tenantId || !editAgent) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.from('operative_paysheet').upsert({
        tenant_id: tenantId,
        user_id: editAgent.userId,
        shift_date: editAgent.date,
        entry_type: editType,
        hours: parseFloat(editHours) || 0,
        bonus: parseFloat(editBonus) || 0,
        penalty: parseFloat(editPenalty) || 0,
        notes: editNotes.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,user_id,shift_date' });

      setToast('Guardado');
      setEditAgent(null);
      loadData();
    } catch { setToast('Error al guardar'); }
    finally { setSaving(false); }
  }, [tenantId, editAgent, editType, editHours, editBonus, editPenalty, editNotes, loadData]);

  if (isLoading) {
    return <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" /></div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Operaciones</p>
          <h1 className="text-lg font-bold">Planilla Operativa</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-lime-500 focus:outline-none" />
          <span className="text-xs text-zinc-600">a</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-lime-500 focus:outline-none" />
        </div>
      </header>

      {/* Legend */}
      <div className="flex items-center gap-4 border-b border-zinc-800/60 px-6 py-2">
        {Object.entries(entryConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="flex h-5 w-7 items-center justify-center rounded text-[10px] font-bold" style={{ background: cfg.color + '22', color: cfg.color }}>{cfg.short}</span>
            <span className="text-[10px] text-zinc-500">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#0A0E1A]">
            <tr>
              <th className="sticky left-0 z-20 bg-[#0A0E1A] px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest text-zinc-500 uppercase min-w-[160px] border-b border-zinc-800/60">Agente</th>
              {days.map((d) => {
                const date = new Date(d + 'T12:00:00');
                const dow = date.toLocaleDateString('es-PA', { weekday: 'short' });
                const day = date.getDate();
                return (
                  <th key={d} className="px-1 py-2.5 text-center border-b border-zinc-800/60 min-w-[44px]">
                    <div className="text-[9px] text-zinc-600 uppercase">{dow}</div>
                    <div className="text-xs text-zinc-300 font-bold">{day}</div>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-center border-b border-zinc-800/60 min-w-[60px]">
                <div className="text-[10px] text-lime-400 font-bold">Total</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              let totalHours = 0;
              let totalBonus = 0;
              let totalPenalty = 0;
              for (const cell of agent.entries.values()) {
                totalHours += cell.hours;
                totalBonus += cell.bonus;
                totalPenalty += cell.penalty;
              }

              return (
                <tr key={agent.userId} className="border-b border-zinc-800/20 hover:bg-zinc-800/10">
                  <td className="sticky left-0 bg-[#0A0E1A] px-4 py-2 font-medium text-zinc-200 text-sm truncate max-w-[160px]">{agent.name}</td>
                  {days.map((d) => {
                    const cell = agent.entries.get(d)!;
                    const cfg = entryConfig[cell.type];
                    return (
                      <td key={d} className="px-0.5 py-1 text-center">
                        <button
                          onClick={() => openEdit(agent, d)}
                          className="w-full rounded py-1.5 text-[11px] font-bold cursor-pointer transition-colors hover:ring-1 hover:ring-lime-500/30"
                          style={{ background: cfg.color + '18', color: cfg.color }}
                          title={`${cfg.label} — ${cell.hours}h`}
                        >
                          {cell.type === 'completo' ? cell.hours : cell.type === 'tardanza' ? cell.hours : cfg.short}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center">
                    <div className="text-sm font-bold tabular-nums text-lime-400">{totalHours}h</div>
                    {totalBonus > 0 && <div className="text-[9px] text-blue-400">+${totalBonus}</div>}
                    {totalPenalty > 0 && <div className="text-[9px] text-red-400">-${totalPenalty}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditAgent(null); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">{editAgent.name}</h3>
              <p className="text-xs text-zinc-500">{new Date(editAgent.date + 'T12:00:00').toLocaleDateString('es-PA', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-zinc-400">Tipo de Entrada</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(Object.entries(entryConfig) as [EntryType, typeof entryConfig[EntryType]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => handleTypeChange(key)}
                    className={`rounded-lg px-3 py-2.5 text-xs font-semibold text-left cursor-pointer transition-all ${editType === key ? 'ring-2' : 'opacity-60 hover:opacity-80'}`}
                    style={{ background: cfg.color + '18', color: cfg.color, borderColor: editType === key ? cfg.color : 'transparent' }}>
                    <span className="font-bold mr-1">{cfg.short}</span> {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Horas</span>
                <input type="number" value={editHours} onChange={(e) => setEditHours(e.target.value)} step="0.5"
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 text-center focus:border-lime-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Bono ($)</span>
                <input type="number" value={editBonus} onChange={(e) => setEditBonus(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 text-center focus:border-lime-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Descuento ($)</span>
                <input type="number" value={editPenalty} onChange={(e) => setEditPenalty(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-red-400 text-center focus:border-red-500 focus:outline-none" />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Notas (opcional)</span>
              <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Ej: Llegó 1 hora tarde, cubrió puesto Garita"
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none" />
            </label>

            <div className="flex gap-3">
              <button onClick={() => setEditAgent(null)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-lime-600 px-5 py-3 text-sm font-medium text-white shadow-lg animate-[slideUp_0.3s_ease-out]">{toast}</div>}
    </div>
  );
}
