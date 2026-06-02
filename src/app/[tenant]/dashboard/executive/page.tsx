'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertItem {
  id: string;
  sourceType: 'incident' | 'ticket' | 'damage';
  title: string;
  description: string;
  propertyName: string;
  status: string;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  old_status: string;
  new_status: string;
  notes: string;
  action_by_name: string;
  created_at: string;
}

const statusFlow: Record<string, { label: string; cls: string; dotCls: string }> = {
  open: { label: 'Sin Atender', cls: 'bg-red-500/15 text-red-400', dotCls: 'bg-red-500' },
  abierto: { label: 'Sin Atender', cls: 'bg-red-500/15 text-red-400', dotCls: 'bg-red-500' },
  bajo_investigacion: { label: 'Sin Atender', cls: 'bg-red-500/15 text-red-400', dotCls: 'bg-red-500' },
  in_progress: { label: 'En Proceso', cls: 'bg-amber-500/15 text-amber-400', dotCls: 'bg-amber-500' },
  en_proceso: { label: 'En Proceso', cls: 'bg-amber-500/15 text-amber-400', dotCls: 'bg-amber-500' },
  resolved: { label: 'Resuelto', cls: 'bg-lime-500/15 text-lime-400', dotCls: 'bg-lime-500' },
  resuelto: { label: 'Resuelto', cls: 'bg-lime-500/15 text-lime-400', dotCls: 'bg-lime-500' },
  justified: { label: 'Justificada', cls: 'bg-lime-500/15 text-lime-400', dotCls: 'bg-lime-500' },
  closed: { label: 'Cerrado', cls: 'bg-zinc-500/15 text-zinc-400', dotCls: 'bg-zinc-500' },
  cerrado: { label: 'Cerrado', cls: 'bg-zinc-500/15 text-zinc-400', dotCls: 'bg-zinc-500' },
  aceptado_empresa: { label: 'Aceptado', cls: 'bg-lime-500/15 text-lime-400', dotCls: 'bg-lime-500' },
  rechazado_con_pruebas: { label: 'Rechazado', cls: 'bg-red-500/15 text-red-400', dotCls: 'bg-red-500' },
  reparado: { label: 'Reparado', cls: 'bg-lime-500/15 text-lime-400', dotCls: 'bg-lime-500' },
};

const sourceLabels: Record<string, string> = { incident: 'Novedad de Campo', ticket: 'Ticket PQR', damage: 'Reporte de Daño' };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-PA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function isOpen(s: string) { return ['open', 'abierto', 'bajo_investigacion'].includes(s); }
function isProgress(s: string) { return ['in_progress', 'en_proceso'].includes(s); }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CentroComandoPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operations, setOperations] = useState<AlertItem[]>([]);
  const [clientAlerts, setClientAlerts] = useState<AlertItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [actionNotes, setActionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;
    setTenantId(tenant.id);

    const [incRes, tickRes, dmgRes] = await Promise.all([
      supabase.from('incidents_log').select('id, status, raw_text, ai_refined_text, created_at, work_stations(name, properties_ph(name))').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('client_tickets').select('id, category, subject, description, priority, status, created_at, properties_ph(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('client_damage_reports').select('id, item_damaged, description, cost_estimate, status, created_at, properties_ph(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
    ]);

    setOperations((incRes.data ?? []).map((i) => ({
      id: i.id, sourceType: 'incident',
      title: (i.work_stations as { name: string } | null)?.name ?? 'Puesto',
      description: i.ai_refined_text ?? i.raw_text,
      propertyName: (i.work_stations as { name: string; properties_ph: { name: string } | null } | null)?.properties_ph?.name ?? '',
      status: i.status, createdAt: i.created_at,
    })));

    setClientAlerts([
      ...(tickRes.data ?? []).map((t) => ({
        id: t.id, sourceType: 'ticket' as const, title: t.subject, description: t.description,
        propertyName: (t.properties_ph as { name: string } | null)?.name ?? '',
        status: t.status, createdAt: t.created_at,
      })),
      ...(dmgRes.data ?? []).map((d) => ({
        id: d.id, sourceType: 'damage' as const, title: `Daño: ${d.item_damaged}`, description: d.description,
        propertyName: (d.properties_ph as { name: string } | null)?.name ?? '',
        status: d.status, createdAt: d.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadAudit = useCallback(async (type: string, id: string) => {
    try {
      const res = await fetch(`/api/command-center?source_type=${type}&source_id=${id}`);
      if (res.ok) { const { data } = await res.json() as { data: AuditEntry[] }; setAuditTrail(data); }
    } catch { /* silent */ }
  }, []);

  const handleExpand = useCallback((item: AlertItem) => {
    if (expandedId === item.id) { setExpandedId(null); return; }
    setExpandedId(item.id); setActionNotes(''); setAuditTrail([]);
    loadAudit(item.sourceType, item.id);
  }, [expandedId, loadAudit]);

  const handleAction = useCallback(async (item: AlertItem, newStatus: string) => {
    if (!tenantId || !actionNotes.trim()) { setToast('Debe ingresar una nota'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/command-center', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: item.sourceType, source_id: item.id, tenant_id: tenantId, new_status: newStatus, notes: actionNotes.trim() }),
      });
      if (res.ok) { setToast('Acción registrada'); setExpandedId(null); setActionNotes(''); loadData(); }
      else setToast('Error al registrar');
    } catch { setToast('Error de conexión'); }
    finally { setSaving(false); }
  }, [tenantId, actionNotes, loadData]);

  const openOps = operations.filter((o) => isOpen(o.status)).length;
  const progressOps = operations.filter((o) => isProgress(o.status)).length;
  const openClient = clientAlerts.filter((c) => isOpen(c.status)).length;
  const progressAll = progressOps + clientAlerts.filter((c) => isProgress(c.status)).length;
  const today = new Date().toISOString().split('T')[0]!;
  const resolvedToday = operations.filter((o) => ['resolved', 'justified', 'closed'].includes(o.status) && o.createdAt.startsWith(today)).length
    + clientAlerts.filter((c) => ['resuelto', 'cerrado', 'aceptado_empresa', 'reparado'].includes(c.status) && c.createdAt.startsWith(today)).length;

  if (isLoading) {
    return <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" /></div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Control Central</p>
          <h1 className="text-lg font-bold">Centro de Comando</h1>
        </div>
        <div className="flex items-center gap-2">
          {openOps > 0 && <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">{openOps} novedad{openOps !== 1 ? 'es' : ''}</span>}
          {openClient > 0 && <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">{openClient} cliente</span>}
          {progressAll > 0 && <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400">{progressAll} en proceso</span>}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 border-b border-zinc-800/60 px-6 py-4">
        <KpiCard label="Novedades Abiertas" value={openOps} color="red" />
        <KpiCard label="Tickets Cliente" value={openClient} color="red" />
        <KpiCard label="En Proceso" value={progressAll} color="amber" />
        <KpiCard label="Resueltos Hoy" value={resolvedToday} color="lime" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-zinc-800/60 overflow-y-auto">
          <div className="px-5 py-3 border-b border-zinc-800/30">
            <p className="text-xs font-semibold tracking-widest text-red-400 uppercase">Novedades de Operaciones</p>
          </div>
          <AlertList items={operations} expandedId={expandedId} onExpand={handleExpand} auditTrail={auditTrail} actionNotes={actionNotes} setActionNotes={setActionNotes} onAction={handleAction} saving={saving} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-b border-zinc-800/30">
            <p className="text-xs font-semibold tracking-widest text-amber-400 uppercase">Novedades de Cliente</p>
          </div>
          <AlertList items={clientAlerts} expandedId={expandedId} onExpand={handleExpand} auditTrail={auditTrail} actionNotes={actionNotes} setActionNotes={setActionNotes} onAction={handleAction} saving={saving} />
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-lime-600 px-5 py-3 text-sm font-medium text-white shadow-lg animate-[slideUp_0.3s_ease-out]">{toast}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AlertList({ items, expandedId, onExpand, auditTrail, actionNotes, setActionNotes, onAction, saving }: {
  items: AlertItem[]; expandedId: string | null; onExpand: (i: AlertItem) => void;
  auditTrail: AuditEntry[]; actionNotes: string; setActionNotes: (v: string) => void;
  onAction: (i: AlertItem, s: string) => void; saving: boolean;
}) {
  if (items.length === 0) return <div className="flex h-48 items-center justify-center text-sm text-zinc-600">Sin alertas</div>;

  return (
    <div className="divide-y divide-zinc-800/20">
      {items.map((item) => {
        const stat = statusFlow[item.status] ?? statusFlow['open']!;
        const isExpanded = expandedId === item.id;
        const canAct = isOpen(item.status) || isProgress(item.status);

        const nextStatuses = item.sourceType === 'incident'
          ? (isOpen(item.status) ? [{ v: 'in_progress', l: 'En Proceso', c: 'bg-amber-600' }, { v: 'resolved', l: 'Resolver', c: 'bg-lime-600' }] : [{ v: 'resolved', l: 'Resolver', c: 'bg-lime-600' }])
          : item.sourceType === 'ticket'
            ? (isOpen(item.status) ? [{ v: 'en_proceso', l: 'En Proceso', c: 'bg-amber-600' }, { v: 'resuelto', l: 'Resolver', c: 'bg-lime-600' }] : [{ v: 'resuelto', l: 'Resolver', c: 'bg-lime-600' }])
            : (isOpen(item.status) ? [{ v: 'aceptado_empresa', l: 'Aceptar', c: 'bg-lime-600' }, { v: 'rechazado_con_pruebas', l: 'Rechazar', c: 'bg-red-600' }, { v: 'reparado', l: 'Reparado', c: 'bg-blue-600' }] : [{ v: 'reparado', l: 'Reparado', c: 'bg-blue-600' }]);

        return (
          <div key={item.id}>
            <div className="flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-zinc-800/20 transition-colors" onClick={() => onExpand(item)}>
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${stat.dotCls}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 font-mono shrink-0">{formatTime(item.createdAt)}</span>
                  <span className="text-[10px] text-zinc-500">{sourceLabels[item.sourceType]}</span>
                </div>
                <p className="mt-0.5 text-sm font-medium text-zinc-200 truncate">{item.propertyName ? `${item.propertyName} — ` : ''}{item.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500 truncate">{item.description}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${stat.cls}`}>{stat.label}</span>
            </div>

            {isExpanded && (
              <div className="px-5 py-4 bg-zinc-800/10 border-t border-zinc-800/20 space-y-4">
                <div>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">Detalle</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{item.description}</p>
                </div>

                {auditTrail.length > 0 && (
                  <div>
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-2">Historial de Acciones</p>
                    <div className="space-y-2">
                      {auditTrail.map((e) => {
                        const from = statusFlow[e.old_status] ?? statusFlow['open']!;
                        const to = statusFlow[e.new_status] ?? statusFlow['open']!;
                        return (
                          <div key={e.id} className="rounded-lg bg-zinc-800/30 px-4 py-2.5">
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className={`rounded-full px-1.5 py-0.5 ${from.cls}`}>{from.label}</span>
                              <span className="text-zinc-600">→</span>
                              <span className={`rounded-full px-1.5 py-0.5 ${to.cls}`}>{to.label}</span>
                              <span className="text-zinc-600 ml-auto">{e.action_by_name} · {formatTime(e.created_at)}</span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-400">{e.notes}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {canAct && (
                  <div className="space-y-3 border-t border-zinc-800/30 pt-3">
                    <textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="Describa la acción tomada (obligatorio)..." rows={2}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none resize-none" />
                    <div className="flex gap-2 justify-end">
                      {nextStatuses.map((ns) => (
                        <button key={ns.v} onClick={() => onAction(item, ns.v)} disabled={saving || !actionNotes.trim()}
                          className={`rounded-lg ${ns.c} px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 cursor-pointer`}>
                          {saving ? '...' : ns.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: 'red' | 'amber' | 'lime' }) {
  const cls = color === 'red' ? 'border-red-500/20 bg-red-500/5 text-red-400'
    : color === 'amber' ? 'border-amber-500/20 bg-amber-500/5 text-amber-400'
    : 'border-lime-500/20 bg-lime-500/5 text-lime-400';
  return (
    <div className={`rounded-xl border px-5 py-4 ${cls}`}>
      <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
