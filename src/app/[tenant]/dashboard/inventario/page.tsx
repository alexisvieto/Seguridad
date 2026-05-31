'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryRow {
  id: string;
  itemName: string;
  category: string;
  sizeOrModel: string | null;
  currentStock: number;
  minStockAlert: number;
}

interface AssetRow {
  id: string;
  stationId: string;
  stationName: string;
  propertyName: string;
  assetName: string;
  imei: string | null;
  status: 'bueno' | 'dañado' | 'en_reparacion';
  lastInspection: string;
  damageNotes: string | null;
}

interface AgentOption {
  id: string;
  name: string;
}

interface Toast {
  type: 'success' | 'error';
  msg: string;
}

type Tab = 'stock' | 'assets' | 'loans';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const categoryLabels: Record<string, string> = {
  uniforme: 'Uniforme',
  calzado: 'Calzado',
  comunicacion: 'Comunicación',
  defensa: 'Defensa',
  otros: 'Otros',
};

const assetStatusBadge: Record<string, { label: string; cls: string }> = {
  bueno: { label: 'Bueno', cls: 'bg-emerald-500/15 text-emerald-400' },
  dañado: { label: 'Dañado', cls: 'bg-red-500/15 text-red-400' },
  en_reparacion: { label: 'En reparación', cls: 'bg-amber-500/15 text-amber-400' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventarioPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('stock');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Stock
  const [inventory, setInventory] = useState<InventoryRow[]>([]);

  // Assets
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [damageModal, setDamageModal] = useState<AssetRow | null>(null);
  const [damageNotes, setDamageNotes] = useState('');
  const [damageLoading, setDamageLoading] = useState(false);

  // Loans
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loanAgent, setLoanAgent] = useState('');
  const [loanItem, setLoanItem] = useState('');
  const [loanQty, setLoanQty] = useState(1);
  const [loanLoading, setLoanLoading] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Toast auto-dismiss
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
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();

    if (!tenant) return;
    setTenantId(tenant.id);

    const [invRes, assetsRes, membRes] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('category')
        .order('item_name'),
      supabase
        .from('station_asset_custody')
        .select('*, work_stations(name, properties_ph(name))')
        .eq('tenant_id', tenant.id)
        .order('asset_name'),
      supabase
        .from('memberships')
        .select('user_id')
        .eq('tenant_id', tenant.id),
    ]);

    setInventory(
      (invRes.data ?? []).map((i) => ({
        id: i.id,
        itemName: i.item_name,
        category: i.category,
        sizeOrModel: i.size_or_model,
        currentStock: i.current_stock,
        minStockAlert: i.min_stock_alert,
      })),
    );

    setAssets(
      (assetsRes.data ?? []).map((a) => ({
        id: a.id,
        stationId: a.work_station_id,
        stationName: a.work_stations?.name ?? '',
        propertyName: a.work_stations?.properties_ph?.name ?? '',
        assetName: a.asset_name,
        imei: a.imei_or_serial,
        status: a.status,
        lastInspection: a.last_inspection_at,
        damageNotes: a.damage_report_notes,
      })),
    );

    const memberIds = (membRes.data ?? []).map((m) => m.user_id);
    if (memberIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds);
      setAgents((profiles ?? []).map((p) => ({ id: p.id, name: p.full_name })));
    }

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Report damage
  // -------------------------------------------------------------------

  const submitDamage = useCallback(async () => {
    if (!damageModal || !damageNotes.trim()) return;
    setDamageLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from('station_asset_custody')
        .update({
          status: 'dañado' as const,
          damage_report_notes: damageNotes.trim(),
        })
        .eq('id', damageModal.id);

      if (error) throw error;

      setAssets((prev) =>
        prev.map((a) =>
          a.id === damageModal.id
            ? { ...a, status: 'dañado', damageNotes: damageNotes.trim() }
            : a,
        ),
      );
      setToast({ type: 'success', msg: 'Reporte de daño registrado' });
      setDamageModal(null);
      setDamageNotes('');
    } catch {
      setToast({ type: 'error', msg: 'Error al reportar daño' });
    } finally {
      setDamageLoading(false);
    }
  }, [damageModal, damageNotes]);

  // -------------------------------------------------------------------
  // Submit loan
  // -------------------------------------------------------------------

  const submitLoan = useCallback(async () => {
    if (!tenantId || !loanAgent || !loanItem || !hasSigned) return;
    setLoanLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error: stockErr } = await supabase.rpc('decrement_stock', {
        p_item_id: loanItem,
        p_quantity: loanQty,
      });

      if (stockErr) {
        setToast({ type: 'error', msg: 'Stock insuficiente para esta entrega' });
        setLoanLoading(false);
        return;
      }

      const { error: loanErr } = await supabase
        .from('agent_equipment_loans')
        .insert({
          tenant_id: tenantId,
          user_id: loanAgent,
          item_id: loanItem,
          quantity: loanQty,
        });

      if (loanErr) {
        await supabase.rpc('increment_stock', {
          p_item_id: loanItem,
          p_quantity: loanQty,
        });
        throw loanErr;
      }

      setInventory((prev) =>
        prev.map((i) =>
          i.id === loanItem ? { ...i, currentStock: i.currentStock - loanQty } : i,
        ),
      );

      setToast({ type: 'success', msg: 'Entrega registrada correctamente' });
      setLoanAgent('');
      setLoanItem('');
      setLoanQty(1);
      setHasSigned(false);
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar la entrega' });
    } finally {
      setLoanLoading(false);
    }
  }, [tenantId, loanAgent, loanItem, loanQty, hasSigned]);

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------

  const lowStockItems = inventory.filter((i) => i.currentStock <= i.minStockAlert);
  const availableForLoan = inventory.filter((i) => i.currentStock > 0);

  // -------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          <p className="text-sm tracking-widest text-zinc-500 uppercase">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <BoxIcon />
          <h1 className="text-lg font-semibold tracking-wide">Inventario Operativo</h1>
          <span className="text-sm text-zinc-500">{tenantSlug}</span>
        </div>
      </header>

      {/* ALERT BANNER */}
      {lowStockItems.length > 0 && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-6 py-3">
          <div className="flex items-center gap-3">
            <AlertIcon />
            <div>
              <p className="text-sm font-semibold text-red-400">
                Alerta de Reabastecimiento — {lowStockItems.length} artículo{lowStockItems.length > 1 ? 's' : ''} bajo mínimo
              </p>
              <p className="mt-0.5 text-xs text-red-400/70">
                {lowStockItems.map((i) => `${i.itemName} (${i.currentStock}/${i.minStockAlert})`).join(' · ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-1 border-b border-zinc-800/60 px-6 pt-2">
        {([
          { key: 'stock' as Tab, label: 'Stock General' },
          { key: 'assets' as Tab, label: 'Activos por Puesto' },
          { key: 'loans' as Tab, label: 'Entrega a Agentes' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-lg px-5 py-3 text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
              tab === t.key
                ? 'bg-zinc-800/60 text-zinc-100 border-b-2 border-emerald-500'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ============================================================ */}
        {/* TAB: Stock General                                            */}
        {/* ============================================================ */}
        {tab === 'stock' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Artículo</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Talla / Modelo</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase text-right">Stock</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase text-right">Mínimo</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => {
                  const isLow = item.currentStock <= item.minStockAlert;
                  const isEmpty = item.currentStock === 0;
                  return (
                    <tr key={item.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-100">{item.itemName}</td>
                      <td className="px-4 py-3 text-zinc-400">{categoryLabels[item.category] ?? item.category}</td>
                      <td className="px-4 py-3 text-zinc-500">{item.sizeOrModel ?? '—'}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${
                        isEmpty ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {item.currentStock}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{item.minStockAlert}</td>
                      <td className="px-4 py-3 text-center">
                        {isEmpty ? (
                          <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-400">Agotado</span>
                        ) : isLow ? (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-400">Bajo</span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {inventory.length === 0 && (
              <p className="py-16 text-center text-sm text-zinc-600">No hay artículos registrados</p>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: Activos por Puesto                                       */}
        {/* ============================================================ */}
        {tab === 'assets' && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const badge = assetStatusBadge[asset.status] ?? assetStatusBadge['bueno']!;
              return (
                <div
                  key={asset.id}
                  className={`rounded-xl border px-5 py-4 ${
                    asset.status === 'dañado'
                      ? 'border-red-500/30 bg-red-500/5'
                      : asset.status === 'en_reparacion'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-zinc-700/30 bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase truncate">
                        {asset.propertyName} — {asset.stationName}
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-zinc-100 truncate">
                        {asset.assetName}
                      </p>
                      {asset.imei && (
                        <p className="mt-0.5 text-xs font-mono text-zinc-500">{asset.imei}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">
                      Inspección: {formatDate(asset.lastInspection)}
                    </p>
                    <button
                      onClick={() => { setDamageModal(asset); setDamageNotes(asset.damageNotes ?? ''); }}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-zinc-700/50 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 cursor-pointer"
                    >
                      <DamageIcon />
                      Reportar
                    </button>
                  </div>

                  {asset.damageNotes && asset.status === 'dañado' && (
                    <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 italic">
                      {asset.damageNotes}
                    </p>
                  )}
                </div>
              );
            })}
            {assets.length === 0 && (
              <p className="col-span-full py-16 text-center text-sm text-zinc-600">No hay activos registrados</p>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: Entrega a Agentes                                        */}
        {/* ============================================================ */}
        {tab === 'loans' && (
          <div className="mx-auto max-w-lg space-y-6">

            <div className="rounded-2xl border border-zinc-700/30 bg-zinc-800/30 p-6 space-y-5">
              <h2 className="text-sm font-semibold tracking-widest text-zinc-400 uppercase">
                Formulario de Entrega
              </h2>

              {/* Agent select */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Agente</span>
                <select
                  value={loanAgent}
                  onChange={(e) => setLoanAgent(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Seleccionar agente...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>

              {/* Item select */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Artículo</span>
                <select
                  value={loanItem}
                  onChange={(e) => setLoanItem(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Seleccionar artículo...</option>
                  {availableForLoan.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemName}{i.sizeOrModel ? ` (${i.sizeOrModel})` : ''} — Stock: {i.currentStock}
                    </option>
                  ))}
                </select>
              </label>

              {/* Quantity */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Cantidad</span>
                <input
                  type="number"
                  min={1}
                  max={inventory.find((i) => i.id === loanItem)?.currentStock ?? 99}
                  value={loanQty}
                  onChange={(e) => setLoanQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none"
                />
              </label>

              {/* Signature pad */}
              <div>
                <span className="text-xs font-medium text-zinc-400">Firma Digital de Conformidad del Agente</span>
                <SignaturePad
                  onSign={() => setHasSigned(true)}
                  onClear={() => setHasSigned(false)}
                />
              </div>

              {/* Submit */}
              <button
                onClick={submitLoan}
                disabled={!loanAgent || !loanItem || !hasSigned || loanLoading}
                className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40 cursor-pointer"
              >
                {loanLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <CheckIcon />
                    Registrar Entrega
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* DAMAGE MODAL                                                  */}
      {/* ============================================================ */}
      {damageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDamageModal(null); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Reportar Daño</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {damageModal.assetName} — {damageModal.stationName}
            </p>

            <label className="mt-5 block">
              <span className="text-xs font-medium text-zinc-400">Descripción del daño</span>
              <textarea
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Describe el daño, golpe o falla del equipo..."
                className="mt-1 block w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 focus:outline-none"
              />
            </label>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDamageModal(null)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 cursor-pointer min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                onClick={submitDamage}
                disabled={!damageNotes.trim() || damageLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40 cursor-pointer min-h-[48px]"
              >
                {damageLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  'Confirmar Daño'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
// Signature Pad Component
// ---------------------------------------------------------------------------

function SignaturePad({
  onSign,
  onClear,
}: {
  onSign: () => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const hasStrokesRef = useRef(false);

  const getPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    if (!hasStrokesRef.current) {
      hasStrokesRef.current = true;
      onSign();
    }
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokesRef.current = false;
    onClear();
  };

  return (
    <div className="mt-1">
      <div className="relative rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={460}
          height={140}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 140 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!hasStrokesRef.current && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-600">
            Firme aquí con el dedo o mouse
          </p>
        )}
      </div>
      <button
        onClick={clearCanvas}
        type="button"
        className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
      >
        Limpiar firma
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function BoxIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function DamageIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
