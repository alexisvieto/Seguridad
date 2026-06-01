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

interface LoanRecord {
  id: string;
  agentName: string;
  itemName: string;
  quantity: number;
  loanDate: string;
  status: string;
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
  const [loanKey, setLoanKey] = useState(0);
  const [loanSuccess, setLoanSuccess] = useState(false);
  const [loanHistory, setLoanHistory] = useState<LoanRecord[]>([]);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  // Assets - expanded station
  const [expandedStation, setExpandedStation] = useState<string | null>(null);

  // Create stock item modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [newCategory, setNewCategory] = useState('uniforme');
  const [newItemName, setNewItemName] = useState('');
  const [newQty, setNewQty] = useState(0);
  const [newMinAlert, setNewMinAlert] = useState(5);
  const [newLote, setNewLote] = useState('');
  const [stockCreateLoading, setStockCreateLoading] = useState(false);

  // Create asset modal
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetStation, setAssetStation] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetImei, setAssetImei] = useState('');
  const [assetCreateLoading, setAssetCreateLoading] = useState(false);
  const [stationOptions, setStationOptions] = useState<{ id: string; name: string; property: string }[]>([]);

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
    let profileMap = new Map<string, string>();
    if (memberIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds);
      setAgents((profiles ?? []).map((p) => ({ id: p.id, name: p.full_name })));
      profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    }

    // Load loan history
    const { data: loansData } = await supabase
      .from('agent_equipment_loans')
      .select('id, user_id, item_id, quantity, loan_date, status')
      .eq('tenant_id', tenant.id)
      .order('loan_date', { ascending: false })
      .limit(100);

    const itemMap = new Map((invRes.data ?? []).map((i) => [i.id, i.item_name]));

    setLoanHistory(
      (loansData ?? []).map((l) => ({
        id: l.id,
        agentName: profileMap.get(l.user_id) ?? 'Agente',
        itemName: itemMap.get(l.item_id) ?? 'Artículo',
        quantity: l.quantity,
        loanDate: l.loan_date,
        status: l.status,
      })),
    );

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

  // -------------------------------------------------------------------
  // Create stock item
  // -------------------------------------------------------------------

  const handleCreateStock = useCallback(async () => {
    if (!tenantId || !newItemName.trim()) return;
    setStockCreateLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          tenant_id: tenantId,
          item_name: newItemName.trim(),
          category: newCategory as 'uniforme' | 'calzado' | 'comunicacion' | 'defensa' | 'otros',
          size_or_model: newLote.trim() || null,
          current_stock: newQty,
          min_stock_alert: newMinAlert,
        })
        .select()
        .single();

      if (error) {
        setToast({ type: 'error', msg: 'Error al registrar el articulo' });
        setStockCreateLoading(false);
        return;
      }

      if (data) {
        setInventory((prev) => [...prev, {
          id: data.id,
          itemName: data.item_name,
          category: data.category,
          sizeOrModel: data.size_or_model,
          currentStock: data.current_stock,
          minStockAlert: data.min_stock_alert,
        }]);
      }

      setToast({ type: 'success', msg: 'Articulo ingresado a bodega' });
      setShowStockModal(false);
      setNewItemName('');
      setNewQty(0);
      setNewMinAlert(5);
      setNewLote('');
      setNewCategory('uniforme');
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar el articulo' });
    } finally {
      setStockCreateLoading(false);
    }
  }, [tenantId, newItemName, newCategory, newQty, newMinAlert, newLote]);

  // -------------------------------------------------------------------
  // Create asset + load stations
  // -------------------------------------------------------------------

  const openAssetModal = useCallback(async () => {
    if (!tenantId) return;
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from('work_stations')
      .select('id, name, properties_ph(name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    setStationOptions((data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      property: s.properties_ph?.name ?? '',
    })));
    setAssetStation('');
    setAssetName('');
    setAssetImei('');
    setShowAssetModal(true);
  }, [tenantId]);

  const handleCreateAsset = useCallback(async () => {
    if (!tenantId || !assetStation || !assetName.trim()) return;
    setAssetCreateLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('station_asset_custody')
        .insert({
          tenant_id: tenantId,
          work_station_id: assetStation,
          asset_name: assetName.trim(),
          imei_or_serial: assetImei.trim() || null,
        })
        .select('*, work_stations(name, properties_ph(name))')
        .single();

      if (error) {
        if (error.code === '23505') {
          setToast({ type: 'error', msg: 'Ya existe un activo con ese IMEI/serial' });
        } else {
          setToast({ type: 'error', msg: 'Error al registrar el activo' });
        }
        setAssetCreateLoading(false);
        return;
      }

      if (data) {
        setAssets((prev) => [...prev, {
          id: data.id,
          stationId: data.work_station_id,
          stationName: data.work_stations?.name ?? '',
          propertyName: data.work_stations?.properties_ph?.name ?? '',
          assetName: data.asset_name,
          imei: data.imei_or_serial,
          status: data.status,
          lastInspection: data.last_inspection_at,
          damageNotes: data.damage_report_notes,
        }]);
      }

      setToast({ type: 'success', msg: 'Activo asignado al puesto' });
      setShowAssetModal(false);
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar el activo' });
    } finally {
      setAssetCreateLoading(false);
    }
  }, [tenantId, assetStation, assetName, assetImei]);

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

      setLoanLoading(false);
      setLoanSuccess(true);
      setToast({ type: 'success', msg: 'Entrega registrada correctamente' });
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Bodega General</h2>
              <button onClick={() => setShowStockModal(true)}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer">
                <PlusIcon /> Ingresar Mercancia
              </button>
            </div>
            {inventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60">
                  <BoxIconLg />
                </div>
                <p className="text-sm font-medium text-zinc-400">Bodega vacia</p>
                <p className="text-xs text-zinc-600">Ingrese el inventario inicial de uniformes, radios y equipos</p>
                <button onClick={() => setShowStockModal(true)}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer">
                  <PlusIcon /> Ingresar Primera Mercancia
                </button>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: Activos por Puesto                                       */}
        {/* ============================================================ */}
        {tab === 'assets' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Equipos Asignados a Puestos</h2>
              <button onClick={openAssetModal}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer">
                <PlusIcon /> Asignar Equipo a Puesto
              </button>
            </div>
            {assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60">
                  <StationIcon />
                </div>
                <p className="text-sm font-medium text-zinc-400">Sin equipos asignados a puestos</p>
                <p className="text-xs text-zinc-600">Asigne celulares, radios y equipos fijos a cada garita o puesto de vigilancia</p>
                <button onClick={openAssetModal}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer">
                  <PlusIcon /> Asignar Primer Equipo
                </button>
              </div>
            ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(() => {
              const grouped = new Map<string, { stationName: string; propertyName: string; items: AssetRow[] }>();
              for (const a of assets) {
                const key = a.stationId;
                if (!grouped.has(key)) {
                  grouped.set(key, { stationName: a.stationName, propertyName: a.propertyName, items: [] });
                }
                grouped.get(key)!.items.push(a);
              }
              return [...grouped.entries()].map(([stationId, group]) => {
                const isExpanded = expandedStation === stationId;
                const okCount = group.items.filter((i) => i.status === 'bueno').length;
                const damagedCount = group.items.filter((i) => i.status !== 'bueno').length;

                return (
                  <div key={stationId} className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 overflow-hidden">
                    {/* Card header - clickable */}
                    <div
                      className="px-5 py-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                      onClick={() => setExpandedStation(isExpanded ? null : stationId)}
                    >
                      <p className="text-sm font-semibold text-zinc-100">{group.propertyName}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{group.stationName}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="rounded-full bg-zinc-700/50 px-2.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
                          {group.items.length} equipo{group.items.length !== 1 ? 's' : ''}
                        </span>
                        {okCount > 0 && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">{okCount} OK</span>
                        )}
                        {damagedCount > 0 && (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400">{damagedCount} daño</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-zinc-800/30 divide-y divide-zinc-800/20">
                        {group.items.map((asset) => {
                          const badge = assetStatusBadge[asset.status] ?? assetStatusBadge['bueno']!;
                          return (
                            <div key={asset.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-zinc-200 truncate">{asset.assetName}</p>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {asset.imei && <p className="text-xs font-mono text-zinc-600">{asset.imei}</p>}
                                  <p className="text-xs text-zinc-600">Inspección: {formatDate(asset.lastInspection)}</p>
                                </div>
                                {asset.damageNotes && asset.status === 'dañado' && (
                                  <p className="mt-1 text-xs text-red-400 italic">{asset.damageNotes}</p>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDamageModal(asset); setDamageNotes(asset.damageNotes ?? ''); }}
                                className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-zinc-700/40 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 cursor-pointer shrink-0 ml-3"
                              >
                                <DamageIcon />
                                Reportar
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: Entrega a Agentes                                        */}
        {/* ============================================================ */}
        {tab === 'loans' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
                Entregas Realizadas — {loanHistory.length} registro{loanHistory.length !== 1 ? 's' : ''}
              </h2>
              <button
                onClick={() => { setShowLoanForm(true); setLoanSuccess(false); setLoanAgent(''); setLoanItem(''); setLoanQty(1); setHasSigned(false); setLoanKey((k) => k + 1); }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer"
              >
                <PlusIcon /> Formulario de Entrega
              </button>
            </div>

            {loanHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60">
                  <CheckIcon />
                </div>
                <p className="text-sm font-medium text-zinc-400">Sin entregas registradas</p>
                <p className="text-xs text-zinc-600">Registre la primera entrega de equipo a un agente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const byMonth = new Map<string, LoanRecord[]>();
                  for (const l of loanHistory) {
                    const d = new Date(l.loanDate);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    if (!byMonth.has(key)) byMonth.set(key, []);
                    byMonth.get(key)!.push(l);
                  }
                  return [...byMonth.entries()].map(([monthKey, items]) => {
                    const [year, month] = monthKey.split('-');
                    const monthName = new Date(Number(year), Number(month) - 1).toLocaleDateString('es-PA', { month: 'long', year: 'numeric' });

                    return (
                      <div key={monthKey} className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/30">
                          <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
                            Entregas {monthName}
                          </p>
                          <span className="rounded-full bg-zinc-700/50 px-2.5 py-0.5 text-xs tabular-nums text-zinc-400">
                            {items.length}
                          </span>
                        </div>
                        <div className="divide-y divide-zinc-800/20">
                          {items.map((l) => {
                            const isExpanded = expandedLoan === l.id;
                            const statusCls = l.status === 'entregado' ? 'bg-emerald-500/15 text-emerald-400'
                              : l.status === 'devuelto' ? 'bg-blue-500/15 text-blue-400'
                              : 'bg-red-500/15 text-red-400';
                            const statusLabel = l.status === 'entregado' ? 'Entregado'
                              : l.status === 'devuelto' ? 'Devuelto'
                              : 'Descontado';

                            return (
                              <div key={l.id}>
                                <div
                                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                                  onClick={() => setExpandedLoan(isExpanded ? null : l.id)}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xs font-mono text-zinc-600 shrink-0">{formatDate(l.loanDate)}</span>
                                    <p className="text-sm font-medium text-zinc-200 truncate">{l.agentName}</p>
                                    <span className="text-xs text-zinc-500 truncate hidden sm:inline">— {l.itemName} x{l.quantity}</span>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusCls}`}>{statusLabel}</span>
                                </div>

                                {isExpanded && (
                                  <div className="px-5 py-4 bg-zinc-800/10 border-t border-zinc-800/20 space-y-3">
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                      <div><span className="text-zinc-500">Agente:</span> <span className="text-zinc-200 font-medium">{l.agentName}</span></div>
                                      <div><span className="text-zinc-500">Fecha:</span> <span className="text-zinc-200">{formatDate(l.loanDate)}</span></div>
                                      <div><span className="text-zinc-500">Artículo:</span> <span className="text-zinc-200">{l.itemName}</span></div>
                                      <div><span className="text-zinc-500">Cantidad:</span> <span className="text-zinc-200">{l.quantity}</span></div>
                                    </div>
                                    <div className="flex justify-end">
                                      <a
                                        href={`/api/inventory/loans-pdf?tenant_slug=${tenantSlug}&loan_id=${l.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex min-h-[36px] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                                      >
                                        <PdfIcon /> Descargar PDF
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {/* LOAN FORM MODAL */}
        {showLoanForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowLoanForm(false); }}>
            <div key={loanKey} className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              {loanSuccess ? (
                <div className="py-10 text-center space-y-4">
                  <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-emerald-500/15">
                    <CheckIcon />
                  </div>
                  <p className="text-lg font-semibold text-emerald-400">Entrega registrada</p>
                  <p className="text-sm text-zinc-500">El stock se actualizó automáticamente</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => { setShowLoanForm(false); loadData(); }}
                      className="rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer">
                      Cerrar
                    </button>
                    <button onClick={() => { setLoanSuccess(false); setLoanAgent(''); setLoanItem(''); setLoanQty(1); setHasSigned(false); setLoanKey((k) => k + 1); }}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 cursor-pointer">
                      Nueva Entrega
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-5">Formulario de Entrega</h3>
                  <div className="space-y-5">
                    <label className="block">
                      <span className="text-xs font-medium text-zinc-400">Agente</span>
                      <select value={loanAgent} onChange={(e) => setLoanAgent(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none cursor-pointer">
                        <option value="">Seleccionar agente...</option>
                        {agents.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-zinc-400">Artículo</span>
                      <select value={loanItem} onChange={(e) => setLoanItem(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none cursor-pointer">
                        <option value="">Seleccionar artículo...</option>
                        {availableForLoan.map((i) => (<option key={i.id} value={i.id}>{i.itemName}{i.sizeOrModel ? ` (${i.sizeOrModel})` : ''} — Stock: {i.currentStock}</option>))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-zinc-400">Cantidad</span>
                      <input type="number" min={1} max={inventory.find((i) => i.id === loanItem)?.currentStock ?? 99} value={loanQty}
                        onChange={(e) => setLoanQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none" />
                    </label>
                    <div>
                      <span className="text-xs font-medium text-zinc-400">Firma Digital del Agente</span>
                      <SignaturePad onSign={() => setHasSigned(true)} onClear={() => setHasSigned(false)} />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setShowLoanForm(false)}
                        className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">
                        Cancelar
                      </button>
                      <button onClick={submitLoan} disabled={!loanAgent || !loanItem || !hasSigned || loanLoading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                        {loanLoading ? <SpinnerSm /> : <><CheckIcon /> Registrar</>}
                      </button>
                    </div>
                  </div>
                </>
              )}
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

      {/* STOCK CREATE MODAL */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowStockModal(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Ingresar Mercancia a Bodega</h3>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Categoria</span>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none cursor-pointer">
                  <option value="uniforme">Uniforme</option>
                  <option value="calzado">Calzado</option>
                  <option value="comunicacion">Radio / Comunicacion</option>
                  <option value="defensa">Chaleco Balistico / Defensa</option>
                  <option value="otros">Linterna / Otros</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Item / Descripcion</span>
                <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Ej: Camisa Operativa Azul Talla L" maxLength={200}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-emerald-500 focus:outline-none" />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Cantidad Inicial</span>
                  <input type="number" min={0} value={newQty} onChange={(e) => setNewQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Alerta Minima</span>
                  <input type="number" min={0} value={newMinAlert} onChange={(e) => setNewMinAlert(Math.max(0, parseInt(e.target.value) || 0))}
                    className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Lote / Factura (opcional)</span>
                <input type="text" value={newLote} onChange={(e) => setNewLote(e.target.value)} placeholder="Referencia de compra"
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-emerald-500 focus:outline-none" />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowStockModal(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleCreateStock} disabled={!newItemName.trim() || stockCreateLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {stockCreateLoading ? <SpinnerSm /> : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSET CREATE MODAL */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAssetModal(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Asignar Equipo a Puesto</h3>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Puesto de Vigilancia</span>
                <select value={assetStation} onChange={(e) => setAssetStation(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-emerald-500 focus:outline-none cursor-pointer">
                  <option value="">Seleccionar puesto...</option>
                  {stationOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.property}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Nombre del Equipo</span>
                <input type="text" value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Ej: Celular Samsung A15, Radio Motorola" maxLength={200}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-emerald-500 focus:outline-none" />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-zinc-400">IMEI / Serial (opcional)</span>
                <input type="text" value={assetImei} onChange={(e) => setAssetImei(e.target.value)} placeholder="Identificador del dispositivo"
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 font-mono min-h-[48px] focus:border-emerald-500 focus:outline-none" />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowAssetModal(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleCreateAsset} disabled={!assetStation || !assetName.trim() || assetCreateLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {assetCreateLoading ? <SpinnerSm /> : 'Asignar Equipo'}
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

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function BoxIconLg() {
  return (
    <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function StationIcon() {
  return (
    <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function SpinnerSm() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
