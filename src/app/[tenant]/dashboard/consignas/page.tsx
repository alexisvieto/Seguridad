'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PropertyGroup {
  id: string;
  name: string;
  stations: StationRow[];
}

interface StationRow {
  id: string;
  name: string;
  propertyId: string;
  consignas: ConsignaRow[];
}

interface ConsignaRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  isActive: boolean;
}

const prioBadge: Record<string, { label: string; cls: string }> = {
  critica: { label: 'Crítica', cls: 'bg-red-500/15 text-red-400' },
  alta: { label: 'Alta', cls: 'bg-amber-500/15 text-amber-400' },
  media: { label: 'Media', cls: 'bg-blue-500/15 text-blue-400' },
  baja: { label: 'Baja', cls: 'bg-zinc-500/15 text-zinc-400' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConsignasPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<PropertyGroup[]>([]);
  const [expandedStation, setExpandedStation] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Add consigna
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [cgTitle, setCgTitle] = useState('');
  const [cgDesc, setCgDesc] = useState('');
  const [cgPriority, setCgPriority] = useState('media');
  const [cgLoading, setCgLoading] = useState(false);

  // Edit consigna
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('media');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;
    setTenantId(tenant.id);

    const [propsRes, stationsRes, consignasRes] = await Promise.all([
      supabase.from('properties_ph').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('work_stations').select('id, name, property_id').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('station_consignas').select('id, title, description, priority, is_active, work_station_id').eq('tenant_id', tenant.id).order('priority'),
    ]);

    const consignasByStation = new Map<string, ConsignaRow[]>();
    for (const c of consignasRes.data ?? []) {
      const arr = consignasByStation.get(c.work_station_id) ?? [];
      arr.push({ id: c.id, title: c.title, description: c.description, priority: c.priority, isActive: c.is_active });
      consignasByStation.set(c.work_station_id, arr);
    }

    const stationsByProperty = new Map<string, StationRow[]>();
    for (const s of stationsRes.data ?? []) {
      const arr = stationsByProperty.get(s.property_id) ?? [];
      arr.push({ id: s.id, name: s.name, propertyId: s.property_id, consignas: consignasByStation.get(s.id) ?? [] });
      stationsByProperty.set(s.property_id, arr);
    }

    setGroups((propsRes.data ?? [])
      .filter((p) => stationsByProperty.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, stations: stationsByProperty.get(p.id) ?? [] }))
    );

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddConsigna = useCallback(async () => {
    if (!tenantId || !addingTo || !cgTitle.trim()) return;
    setCgLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.from('station_consignas').insert({
        tenant_id: tenantId, work_station_id: addingTo, title: cgTitle.trim(),
        description: cgDesc.trim() || null, priority: cgPriority,
      });
      setToast('Consigna agregada');
      setAddingTo(null); setCgTitle(''); setCgDesc(''); setCgPriority('media');
      loadData();
    } catch { setToast('Error al agregar'); }
    finally { setCgLoading(false); }
  }, [tenantId, addingTo, cgTitle, cgDesc, cgPriority, loadData]);

  const handleEditConsigna = useCallback(async () => {
    if (!editingId || !editTitle.trim()) return;
    setEditLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.from('station_consignas').update({
        title: editTitle.trim(), description: editDesc.trim() || null,
        priority: editPriority, updated_at: new Date().toISOString(),
      }).eq('id', editingId);
      setToast('Consigna actualizada');
      setEditingId(null);
      loadData();
    } catch { setToast('Error al actualizar'); }
    finally { setEditLoading(false); }
  }, [editingId, editTitle, editDesc, editPriority, loadData]);

  const handleToggleActive = useCallback(async (id: string, current: boolean) => {
    const supabase = getSupabaseBrowserClient();
    await supabase.from('station_consignas').update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    setToast(current ? 'Consigna desactivada' : 'Consigna reactivada');
    loadData();
  }, [loadData]);

  const totalConsignas = groups.reduce((sum, g) => sum + g.stations.reduce((s, st) => s + st.consignas.length, 0), 0);
  const totalStations = groups.reduce((sum, g) => sum + g.stations.length, 0);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Operaciones</p>
          <h1 className="text-lg font-bold">Consignas por Puesto</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{totalStations} puestos</span>
          <span className="rounded-full bg-lime-500/15 px-3 py-1 text-xs text-lime-400">{totalConsignas} consignas</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {groups.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-600">No hay propiedades con puestos configurados</div>
        ) : groups.map((group) => (
          <div key={group.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/10 overflow-hidden">
            {/* Property header */}
            <div className="px-5 py-3 border-b border-zinc-800/30">
              <p className="text-sm font-semibold text-zinc-100">{group.name}</p>
              <p className="text-[10px] text-zinc-600">{group.stations.length} puesto{group.stations.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Stations */}
            <div className="divide-y divide-zinc-800/20">
              {group.stations.map((station) => {
                const isExpanded = expandedStation === station.id;
                const activeCount = station.consignas.filter((c) => c.isActive).length;

                return (
                  <div key={station.id}>
                    {/* Station row */}
                    <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                      onClick={() => setExpandedStation(isExpanded ? null : station.id)}>
                      <div className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${activeCount > 0 ? 'bg-lime-500' : 'bg-zinc-600'}`} />
                        <p className="text-sm font-medium text-zinc-200">{station.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{activeCount} consigna{activeCount !== 1 ? 's' : ''}</span>
                        <svg className={`h-4 w-4 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded consignas */}
                    {isExpanded && (
                      <div className="bg-zinc-800/10 border-t border-zinc-800/20">
                        {station.consignas.length === 0 ? (
                          <p className="px-5 py-3 text-xs text-zinc-600 italic">Sin consignas. Agregue la primera tarea para este puesto.</p>
                        ) : (
                          <div className="divide-y divide-zinc-800/10">
                            {station.consignas.map((c) => {
                              const badge = prioBadge[c.priority] ?? prioBadge['media']!;
                              const isEditing = editingId === c.id;

                              return (
                                <div key={c.id} className={`px-5 py-3 ${!c.isActive ? 'opacity-50' : ''}`}>
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-lime-500 focus:outline-none" />
                                      <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descripción (opcional)"
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-lime-500 focus:outline-none" />
                                      <div className="flex items-center gap-2">
                                        <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}
                                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-lime-500 focus:outline-none cursor-pointer">
                                          <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option>
                                        </select>
                                        <button onClick={() => setEditingId(null)} className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">Cancelar</button>
                                        <button onClick={handleEditConsigna} disabled={editLoading || !editTitle.trim()}
                                          className="rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                                          {editLoading ? '...' : 'Guardar'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                                          <p className="text-sm text-zinc-200">{c.title}</p>
                                        </div>
                                        {c.description && <p className="mt-1 text-xs text-zinc-500">{c.description}</p>}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setEditTitle(c.title); setEditDesc(c.description ?? ''); setEditPriority(c.priority); }}
                                          className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer">Editar</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleToggleActive(c.id, c.isActive); }}
                                          className={`px-2 py-1 text-[10px] cursor-pointer ${c.isActive ? 'text-amber-500 hover:text-amber-400' : 'text-lime-500 hover:text-lime-400'}`}>
                                          {c.isActive ? 'Desactivar' : 'Activar'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add consigna form */}
                        {addingTo === station.id ? (
                          <div className="px-5 py-3 border-t border-zinc-800/20 space-y-2">
                            <input type="text" value={cgTitle} onChange={(e) => setCgTitle(e.target.value)}
                              placeholder="Ej: Ronda en área social 8am, 6pm y 12am"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-lime-500 focus:outline-none" />
                            <input type="text" value={cgDesc} onChange={(e) => setCgDesc(e.target.value)}
                              placeholder="Descripción detallada (opcional)"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-lime-500 focus:outline-none" />
                            <div className="flex items-center gap-2">
                              <select value={cgPriority} onChange={(e) => setCgPriority(e.target.value)}
                                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-lime-500 focus:outline-none cursor-pointer">
                                <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option>
                              </select>
                              <button onClick={() => { setAddingTo(null); setCgTitle(''); setCgDesc(''); }} className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">Cancelar</button>
                              <button onClick={handleAddConsigna} disabled={cgLoading || !cgTitle.trim()}
                                className="rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                                {cgLoading ? '...' : 'Agregar'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="px-5 py-2 border-t border-zinc-800/20">
                            <button onClick={() => { setAddingTo(station.id); setCgTitle(''); setCgDesc(''); setCgPriority('media'); }}
                              className="text-[11px] font-medium text-lime-400 hover:text-lime-300 cursor-pointer">+ Agregar Consigna</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-lime-600 px-5 py-3 text-sm font-medium text-white shadow-lg animate-[slideUp_0.3s_ease-out]">{toast}</div>}
    </div>
  );
}
