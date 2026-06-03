'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const FleetMap = lazy(() => import('./map'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'tracking' | 'maintenance' | 'inspections';

interface InspectionRow {
  id: string;
  vehiclePlate: string;
  vehicleModel: string;
  inspectionDate: string;
  mileage: number;
  chassisPaint: string;
  rimsTires: string;
  imageUrls: string[];
  notes: string;
  createdAt: string;
}

interface VehicleRow {
  id: string;
  plateNumber: string;
  vehicleType: string;
  brandModel: string;
  gpsDeviceId: string | null;
  currentOdometer: number;
  nextMaintenance: number;
  status: string;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeed: number | null;
  lastSeen: string | null;
}

interface Toast {
  type: 'success' | 'error';
  msg: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusBadge: Record<string, { label: string; cls: string }> = {
  activo: { label: 'Activo', cls: 'bg-lime-500/15 text-lime-400' },
  taller: { label: 'En Taller', cls: 'bg-amber-500/15 text-amber-400' },
  siniestrado: { label: 'Siniestrado', cls: 'bg-red-500/15 text-red-400' },
};

const typeLabels: Record<string, string> = {
  auto: 'Auto', moto: 'Moto', scooter: 'Scooter', bicicleta: 'Bicicleta',
};

function formatKm(v: number): string {
  return v.toLocaleString('es-PA') + ' km';
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlotaPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tracking');
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Create vehicle
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [vPlate, setVPlate] = useState('');
  const [vType, setVType] = useState('auto');
  const [vBrand, setVBrand] = useState('');
  const [vGps, setVGps] = useState('');
  const [vOdometer, setVOdometer] = useState('');
  const [vNextMaint, setVNextMaint] = useState('5000');
  const [createLoading, setCreateLoading] = useState(false);

  // Maintenance
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintVehicle, setMaintVehicle] = useState('');
  const [maintType, setMaintType] = useState('');
  const [maintKm, setMaintKm] = useState('');
  const [maintCost, setMaintCost] = useState('');
  const [maintDate, setMaintDate] = useState('');
  const [maintLoading, setMaintLoading] = useState(false);

  // Inspections
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [showInspForm, setShowInspForm] = useState(false);
  const [inspVehicle, setInspVehicle] = useState('');
  const [inspDate, setInspDate] = useState('');
  const [inspMileage, setInspMileage] = useState('');
  const [inspChassis, setInspChassis] = useState('');
  const [inspRims, setInspRims] = useState('');
  const [inspNotes, setInspNotes] = useState('');
  const [inspFiles, setInspFiles] = useState<File[]>([]);
  const [inspLoading, setInspLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // -------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!tenant) return;
    setTenantId(tenant.id);

    const { data: vehiclesData } = await supabase
      .from('fleet_vehicles')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('plate_number');

    const rows: VehicleRow[] = [];

    for (const v of vehiclesData ?? []) {
      let lastLat: number | null = null;
      let lastLng: number | null = null;
      let lastSpeed: number | null = null;
      let lastSeen: string | null = null;

      const { data: gps } = await supabase
        .from('vehicle_gps_logs')
        .select('latitude, longitude, speed_kmh, recorded_at')
        .eq('vehicle_id', v.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gps) {
        lastLat = Number(gps.latitude);
        lastLng = Number(gps.longitude);
        lastSpeed = Number(gps.speed_kmh);
        lastSeen = gps.recorded_at;
      }

      rows.push({
        id: v.id,
        plateNumber: v.plate_number,
        vehicleType: v.vehicle_type,
        brandModel: v.brand_model,
        gpsDeviceId: v.gps_device_id,
        currentOdometer: v.current_odometer,
        nextMaintenance: v.next_maintenance_odometer,
        status: v.status,
        lastLat, lastLng, lastSpeed, lastSeen,
      });
    }

    setVehicles(rows);
    setIsLoading(false);
    // Load inspections
    const { data: inspData } = await supabase
      .from('fleet_inspections')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('inspection_date', { ascending: false })
      .limit(50);

    const vehMap = new Map(rows.map((r) => [r.id, { plate: r.plateNumber, model: r.brandModel }]));
    setInspections((inspData ?? []).map((i) => ({
      id: i.id,
      vehiclePlate: vehMap.get(i.vehicle_id)?.plate ?? '',
      vehicleModel: vehMap.get(i.vehicle_id)?.model ?? '',
      inspectionDate: i.inspection_date,
      mileage: i.mileage,
      chassisPaint: i.chassis_paint,
      rimsTires: i.rims_tires,
      imageUrls: i.image_urls ?? [],
      notes: i.notes,
      createdAt: i.created_at,
    })));

  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Create vehicle
  // -------------------------------------------------------------------

  const handleCreateVehicle = useCallback(async () => {
    if (!tenantId || !vPlate.trim() || !vBrand.trim()) return;
    setCreateLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('fleet_vehicles')
        .insert({
          tenant_id: tenantId,
          plate_number: vPlate.trim().toUpperCase(),
          vehicle_type: vType as 'auto' | 'moto' | 'scooter' | 'bicicleta',
          brand_model: vBrand.trim(),
          gps_device_id: vGps.trim() || null,
          current_odometer: parseInt(vOdometer) || 0,
          next_maintenance_odometer: parseInt(vNextMaint) || 5000,
        })
        .select()
        .single();

      if (error) {
        setToast({ type: 'error', msg: error.code === '23505' ? 'Placa o GPS ya registrado' : 'Error al registrar vehiculo' });
        setCreateLoading(false);
        return;
      }

      if (data) {
        setVehicles((prev) => [...prev, {
          id: data.id, plateNumber: data.plate_number, vehicleType: data.vehicle_type,
          brandModel: data.brand_model, gpsDeviceId: data.gps_device_id,
          currentOdometer: data.current_odometer, nextMaintenance: data.next_maintenance_odometer,
          status: data.status, lastLat: null, lastLng: null, lastSpeed: null, lastSeen: null,
        }]);
      }

      setToast({ type: 'success', msg: 'Vehiculo registrado' });
      setShowCreateModal(false);
      setVPlate(''); setVBrand(''); setVGps(''); setVOdometer(''); setVNextMaint('5000');
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar vehiculo' });
    } finally {
      setCreateLoading(false);
    }
  }, [tenantId, vPlate, vType, vBrand, vGps, vOdometer, vNextMaint]);

  // -------------------------------------------------------------------
  // Compress image
  // -------------------------------------------------------------------

  const compressImage = useCallback((file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1200;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = (height / width) * maxSize; width = maxSize; }
          else { width = (width / height) * maxSize; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.7);
      };
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // -------------------------------------------------------------------
  // Submit inspection
  // -------------------------------------------------------------------

  const handleInspection = useCallback(async () => {
    if (!tenantId || !inspVehicle || !inspDate) return;
    setInspLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upload compressed images
      const uploadedUrls: string[] = [];
      for (const file of inspFiles) {
        const compressed = await compressImage(file);
        const path = `${tenantId}/fleet-inspections/${inspVehicle}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('hr-documents').upload(path, compressed, { contentType: 'image/jpeg' });
        if (!upErr) uploadedUrls.push(path);
      }

      const { error } = await supabase.from('fleet_inspections').insert({
        tenant_id: tenantId,
        vehicle_id: inspVehicle,
        inspection_date: inspDate,
        mileage: parseInt(inspMileage) || 0,
        chassis_paint: inspChassis.trim(),
        rims_tires: inspRims.trim(),
        image_urls: uploadedUrls,
        notes: inspNotes.trim(),
        created_by: user.id,
      });

      if (error) throw error;

      setToast({ type: 'success', msg: 'Inspección registrada' });
      setShowInspForm(false);
      setInspVehicle(''); setInspDate(''); setInspMileage(''); setInspChassis(''); setInspRims(''); setInspNotes(''); setInspFiles([]);
      loadData();
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar inspección' });
    } finally {
      setInspLoading(false);
    }
  }, [tenantId, inspVehicle, inspDate, inspMileage, inspChassis, inspRims, inspNotes, inspFiles, compressImage, loadData]);

  // -------------------------------------------------------------------
  // Register maintenance (updates odometer + next threshold)
  // -------------------------------------------------------------------

  const handleMaintenance = useCallback(async () => {
    if (!maintVehicle || !maintType.trim() || !maintDate) return;
    setMaintLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const vehicle = vehicles.find((v) => v.id === maintVehicle);
      const kmVal = parseInt(maintKm) || 0;
      const newNextMaint = kmVal + 5000;

      await supabase
        .from('fleet_vehicles')
        .update({
          current_odometer: kmVal,
          next_maintenance_odometer: newNextMaint,
          status: 'activo',
        })
        .eq('id', maintVehicle);

      setVehicles((prev) => prev.map((v) =>
        v.id === maintVehicle
          ? { ...v, currentOdometer: kmVal, nextMaintenance: newNextMaint, status: 'activo' }
          : v,
      ));

      setToast({ type: 'success', msg: `Mantenimiento registrado para ${vehicle?.plateNumber ?? 'vehiculo'}` });
      setShowMaintModal(false);
      setMaintVehicle(''); setMaintType(''); setMaintKm(''); setMaintCost(''); setMaintDate('');
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar mantenimiento' });
    } finally {
      setMaintLoading(false);
    }
  }, [maintVehicle, maintType, maintKm, maintCost, maintDate, vehicles]);

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------

  const activeCount = vehicles.filter((v) => v.status === 'activo').length;
  const maintenanceDue = vehicles.filter((v) => v.currentOdometer >= v.nextMaintenance - 500).length;

  // -------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
          <p className="text-sm tracking-widest text-zinc-500 uppercase">Cargando flota...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <TruckHeaderIcon />
          <h1 className="text-lg font-semibold tracking-wide">Flota y Vehiculos</h1>
          <span className="text-sm text-zinc-500">{vehicles.length} unidades</span>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer">
          <PlusIcon /> Registrar Vehiculo
        </button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 border-b border-zinc-800/60 px-6 py-4">
        <div className="rounded-xl border border-lime-500/20 bg-lime-500/8 px-5 py-4">
          <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Activos</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-lime-400">{activeCount}</p>
          <p className="mt-1 text-xs text-zinc-500">de {vehicles.length} vehiculos</p>
        </div>
        <div className={`rounded-xl border px-5 py-4 ${maintenanceDue > 0 ? 'border-amber-500/20 bg-amber-500/8' : 'border-zinc-700/30 bg-zinc-800/40'}`}>
          <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Mantenimiento Pendiente</p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${maintenanceDue > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{maintenanceDue}</p>
          <p className="mt-1 text-xs text-zinc-500">{maintenanceDue > 0 ? 'requieren servicio' : 'todo al dia'}</p>
        </div>
        <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/40 px-5 py-4">
          <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Con GPS</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-200">{vehicles.filter((v) => v.gpsDeviceId).length}</p>
          <p className="mt-1 text-xs text-zinc-500">dispositivos vinculados</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-zinc-800/60 px-6 pt-2">
        {([
          { key: 'tracking' as Tab, label: 'Rastreo y Telemetria' },
          { key: 'maintenance' as Tab, label: 'Mantenimiento Preventivo' },
          { key: 'inspections' as Tab, label: `Inspección de Flota (${inspections.length})` },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-t-lg px-5 py-3 text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
              tab === t.key ? 'bg-zinc-800/60 text-zinc-100 border-b-2 border-lime-500' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ============================================================ */}
        {/* TAB: Tracking                                                 */}
        {/* ============================================================ */}
        {tab === 'tracking' && (
          vehicles.length === 0 ? (
            <EmptyState icon={<TruckLgIcon />} title="Sin vehiculos registrados" subtitle="Registre la flota vehicular de su empresa para activar el rastreo GPS" action="Registrar Primer Vehiculo" onAction={() => setShowCreateModal(true)} />
          ) : (
            <div className="flex gap-4 h-full">
              {/* Table */}
              <div className="w-[45%] shrink-0 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#0A0E1A] z-10">
                    <tr className="border-b border-zinc-800 text-left">
                      <th className="px-3 py-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">Placa</th>
                      <th className="px-3 py-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">Vehiculo</th>
                      <th className="px-3 py-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase text-right">Vel.</th>
                      <th className="px-3 py-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase text-right">Odometro</th>
                      <th className="px-3 py-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => {
                      const badge = statusBadge[v.status] ?? statusBadge['activo']!;
                      const isMoving = v.lastSpeed !== null && v.lastSpeed > 1;
                      const liveStatus = v.status !== 'activo'
                        ? badge
                        : isMoving
                          ? { label: 'En Ruta', cls: 'bg-lime-500/15 text-lime-400' }
                          : { label: 'Detenido', cls: 'bg-amber-500/15 text-amber-400' };

                      return (
                        <tr key={v.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors cursor-pointer"
                          onClick={() => {/* future: center map */}}>
                          <td className="px-3 py-3 font-mono font-semibold text-zinc-100 text-sm">{v.plateNumber}</td>
                          <td className="px-3 py-3">
                            <p className="text-zinc-200 text-sm">{v.brandModel}</p>
                            <p className="text-[10px] text-zinc-500">
                              {typeLabels[v.vehicleType] ?? v.vehicleType}
                              {v.lastSeen ? ` · ${timeAgo(v.lastSeen)}` : ''}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {v.lastSpeed !== null ? (
                              <span className={`tabular-nums text-sm font-medium ${
                                v.lastSpeed > 80 ? 'text-red-400' : v.lastSpeed > 1 ? 'text-lime-400' : 'text-zinc-500'
                              }`}>
                                {v.lastSpeed.toFixed(0)}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="tabular-nums text-sm text-zinc-300">{formatKm(v.currentOdometer)}</p>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${liveStatus.cls}`}>{liveStatus.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Live Map */}
              <div className="flex-1 rounded-2xl border border-zinc-800/40 overflow-hidden">
                <Suspense fallback={
                  <div className="flex h-full items-center justify-center bg-zinc-900">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
                  </div>
                }>
                  <FleetMap
                    vehicles={vehicles
                      .filter((v) => v.lastLat !== null && v.lastLng !== null)
                      .map((v) => ({
                        id: v.id,
                        plateNumber: v.plateNumber,
                        brandModel: v.brandModel,
                        lat: v.lastLat!,
                        lng: v.lastLng!,
                        speed: v.lastSpeed ?? 0,
                        status: v.status,
                      }))}
                  />
                </Suspense>
              </div>
            </div>
          )
        )}

        {/* ============================================================ */}
        {/* TAB: Maintenance                                              */}
        {/* ============================================================ */}
        {tab === 'maintenance' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Bitacora de Mantenimiento</h2>
              <button onClick={() => setShowMaintModal(true)} disabled={vehicles.length === 0}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                <PlusIcon /> Registrar Mantenimiento
              </button>
            </div>

            {vehicles.length === 0 ? (
              <EmptyState icon={<WrenchIcon />} title="Sin vehiculos para mantener" subtitle="Registre vehiculos primero para gestionar su mantenimiento" action="Registrar Vehiculo" onAction={() => setShowCreateModal(true)} />
            ) : (
              <div className="space-y-2">
                {vehicles
                  .sort((a, b) => (a.nextMaintenance - a.currentOdometer) - (b.nextMaintenance - b.currentOdometer))
                  .map((v) => {
                    const remaining = v.nextMaintenance - v.currentOdometer;
                    const urgent = remaining <= 0;
                    const soon = remaining > 0 && remaining <= 500;

                    return (
                      <div key={v.id} className={`flex items-center justify-between rounded-xl border px-5 py-4 ${
                        urgent ? 'border-red-500/30 bg-red-500/5' : soon ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800/40 bg-zinc-800/20'
                      }`}>
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-zinc-100">{v.plateNumber}</span>
                            <span className="text-sm text-zinc-400">{v.brandModel}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                            <span>Actual: {formatKm(v.currentOdometer)}</span>
                            <span>Proximo: {formatKm(v.nextMaintenance)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {urgent ? (
                            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400 animate-pulse">VENCIDO</span>
                          ) : soon ? (
                            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">{remaining} km restantes</span>
                          ) : (
                            <span className="text-xs text-zinc-500">{formatKm(remaining)} restantes</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB: Inspections */}
        {tab === 'inspections' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Inspecciones Registradas</h2>
              <button onClick={() => { setShowInspForm(true); setInspVehicle(''); setInspDate(''); setInspMileage(''); setInspChassis(''); setInspRims(''); setInspNotes(''); setInspFiles([]); }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer">
                <PlusIcon /> Inspección
              </button>
            </div>
            {inspections.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-zinc-600">Sin inspecciones registradas</div>
            ) : (
              <div className="space-y-3">
                {inspections.map((insp) => (
                  <div key={insp.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">{insp.vehiclePlate} — {insp.vehicleModel}</p>
                        <p className="text-xs text-zinc-500">{new Date(insp.inspectionDate).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })} · {insp.mileage.toLocaleString()} km</p>
                      </div>
                    </div>
                    <div className="border-t border-zinc-800/30 px-5 py-3 space-y-2">
                      {insp.chassisPaint && (<div><span className="text-[10px] text-zinc-500 uppercase tracking-wide">Chasis y Pintura:</span><p className="text-xs text-zinc-300">{insp.chassisPaint}</p></div>)}
                      {insp.rimsTires && (<div><span className="text-[10px] text-zinc-500 uppercase tracking-wide">Rines y Llantas:</span><p className="text-xs text-zinc-300">{insp.rimsTires}</p></div>)}
                      {insp.notes && (<div><span className="text-[10px] text-zinc-500 uppercase tracking-wide">Notas:</span><p className="text-xs text-zinc-400 italic">{insp.notes}</p></div>)}
                      {insp.imageUrls.length > 0 && (
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Evidencia ({insp.imageUrls.length}):</span>
                          <div className="mt-1 flex gap-2 flex-wrap">
                            {insp.imageUrls.map((url, i) => (
                              <a key={i} href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/hr-documents/${url}`} target="_blank" rel="noopener noreferrer"
                                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-[10px] text-lime-400 hover:bg-zinc-700 cursor-pointer">Imagen {i + 1}</a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE VEHICLE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Registrar Vehiculo</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Placa</span>
                <input type="text" value={vPlate} onChange={(e) => setVPlate(e.target.value)} placeholder="Ej: ABC-1234" maxLength={20}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 font-mono min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Tipo</span>
                <select value={vType} onChange={(e) => setVType(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                  <option value="auto">Auto</option>
                  <option value="moto">Moto</option>
                  <option value="scooter">Scooter</option>
                  <option value="bicicleta">Bicicleta</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-400">Marca y Modelo</span>
                <input type="text" value={vBrand} onChange={(e) => setVBrand(e.target.value)} placeholder="Ej: Toyota Hilux 2024" maxLength={150}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">GPS Device ID (opcional)</span>
                <input type="text" value={vGps} onChange={(e) => setVGps(e.target.value)} placeholder="ID del tracker"
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 font-mono min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Odometro Actual (km)</span>
                <input type="number" min={0} value={vOdometer} onChange={(e) => setVOdometer(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-400">Proximo Mantenimiento (km)</span>
                <input type="number" min={1} value={vNextMaint} onChange={(e) => setVNextMaint(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleCreateVehicle} disabled={!vPlate.trim() || !vBrand.trim() || createLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {createLoading ? <Spinner /> : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE MODAL */}
      {showMaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMaintModal(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Registrar Mantenimiento</h3>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Vehiculo</span>
                <select value={maintVehicle} onChange={(e) => setMaintVehicle(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                  <option value="">Seleccionar...</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber} — {v.brandModel}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Tipo de Servicio</span>
                <input type="text" value={maintType} onChange={(e) => setMaintType(e.target.value)} placeholder="Ej: Cambio de aceite, Revision de frenos" maxLength={200}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Kilometraje Actual</span>
                  <input type="number" min={0} value={maintKm} onChange={(e) => setMaintKm(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Costo (B/.)</span>
                  <input type="number" min={0} step="0.01" value={maintCost} onChange={(e) => setMaintCost(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Fecha</span>
                <input type="date" value={maintDate} onChange={(e) => setMaintDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowMaintModal(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleMaintenance} disabled={!maintVehicle || !maintType.trim() || !maintDate || maintLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {maintLoading ? <Spinner /> : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* INSPECTION FORM MODAL */}
      {showInspForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowInspForm(false); }}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <h3 className="text-lg font-semibold text-zinc-100">Nueva Inspección de Vehículo</h3>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Vehículo</span>
              <select value={inspVehicle} onChange={(e) => setInspVehicle(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                <option value="">Seleccionar vehículo...</option>
                {vehicles.map((v) => (<option key={v.id} value={v.id}>{v.plateNumber} — {v.brandModel}</option>))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Fecha de Inspección</span>
              <input type="date" value={inspDate} onChange={(e) => setInspDate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Kilometraje</span>
              <input type="number" value={inspMileage} onChange={(e) => setInspMileage(e.target.value)}
                placeholder="Km al momento de la inspección"
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Chasis y Pintura</span>
              <textarea value={inspChassis} onChange={(e) => setInspChassis(e.target.value)}
                placeholder="Estado del chasis, golpes, rayones, pintura..."
                rows={2}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none resize-none" />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Rines y Llantas</span>
              <textarea value={inspRims} onChange={(e) => setInspRims(e.target.value)}
                placeholder="Estado de rines, profundidad de banda, presión..."
                rows={2}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none resize-none" />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Notas Adicionales (opcional)</span>
              <textarea value={inspNotes} onChange={(e) => setInspNotes(e.target.value)}
                placeholder="Observaciones generales..."
                rows={2}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none resize-none" />
            </label>

            <div>
              <span className="text-xs font-medium text-zinc-400">Evidencia Fotográfica</span>
              <input type="file" accept="image/*" multiple
                onChange={(e) => setInspFiles(Array.from(e.target.files ?? []))}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-400 min-h-[48px] file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-xs file:text-zinc-300 file:cursor-pointer cursor-pointer" />
              <p className="mt-1 text-[10px] text-zinc-600">Las imágenes se comprimen automáticamente (máx 1200px, 70% calidad)</p>
              {inspFiles.length > 0 && (
                <p className="mt-1 text-xs text-lime-400">{inspFiles.length} imagen{inspFiles.length !== 1 ? 'es' : ''} seleccionada{inspFiles.length !== 1 ? 's' : ''}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowInspForm(false)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleInspection} disabled={inspLoading || !inspVehicle || !inspDate}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {inspLoading ? 'Guardando...' : 'Registrar Inspección'}
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

function EmptyState({ icon, title, subtitle, action, onAction }: {
  icon: React.ReactNode; title: string; subtitle: string; action: string; onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60">{icon}</div>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="text-xs text-zinc-600">{subtitle}</p>
      <button onClick={onAction}
        className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer">
        <PlusIcon /> {action}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function TruckHeaderIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H18.75M3.375 14.25h.008v.008h-.008v-.008zm0 0V4.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v8.25M18.75 14.25l-3-6h-4.5" />
    </svg>
  );
}

function TruckLgIcon() {
  return (
    <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H18.75M3.375 14.25h.008v.008h-.008v-.008zm0 0V4.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v8.25M18.75 14.25l-3-6h-4.5" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 5.1a2.121 2.121 0 01-3-3l5.1-5.1m0 0L21.17 2.83a2.121 2.121 0 013 3L14.42 15.17m-3 0a3 3 0 104.243-4.243" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="mx-auto h-10 w-10 text-lime-500/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
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
