'use client';

import { useState, useEffect, useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertLevel = 'green' | 'yellow' | 'red';

interface FirearmRow {
  id: string;
  serialNumber: string;
  type: 'revolver' | 'pistola' | 'escopeta';
  brand: string;
  model: string;
  status: 'operativa' | 'mantenimiento' | 'retirada';
  permitNumber: string;
  permitExpiry: string;
  permitAlert: AlertLevel;
  daysToExpiry: number;
  locationId: string | null;
  locationName: string | null;
  permitDocUrl: string | null;
}

interface LocationOption {
  id: string;
  name: string;
}

interface AssignmentRecord {
  id: string;
  stationName: string | null;
  agentName: string | null;
  assignedAt: string;
  returnedAt: string | null;
  notes: string | null;
  signatureData: string | null;
  returnLocationName: string | null;
}

interface ComplianceRow {
  agentName: string;
  userId: string;
  shooting: { expiry: string; level: AlertLevel };
  psych: { expiry: string; level: AlertLevel };
  doping: { expiry: string; level: AlertLevel };
}

interface StationOption {
  id: string;
  name: string;
  propertyName: string;
}

interface AgentOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function alertLevel(dateStr: string): AlertLevel {
  const d = daysUntil(dateStr);
  if (d <= 0) return 'red';
  if (d <= 30) return 'yellow';
  return 'green';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const alertDot: Record<AlertLevel, string> = {
  green: 'bg-lime-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

const alertBg: Record<AlertLevel, string> = {
  green: 'bg-lime-500/8 border-lime-500/20',
  yellow: 'bg-amber-500/8 border-amber-500/20',
  red: 'bg-red-500/8 border-red-500/20',
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  operativa: { label: 'Operativa', cls: 'bg-lime-500/15 text-lime-400' },
  mantenimiento: { label: 'Mantenimiento', cls: 'bg-amber-500/15 text-amber-400' },
  retirada: { label: 'Retirada', cls: 'bg-zinc-500/15 text-zinc-400' },
};

const typeLabels: Record<string, string> = {
  revolver: 'Revólver',
  pistola: 'Pistola',
  escopeta: 'Escopeta',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ArmamentoPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [firearms, setFirearms] = useState<FirearmRow[]>([]);
  const [compliance, setCompliance] = useState<ComplianceRow[]>([]);
  const [selected, setSelected] = useState<FirearmRow | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [assignTarget, setAssignTarget] = useState<'station' | 'agent'>('station');
  const [assignTargetId, setAssignTargetId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Create firearm modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newType, setNewType] = useState<'revolver' | 'pistola' | 'escopeta'>('pistola');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [newPermit, setNewPermit] = useState('');
  const [newPermitExpiry, setNewPermitExpiry] = useState('');
  const [newStatus, setNewStatus] = useState<'operativa' | 'mantenimiento' | 'retirada'>('operativa');
  const [newLocationId, setNewLocationId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Locations
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [showLocForm, setShowLocForm] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [locLoading, setLocLoading] = useState(false);

  // Return
  const [showReturnModal, setShowReturnModal] = useState<string | null>(null);
  const [returnLocId, setReturnLocId] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);

  // Signature for assignment
  const [hasSigned, setHasSigned] = useState(false);
  const [signKey, setSignKey] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);

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

    const [firearmsRes, complianceRes, locsRes] = await Promise.all([
      supabase
        .from('firearms_inventory')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('serial_number'),
      supabase
        .from('agent_compliance')
        .select('user_id, shooting_test_expiry, psych_test_expiry, doping_test_expiry')
        .eq('tenant_id', tenant.id),
      supabase
        .from('firearm_locations')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .order('name'),
    ]);

    const locsMap = new Map((locsRes.data ?? []).map((l) => [l.id, l.name]));
    setLocations((locsRes.data ?? []).map((l) => ({ id: l.id, name: l.name })));

    const userIds = (complianceRes.data ?? []).map((c) => c.user_id);
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    setFirearms(
      (firearmsRes.data ?? []).map((f) => ({
        id: f.id,
        serialNumber: f.serial_number,
        type: f.type,
        brand: f.brand,
        model: f.model,
        status: f.status,
        permitNumber: f.permit_number,
        permitExpiry: f.permit_expiry_date,
        permitAlert: alertLevel(f.permit_expiry_date),
        daysToExpiry: daysUntil(f.permit_expiry_date),
        locationId: f.location_id,
        locationName: f.location_id ? (locsMap.get(f.location_id) ?? null) : null,
        permitDocUrl: f.permit_document_url,
      })),
    );

    setCompliance(
      (complianceRes.data ?? []).map((c) => ({
        agentName: profileMap.get(c.user_id) ?? 'Agente',
        userId: c.user_id,
        shooting: { expiry: c.shooting_test_expiry, level: alertLevel(c.shooting_test_expiry) },
        psych: { expiry: c.psych_test_expiry, level: alertLevel(c.psych_test_expiry) },
        doping: { expiry: c.doping_test_expiry, level: alertLevel(c.doping_test_expiry) },
      })),
    );

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Load detail (assignments) when selecting a firearm
  // -------------------------------------------------------------------

  const selectFirearm = useCallback(async (firearm: FirearmRow) => {
    setSelected(firearm);
    setDetailLoading(true);

    const supabase = getSupabaseBrowserClient();

    const { data } = await supabase
      .from('firearms_assignments')
      .select('id, assigned_at, returned_at, notes, work_station_id, user_id, work_stations(name)')
      .eq('firearm_id', firearm.id)
      .order('assigned_at', { ascending: false })
      .limit(20);

    const agentIds = (data ?? []).map((a) => a.user_id).filter((id): id is string => id !== null);
    const { data: agentProfiles } = agentIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', agentIds)
      : { data: [] };
    const agentMap = new Map((agentProfiles ?? []).map((p) => [p.id, p.full_name]));

    setAssignments(
      (data ?? []).map((a) => ({
        id: a.id,
        stationName: a.work_stations?.name ?? null,
        agentName: a.user_id ? (agentMap.get(a.user_id) ?? 'Agente') : null,
        assignedAt: a.assigned_at,
        returnedAt: a.returned_at,
        notes: a.notes,
        signatureData: null,
        returnLocationName: null,
      })),
    );

    setDetailLoading(false);
  }, []);

  // -------------------------------------------------------------------
  // Open assign modal
  // -------------------------------------------------------------------

  const openAssignModal = useCallback(async () => {
    if (!tenantId) return;
    const supabase = getSupabaseBrowserClient();

    const [stationsRes, membershipsRes] = await Promise.all([
      supabase
        .from('work_stations')
        .select('id, name, properties_ph(name)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('memberships')
        .select('user_id')
        .eq('tenant_id', tenantId),
    ]);

    setStations(
      (stationsRes.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        propertyName: s.properties_ph?.name ?? '',
      })),
    );

    const memberIds = (membershipsRes.data ?? []).map((m) => m.user_id);
    const { data: memberProfiles } = memberIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', memberIds)
      : { data: [] };
    const memberMap = new Map((memberProfiles ?? []).map((p) => [p.id, p.full_name]));

    setAgents(
      (membershipsRes.data ?? []).map((m) => ({
        id: m.user_id,
        name: memberMap.get(m.user_id) ?? 'Agente',
      })),
    );

    setAssignTarget('station');
    setAssignTargetId('');
    setAssignNotes('');
    setShowModal(true);
  }, [tenantId]);

  // -------------------------------------------------------------------
  // Submit assignment
  // -------------------------------------------------------------------

  const submitAssignment = useCallback(async () => {
    if (!selected || !tenantId || !assignTargetId) return;
    setAssignLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.from('firearms_assignments').insert({
        tenant_id: tenantId,
        firearm_id: selected.id,
        work_station_id: assignTarget === 'station' ? assignTargetId : null,
        user_id: assignTarget === 'agent' ? assignTargetId : null,
        notes: assignNotes || null,
      });

      if (error) throw error;

      setToast({ type: 'success', msg: 'Arma asignada correctamente' });
      setShowModal(false);
      setHasSigned(false);
      setSignKey((k) => k + 1);
      selectFirearm(selected);
    } catch {
      setToast({ type: 'error', msg: 'Error al asignar el arma' });
    } finally {
      setAssignLoading(false);
    }
  }, [selected, tenantId, assignTarget, assignTargetId, assignNotes, selectFirearm]);

  // -------------------------------------------------------------------
  // Return firearm
  // -------------------------------------------------------------------

  const handleReturn = useCallback(async () => {
    if (!showReturnModal || !returnLocId) return;
    setReturnLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from('firearms_assignments')
        .update({ returned_at: new Date().toISOString(), return_location_id: returnLocId })
        .eq('id', showReturnModal);

      // Update firearm location to the return location
      if (selected) {
        await supabase.from('firearms_inventory').update({ location_id: returnLocId }).eq('id', selected.id);
      }

      setToast({ type: 'success', msg: 'Arma devuelta correctamente' });
      setShowReturnModal(null);
      if (selected) selectFirearm(selected);
      loadData();
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar devolución' });
    } finally {
      setReturnLoading(false);
    }
  }, [showReturnModal, returnLocId, selected, selectFirearm, loadData]);

  // -------------------------------------------------------------------
  // Create firearm
  // -------------------------------------------------------------------

  const resetCreateForm = useCallback(() => {
    setNewType('pistola');
    setNewBrand('');
    setNewModel('');
    setNewSerial('');
    setNewPermit('');
    setNewPermitExpiry('');
    setNewStatus('operativa');
  }, []);

  const handleCreateFirearm = useCallback(async () => {
    if (!tenantId || !newBrand.trim() || !newModel.trim() || !newSerial.trim() || !newPermit.trim() || !newPermitExpiry) return;
    setCreateLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('firearms_inventory')
        .insert({
          tenant_id: tenantId,
          type: newType,
          brand: newBrand.trim(),
          model: newModel.trim(),
          serial_number: newSerial.trim(),
          permit_number: newPermit.trim(),
          permit_expiry_date: newPermitExpiry,
          status: newStatus,
          location_id: newLocationId || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          setToast({ type: 'error', msg: 'Ya existe un arma con ese numero de serie' });
        } else {
          setToast({ type: 'error', msg: 'Error al registrar el arma' });
        }
        setCreateLoading(false);
        return;
      }

      if (data) {
        const newFirearm: FirearmRow = {
          id: data.id,
          serialNumber: data.serial_number,
          type: data.type,
          brand: data.brand,
          model: data.model,
          status: data.status,
          permitNumber: data.permit_number,
          permitExpiry: data.permit_expiry_date,
          permitAlert: alertLevel(data.permit_expiry_date),
          daysToExpiry: daysUntil(data.permit_expiry_date),
          locationId: data.location_id,
          locationName: data.location_id ? (locations.find((l) => l.id === data.location_id)?.name ?? null) : null,
          permitDocUrl: data.permit_document_url,
        };
        setFirearms((prev) => [...prev, newFirearm]);
        setSelected(newFirearm);
      }

      setToast({ type: 'success', msg: 'Arma registrada exitosamente' });
      setShowCreateModal(false);
      resetCreateForm();
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar el arma' });
    } finally {
      setCreateLoading(false);
    }
  }, [tenantId, newType, newBrand, newModel, newSerial, newPermit, newPermitExpiry, newStatus, resetCreateForm]);

  // -------------------------------------------------------------------
  // KPIs
  // -------------------------------------------------------------------

  const permitsExpired = firearms.filter((f) => f.permitAlert === 'red').length;
  const permitsSoon = firearms.filter((f) => f.permitAlert === 'yellow').length;
  const nonCompliantAgents = compliance.filter(
    (c) => c.shooting.level === 'red' || c.psych.level === 'red' || c.doping.level === 'red',
  ).length;
  const activeAssignments = assignments.filter((a) => a.returnedAt === null).length;
  const inArmory = firearms.length - activeAssignments;

  // -------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
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

      {/* ============================================================ */}
      {/* HEADER                                                        */}
      {/* ============================================================ */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <ShieldIcon />
          <h1 className="text-lg font-semibold tracking-wide">Control de Armamento</h1>
          <span className="text-sm text-zinc-500">{firearms.length} arma{firearms.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lime-500 cursor-pointer"
        >
          <PlusIcon />
          Agregar Arma
        </button>
      </header>

      {/* ============================================================ */}
      {/* ALERT SEMAPHORE                                               */}
      {/* ============================================================ */}
      <div className="grid grid-cols-3 gap-4 border-b border-zinc-800/60 px-6 py-4">
        {/* Permits */}
        <div className={`rounded-xl border px-5 py-4 ${
          permitsExpired > 0 ? alertBg.red : permitsSoon > 0 ? alertBg.yellow : alertBg.green
        }`}>
          <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">Permisos</p>
          <div className="mt-1 flex items-baseline gap-3">
            {permitsExpired > 0 && (
              <span className="text-3xl font-bold tabular-nums text-red-400">{permitsExpired}</span>
            )}
            {permitsSoon > 0 && (
              <span className={`${permitsExpired > 0 ? 'text-lg' : 'text-3xl font-bold'} tabular-nums text-amber-400`}>{permitsSoon}</span>
            )}
            {permitsExpired === 0 && permitsSoon === 0 && (
              <span className="text-3xl font-bold tabular-nums text-lime-400">0</span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {permitsExpired > 0 ? `${permitsExpired} vencido${permitsExpired > 1 ? 's' : ''}` : ''}
            {permitsExpired > 0 && permitsSoon > 0 ? ' · ' : ''}
            {permitsSoon > 0 ? `${permitsSoon} por vencer` : ''}
            {permitsExpired === 0 && permitsSoon === 0 ? 'Todos vigentes' : ''}
          </p>
        </div>

        {/* Inventory in armory */}
        <div className="rounded-xl border bg-zinc-800/40 border-zinc-700/30 px-5 py-4">
          <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">En Armería</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-lime-400">{inArmory}</p>
          <p className="mt-1 text-xs text-zinc-500">de {firearms.length} totales</p>
        </div>

        {/* Assigned */}
        <div className="rounded-xl border bg-zinc-800/40 border-zinc-700/30 px-5 py-4">
          <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">Armas en Puesto</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-200">
            {selected ? activeAssignments : '—'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {selected ? 'asignación activa' : 'seleccione un arma'}
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MASTER-DETAIL                                                 */}
      {/* ============================================================ */}
      <div className="flex flex-1 overflow-hidden">

        {/* MASTER LIST (40%) */}
        <div className="w-[40%] shrink-0 overflow-y-auto border-r border-zinc-800/60">
          {firearms.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60">
                <ShieldIcon size="lg" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">No hay armas registradas en el bunker</p>
                <p className="mt-1 text-xs text-zinc-600">Registre el inventario de armamento de su empresa</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lime-500 cursor-pointer"
              >
                <PlusIcon />
                Agregar Primera Arma
              </button>
            </div>
          ) : (
            <ul>
              {firearms.map((f) => {
                const isSelected = selected?.id === f.id;
                const badge = statusBadge[f.status] ?? statusBadge['operativa']!;

                return (
                  <li key={f.id}>
                    <button
                      onClick={() => selectFirearm(f)}
                      className={`flex w-full items-center gap-4 border-b border-zinc-800/40 px-5 py-4 text-left transition-colors cursor-pointer min-h-[56px] ${
                        isSelected
                          ? 'bg-zinc-800/60'
                          : 'hover:bg-zinc-800/30'
                      }`}
                    >
                      {/* Icon */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                        <FirearmIcon type={f.type} />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-zinc-100 truncate">
                            {f.brand} {f.model}
                          </span>
                          {f.permitAlert !== 'green' && (
                            <div className={`h-2 w-2 shrink-0 rounded-full ${alertDot[f.permitAlert]} ${f.permitAlert === 'red' ? 'animate-pulse' : ''}`} />
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                          <span>{typeLabels[f.type]}</span>
                          <span className="text-zinc-700">|</span>
                          <span className="font-mono">{f.serialNumber}</span>
                        </div>
                      </div>

                      {/* Badge */}
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${badge?.cls ?? ''}`}>
                        {badge?.label ?? f.status}
                      </span>
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
              <ShieldIcon size="lg" />
              <p className="text-base">Seleccione un arma del inventario</p>
            </div>
          ) : detailLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">
                    {selected.brand} {selected.model}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {typeLabels[selected.type]} &middot; Serie: <span className="font-mono text-zinc-300">{selected.serialNumber}</span>
                  </p>
                </div>
                <button
                  onClick={openAssignModal}
                  className="flex min-h-[48px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-lime-500 cursor-pointer"
                >
                  <AssignIcon />
                  Asignar a Puesto / Agente
                </button>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <DetailCard label="Estado" value={statusBadge[selected.status]?.label ?? selected.status} />
                <DetailCard label="Permiso DIASP" value={selected.permitNumber} />
                <DetailCard
                  label="Vence"
                  value={formatDate(selected.permitExpiry)}
                  alert={selected.permitAlert}
                  sub={selected.daysToExpiry <= 0 ? 'VENCIDO' : `${selected.daysToExpiry} días`}
                />
                <DetailCard label="Tipo" value={typeLabels[selected.type] ?? selected.type} />
                <DetailCard label="Ubicación" value={selected.locationName ?? 'Sin asignar'} />
                <DetailCard label="Marca / Modelo" value={`${selected.brand} ${selected.model}`} />
              </div>

              {/* Permit document */}
              {selected.permitDocUrl && (
                <a href={selected.permitDocUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  Ver Permiso DIASP
                </a>
              )}

              {/* Assignments history */}
              <div>
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
                  Historial de custodia
                </h3>
                {assignments.length === 0 ? (
                  <p className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-5 py-8 text-center text-sm text-zinc-600">
                    Sin asignaciones registradas
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {assignments.map((a) => (
                      <li
                        key={a.id}
                        className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 ${
                          a.returnedAt === null
                            ? 'border-lime-500/20 bg-lime-500/5'
                            : 'border-zinc-800/40 bg-zinc-800/20'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-200">
                            {a.stationName ? `Puesto: ${a.stationName}` : ''}
                            {a.agentName ? `Agente: ${a.agentName}` : ''}
                            {!a.stationName && !a.agentName ? 'Asignación' : ''}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Entregada: {formatDateTime(a.assignedAt)}
                            {a.returnedAt ? ` · Devuelta: ${formatDateTime(a.returnedAt)}` : ''}
                          </p>
                          {a.notes && (
                            <p className="mt-1 text-xs text-zinc-500 italic truncate">{a.notes}</p>
                          )}
                        </div>

                        {a.returnedAt === null ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <a href={`/api/firearms/delivery-pdf?id=${a.id}`} target="_blank" rel="noopener noreferrer"
                              className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                              Acta PDF
                            </a>
                            <button
                              onClick={() => { setShowReturnModal(a.id); setReturnLocId(locations[0]?.id ?? ''); }}
                              className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-zinc-600 cursor-pointer"
                            >
                              <ReturnIcon />
                              Devolver
                            </button>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-xs text-zinc-600">Devuelta</span>
                            {a.returnLocationName && <p className="text-[10px] text-zinc-600">{a.returnLocationName}</p>}
                            <a href={`/api/firearms/delivery-pdf?id=${a.id}`} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-lime-400 hover:text-lime-300 cursor-pointer">PDF</a>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* ASSIGN MODAL                                                  */}
      {/* ============================================================ */}
      {showModal && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-zinc-100">
              Asignar: {selected.brand} {selected.model}
            </h3>
            <p className="mt-1 text-xs text-zinc-500 font-mono">{selected.serialNumber}</p>

            {/* Target type toggle */}
            <div className="mt-5 flex gap-2">
              {(['station', 'agent'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setAssignTarget(t); setAssignTargetId(''); }}
                  className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors cursor-pointer min-h-[48px] ${
                    assignTarget === t
                      ? 'bg-lime-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {t === 'station' ? 'A puesto' : 'A agente'}
                </button>
              ))}
            </div>

            {/* Select */}
            <label className="mt-4 block">
              <span className="text-xs font-medium text-zinc-400">
                {assignTarget === 'station' ? 'Puesto de trabajo' : 'Agente'}
              </span>
              <select
                value={assignTargetId}
                onChange={(e) => setAssignTargetId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer"
              >
                <option value="">Seleccionar...</option>
                {assignTarget === 'station'
                  ? stations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {s.propertyName}</option>
                    ))
                  : agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
              </select>
            </label>

            {/* Notes */}
            <label className="mt-4 block">
              <span className="text-xs font-medium text-zinc-400">Notas (opcional)</span>
              <textarea
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                className="mt-1 block w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none"
                placeholder="Observaciones..."
              />
            </label>

            {/* Signature */}
            <div className="mt-4">
              <span className="text-xs font-medium text-zinc-400">Firma Digital del Receptor</span>
              <SignaturePad key={signKey} onSign={() => setHasSigned(true)} onClear={() => setHasSigned(false)} />
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowModal(false); setHasSigned(false); setSignKey((k) => k + 1); }}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 cursor-pointer min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                onClick={submitAssignment}
                disabled={!assignTargetId || !hasSigned || assignLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]"
              >
                {assignLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  'Confirmar asignación'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CREATE FIREARM MODAL                                          */}
      {/* ============================================================ */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); resetCreateForm(); } }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Registrar Arma de Fuego</h3>
            <p className="mt-1 text-xs text-zinc-500">Todos los campos son obligatorios</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {/* Type */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Tipo de Arma</span>
                <select value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                  <option value="pistola">Pistola</option>
                  <option value="revolver">Revolver</option>
                  <option value="escopeta">Escopeta</option>
                </select>
              </label>

              {/* Status */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Estado Actual</span>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                  <option value="operativa">Operativa</option>
                  <option value="mantenimiento">En Mantenimiento</option>
                  <option value="retirada">Retirada</option>
                </select>
              </label>

              {/* Brand */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Marca</span>
                <input type="text" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Ej: Glock, Taurus" maxLength={100}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>

              {/* Model */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Modelo</span>
                <input type="text" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Ej: G17 Gen5" maxLength={100}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>

              {/* Serial Number */}
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-400">Numero de Serie</span>
                <input type="text" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} placeholder="Numero unico del arma" maxLength={100}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 font-mono min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>

              {/* Permit Number */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Permiso DIASP</span>
                <input type="text" value={newPermit} onChange={(e) => setNewPermit(e.target.value)} placeholder="Numero de permiso" maxLength={100}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>

              {/* Permit Expiry */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Vencimiento del Permiso</span>
                <input type="date" value={newPermitExpiry} onChange={(e) => setNewPermitExpiry(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>

              {/* Location */}
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-400">Ubicación (Armería)</span>
                <div className="flex gap-2 mt-1">
                  <select value={newLocationId} onChange={(e) => setNewLocationId(e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                    <option value="">Sin ubicación</option>
                    {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                  </select>
                  <button type="button" onClick={() => setShowLocForm(true)}
                    className="rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-xs font-medium text-lime-400 hover:border-lime-500/30 cursor-pointer">+ Nueva</button>
                </div>
              </label>
            </div>

            {/* Inline location creation */}
            {showLocForm && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 p-3">
                <input type="text" value={newLocName} onChange={(e) => setNewLocName(e.target.value)}
                  placeholder="Nombre de la armería (ej: Armería Central)"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-lime-500 focus:outline-none" />
                <button onClick={() => setShowLocForm(false)} className="px-3 py-2 text-xs text-zinc-500 cursor-pointer">Cancelar</button>
                <button
                  onClick={async () => {
                    if (!tenantId || !newLocName.trim()) return;
                    setLocLoading(true);
                    const supabase = getSupabaseBrowserClient();
                    const { data } = await supabase.from('firearm_locations').insert({ tenant_id: tenantId, name: newLocName.trim() }).select().maybeSingle();
                    if (data) {
                      setLocations((prev) => [...prev, { id: data.id, name: data.name }]);
                      setNewLocationId(data.id);
                    }
                    setShowLocForm(false); setNewLocName(''); setLocLoading(false);
                  }}
                  disabled={locLoading || !newLocName.trim()}
                  className="rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                  {locLoading ? '...' : 'Crear'}
                </button>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 cursor-pointer min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFirearm}
                disabled={!newBrand.trim() || !newModel.trim() || !newSerial.trim() || !newPermit.trim() || !newPermitExpiry || createLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]"
              >
                {createLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  'Registrar Arma'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowReturnModal(null); }}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl space-y-5">
            <h3 className="text-lg font-semibold text-zinc-100">Devolver Arma</h3>
            <p className="text-xs text-zinc-500">Seleccione la ubicación a donde se devuelve el arma</p>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Ubicación de destino</span>
              <select value={returnLocId} onChange={(e) => setReturnLocId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </label>
            <div className="flex gap-3">
              <button onClick={() => setShowReturnModal(null)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleReturn} disabled={returnLoading || !returnLocId}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {returnLoading ? '...' : 'Confirmar Devolución'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-[slideUp_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-lime-600 text-white' : 'bg-red-600 text-white'
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

function DetailCard({
  label,
  value,
  alert,
  sub,
}: {
  label: string;
  value: string;
  alert?: AlertLevel;
  sub?: string;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${alert ? alertBg[alert] : 'bg-zinc-800/40 border-zinc-700/30'}`}>
      <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 text-base font-semibold text-zinc-100">{value}</p>
      {sub && (
        <p className={`mt-0.5 text-xs ${
          alert === 'red' ? 'text-red-400 font-semibold' : alert === 'yellow' ? 'text-amber-400' : 'text-zinc-500'
        }`}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ShieldIcon({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-12 w-12 text-zinc-700' : 'h-5 w-5 text-zinc-400';
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function FirearmIcon({ type }: { type: string }) {
  if (type === 'escopeta') {
    return (
      <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 0L12 4.5m-8.25 7.5L12 19.5" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
    </svg>
  );
}

function AssignIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
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

function ReturnIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  );
}

function SignaturePad({ onSign, onClear }: { onSign: () => void; onClear: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const hasStrokesRef = useRef(false);

  const getPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
    ctx.strokeStyle = '#84CC16';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (!hasStrokesRef.current) { hasStrokesRef.current = true; onSign(); }
  };

  const handlePointerUp = () => { isDrawingRef.current = false; };

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
        <canvas ref={canvasRef} width={460} height={120} className="w-full touch-none cursor-crosshair" style={{ height: 120 }}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
        {!hasStrokesRef.current && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-600">Firme aquí</p>
        )}
      </div>
      <button onClick={clearCanvas} type="button" className="mt-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">Limpiar firma</button>
    </div>
  );
}
