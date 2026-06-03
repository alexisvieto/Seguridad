'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { FileUpload } from '@/lib/upload/file-upload';
import { QRCodeCanvas } from 'qrcode.react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'clients' | 'contracts';

interface ClientRow {
  id: string;
  companyName: string;
  ruc: string | null;
  legalRep: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
}

interface ContractRow {
  id: string;
  clientId: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  monthlyAmount: number;
  agentsRequired: number;
  contractPdf: string | null;
  status: string;
  notes: string | null;
  properties: { id: string; name: string }[];
}

interface StationWithConsignas {
  id: string;
  name: string;
  propertyId: string;
  qrToken: string;
  consignas: { id: string; title: string; priority: string }[];
}

interface Toast { type: 'success' | 'error'; msg: string; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmt(v: number): string {
  return v.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  activo: { label: 'Activo', cls: 'bg-lime-500/15 text-lime-400' },
  suspendido: { label: 'Suspendido', cls: 'bg-amber-500/15 text-amber-400' },
  inactivo: { label: 'Inactivo', cls: 'bg-zinc-500/15 text-zinc-400' },
  vigente: { label: 'Vigente', cls: 'bg-lime-500/15 text-lime-400' },
  vencido: { label: 'Vencido', cls: 'bg-red-500/15 text-red-400' },
  cancelado: { label: 'Cancelado', cls: 'bg-zinc-500/15 text-zinc-400' },
};

const prioBadge: Record<string, string> = {
  critica: 'bg-red-500/15 text-red-400',
  alta: 'bg-amber-500/15 text-amber-400',
  media: 'bg-blue-500/15 text-blue-400',
  baja: 'bg-zinc-500/15 text-zinc-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ComercialPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Detail
  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null);
  const [stationsDetail, setStationsDetail] = useState<StationWithConsignas[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create client
  const [showClientForm, setShowClientForm] = useState(false);
  const [cName, setCName] = useState('');
  const [cRuc, setCRuc] = useState('');
  const [cRep, setCRep] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [clientLoading, setClientLoading] = useState(false);

  // Create contract
  const [showContractForm, setShowContractForm] = useState(false);
  const [ctClient, setCtClient] = useState('');
  const [ctStart, setCtStart] = useState('');
  const [ctEnd, setCtEnd] = useState('');
  const [ctAmount, setCtAmount] = useState('');
  const [ctAgents, setCtAgents] = useState('');
  const [ctNotes, setCtNotes] = useState('');
  const [contractLoading, setContractLoading] = useState(false);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;
    setTenantId(tenant.id);

    const [clientsRes, contractsRes, propsRes] = await Promise.all([
      supabase.from('commercial_clients').select('*').eq('tenant_id', tenant.id).order('company_name'),
      supabase.from('commercial_contracts').select('*, commercial_clients(company_name)').eq('tenant_id', tenant.id).order('start_date', { ascending: false }),
      supabase.from('contract_properties').select('contract_id, property_id').eq('tenant_id', tenant.id),
    ]);

    const clientNameMap = new Map<string, string>();
    setClients((clientsRes.data ?? []).map((c) => {
      clientNameMap.set(c.id, c.company_name);
      return { id: c.id, companyName: c.company_name, ruc: c.ruc, legalRep: c.legal_rep, contactEmail: c.contact_email, contactPhone: c.contact_phone, status: c.status };
    }));

    const propIds = [...new Set((propsRes.data ?? []).map((p) => p.property_id))];
    const { data: propNames } = propIds.length > 0
      ? await supabase.from('properties_ph').select('id, name').in('id', propIds)
      : { data: [] };
    const propNameMap = new Map((propNames ?? []).map((p) => [p.id, p.name]));

    const propsByContract = new Map<string, { id: string; name: string }[]>();
    for (const p of propsRes.data ?? []) {
      const arr = propsByContract.get(p.contract_id) ?? [];
      arr.push({ id: p.property_id, name: propNameMap.get(p.property_id) ?? '' });
      propsByContract.set(p.contract_id, arr);
    }

    setContracts((contractsRes.data ?? []).map((ct) => ({
      id: ct.id, clientId: ct.client_id,
      clientName: ct.commercial_clients?.company_name ?? clientNameMap.get(ct.client_id) ?? '',
      startDate: ct.start_date, endDate: ct.end_date,
      monthlyAmount: Number(ct.monthly_amount), agentsRequired: ct.agents_required,
      contractPdf: ct.contract_pdf_url, status: ct.status, notes: ct.notes,
      properties: propsByContract.get(ct.id) ?? [],
    })));

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load stations + consignas for a contract
  const selectContract = useCallback(async (ct: ContractRow) => {
    setSelectedContract(ct);
    setDetailLoading(true);

    const supabase = getSupabaseBrowserClient();
    const propertyIds = ct.properties.map((p) => p.id);
    if (propertyIds.length === 0) { setStationsDetail([]); setDetailLoading(false); return; }

    const { data: stations } = await supabase
      .from('work_stations').select('id, name, property_id, qr_code_token').in('property_id', propertyIds).eq('is_active', true);

    const stationIds = (stations ?? []).map((s) => s.id);
    const { data: consignas } = stationIds.length > 0
      ? await supabase.from('station_consignas').select('id, title, priority, work_station_id').in('work_station_id', stationIds).eq('is_active', true)
      : { data: [] };

    const consignasByStation = new Map<string, { id: string; title: string; priority: string }[]>();
    for (const c of consignas ?? []) {
      const arr = consignasByStation.get(c.work_station_id) ?? [];
      arr.push({ id: c.id, title: c.title, priority: c.priority });
      consignasByStation.set(c.work_station_id, arr);
    }

    setStationsDetail((stations ?? []).map((s) => ({
      id: s.id, name: s.name, propertyId: s.property_id, qrToken: s.qr_code_token, consignas: consignasByStation.get(s.id) ?? [],
    })));

    setDetailLoading(false);
  }, []);

  // Link property to contract
  const [showLinkProp, setShowLinkProp] = useState(false);
  const [availableProps, setAvailableProps] = useState<{ id: string; name: string }[]>([]);
  const [selectedProp, setSelectedProp] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  const [showNewProp, setShowNewProp] = useState(false);
  const [npName, setNpName] = useState('');
  const [npAddress, setNpAddress] = useState('');
  const [npLoading, setNpLoading] = useState(false);

  const openLinkProp = useCallback(async () => {
    if (!tenantId) return;
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.from('properties_ph').select('id, name').eq('tenant_id', tenantId).order('name');
    const linked = selectedContract?.properties.map((p) => p.id) ?? [];
    setAvailableProps((data ?? []).filter((p) => !linked.includes(p.id)));
    setSelectedProp('');
    setShowNewProp(false);
    setNpName('');
    setNpAddress('');
    setShowLinkProp(true);
  }, [tenantId, selectedContract]);

  const handleCreateAndLinkProp = useCallback(async () => {
    if (!tenantId || !selectedContract || !npName.trim()) return;
    setNpLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: prop, error: propErr } = await supabase
        .from('properties_ph')
        .insert({ tenant_id: tenantId, name: npName.trim(), address: npAddress.trim() || '' })
        .select()
        .maybeSingle();

      if (propErr || !prop) throw propErr;

      const { error: linkErr } = await supabase.from('contract_properties').insert({
        tenant_id: tenantId, contract_id: selectedContract.id, property_id: prop.id,
      });
      if (linkErr) throw linkErr;

      setToast({ type: 'success', msg: `Propiedad "${npName}" creada y vinculada` });
      setShowLinkProp(false);
      loadData();
      const updated = { ...selectedContract, properties: [...selectedContract.properties, { id: prop.id, name: npName.trim() }] };
      setSelectedContract(updated);
      selectContract(updated);
    } catch { setToast({ type: 'error', msg: 'Error al crear propiedad' }); }
    finally { setNpLoading(false); }
  }, [tenantId, selectedContract, npName, npAddress, loadData, selectContract]);

  const handleLinkProp = useCallback(async () => {
    if (!tenantId || !selectedContract || !selectedProp) return;
    setLinkLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('contract_properties').insert({
        tenant_id: tenantId, contract_id: selectedContract.id, property_id: selectedProp,
      });
      if (error) throw error;
      setToast({ type: 'success', msg: 'Propiedad vinculada al contrato' });
      setShowLinkProp(false);
      loadData();
      const updatedContract = { ...selectedContract, properties: [...selectedContract.properties, { id: selectedProp, name: availableProps.find((p) => p.id === selectedProp)?.name ?? '' }] };
      setSelectedContract(updatedContract);
      selectContract(updatedContract);
    } catch { setToast({ type: 'error', msg: 'Error al vincular propiedad' }); }
    finally { setLinkLoading(false); }
  }, [tenantId, selectedContract, selectedProp, availableProps, loadData, selectContract]);

  // QR modal
  const [qrStation, setQrStation] = useState<StationWithConsignas | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQr = useCallback(() => {
    if (!qrRef.current || !qrStation) return;
    const canvas = qrRef.current.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${qrStation.name.replace(/\s+/g, '-')}.png`;
    a.click();
  }, [qrStation]);

  // Create work station
  const [showStationForm, setShowStationForm] = useState<string | null>(null);
  const [wsName, setWsName] = useState('');
  const [wsLoading, setWsLoading] = useState(false);

  const handleCreateStation = useCallback(async () => {
    if (!tenantId || !showStationForm || !wsName.trim()) return;
    setWsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('work_stations').insert({
        tenant_id: tenantId, property_id: showStationForm, name: wsName.trim(),
      });
      if (error) throw error;
      setToast({ type: 'success', msg: `Puesto "${wsName}" creado` });
      setShowStationForm(null); setWsName('');
      if (selectedContract) selectContract(selectedContract);
    } catch { setToast({ type: 'error', msg: 'Error al crear puesto' }); }
    finally { setWsLoading(false); }
  }, [tenantId, showStationForm, wsName, selectedContract, selectContract]);

  // Add consigna to station
  const [showConsignaForm, setShowConsignaForm] = useState<string | null>(null);
  const [cgTitle, setCgTitle] = useState('');
  const [cgDesc, setCgDesc] = useState('');
  const [cgPriority, setCgPriority] = useState('media');
  const [cgLoading, setCgLoading] = useState(false);

  const handleAddConsigna = useCallback(async () => {
    if (!tenantId || !showConsignaForm || !cgTitle.trim()) return;
    setCgLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('station_consignas').insert({
        tenant_id: tenantId, work_station_id: showConsignaForm, title: cgTitle.trim(),
        description: cgDesc.trim() || null, priority: cgPriority,
      });
      if (error) throw error;
      setToast({ type: 'success', msg: 'Consigna agregada' });
      setShowConsignaForm(null); setCgTitle(''); setCgDesc(''); setCgPriority('media');
      if (selectedContract) selectContract(selectedContract);
    } catch { setToast({ type: 'error', msg: 'Error al agregar consigna' }); }
    finally { setCgLoading(false); }
  }, [tenantId, showConsignaForm, cgTitle, cgDesc, cgPriority, selectedContract, selectContract]);

  // Create client
  const handleCreateClient = useCallback(async () => {
    if (!tenantId || !cName.trim()) return;
    setClientLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('commercial_clients').insert({
        tenant_id: tenantId, company_name: cName.trim(), ruc: cRuc.trim() || null,
        legal_rep: cRep.trim() || null, contact_email: cEmail.trim() || null, contact_phone: cPhone.trim() || null,
      });
      if (error) throw error;
      setToast({ type: 'success', msg: 'Cliente registrado' });
      setShowClientForm(false); setCName(''); setCRuc(''); setCRep(''); setCEmail(''); setCPhone('');
      loadData();
    } catch { setToast({ type: 'error', msg: 'Error al registrar cliente' }); }
    finally { setClientLoading(false); }
  }, [tenantId, cName, cRuc, cRep, cEmail, cPhone, loadData]);

  // Create contract
  const handleCreateContract = useCallback(async () => {
    const amount = parseFloat(ctAmount) || 0;
    const agents = parseInt(ctAgents) || 1;
    if (!tenantId || !ctClient || !ctStart || amount <= 0) return;
    setContractLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('commercial_contracts').insert({
        tenant_id: tenantId, client_id: ctClient, start_date: ctStart,
        end_date: ctEnd || null, monthly_amount: amount, agents_required: agents,
        notes: ctNotes.trim() || null,
      });
      if (error) throw error;
      setToast({ type: 'success', msg: 'Contrato registrado' });
      setShowContractForm(false); setCtClient(''); setCtStart(''); setCtEnd(''); setCtAmount(''); setCtAgents(''); setCtNotes('');
      loadData();
    } catch { setToast({ type: 'error', msg: 'Error al registrar contrato' }); }
    finally { setContractLoading(false); }
  }, [tenantId, ctClient, ctStart, ctEnd, ctAmount, ctAgents, ctNotes, loadData]);

  // KPIs
  const activeClients = clients.filter((c) => c.status === 'activo').length;
  const activeContracts = contracts.filter((c) => c.status === 'vigente').length;
  const monthlyRevenue = contracts.filter((c) => c.status === 'vigente').reduce((s, c) => s + c.monthlyAmount, 0);

  if (isLoading) {
    return <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" /></div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <BriefIcon />
          <h1 className="text-lg font-semibold tracking-wide">Gestion Comercial</h1>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 border-b border-zinc-800/60 px-6 py-4">
        <KpiCard label="Clientes Activos" value={String(activeClients)} />
        <KpiCard label="Contratos Vigentes" value={String(activeContracts)} />
        <KpiCard label="Facturacion Mensual" value={`B/.${fmt(monthlyRevenue)}`} accent="lime" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800/60 px-6 pt-2">
        {([{ key: 'clients' as Tab, label: 'Clientes' }, { key: 'contracts' as Tab, label: 'Contratos' }]).map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedContract(null); }}
            className={`rounded-t-lg px-5 py-3 text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${tab === t.key ? 'bg-zinc-800/60 text-zinc-100 border-b-2 border-lime-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LIST */}
        <div className="w-[40%] shrink-0 overflow-y-auto border-r border-zinc-800/60 p-4">

          {tab === 'clients' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Clientes</p>
                <button onClick={() => setShowClientForm(true)} className="flex min-h-[40px] items-center gap-2 rounded-xl bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-500 cursor-pointer"><PlusIcon /> Nuevo</button>
              </div>
              {clients.length === 0 ? (
                <Empty title="Sin clientes" subtitle="Registre su primer cliente corporativo" action="Registrar Cliente" onAction={() => setShowClientForm(true)} />
              ) : (
                <ul className="space-y-2">
                  {clients.map((c) => {
                    const badge = statusBadge[c.status] ?? statusBadge['activo']!;
                    return (
                      <li key={c.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-zinc-100">{c.companyName}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                          {c.ruc && <span>RUC: {c.ruc}</span>}
                          {c.legalRep && <span>{c.legalRep}</span>}
                        </div>
                        {c.contactEmail && <p className="mt-0.5 text-xs text-zinc-600">{c.contactEmail}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'contracts' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Contratos</p>
                <button onClick={() => setShowContractForm(true)} disabled={clients.length === 0} className="flex min-h-[40px] items-center gap-2 rounded-xl bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer"><PlusIcon /> Nuevo</button>
              </div>
              {contracts.length === 0 ? (
                <Empty title="Sin contratos" subtitle="Registre clientes primero, luego cree contratos" action="Crear Contrato" onAction={() => setShowContractForm(true)} />
              ) : (
                <ul className="space-y-2">
                  {contracts.map((ct) => {
                    const badge = statusBadge[ct.status] ?? statusBadge['vigente']!;
                    const isSelected = selectedContract?.id === ct.id;
                    return (
                      <li key={ct.id}>
                        <button onClick={() => selectContract(ct)}
                          className={`w-full text-left rounded-xl border px-4 py-3 transition-colors cursor-pointer ${isSelected ? 'border-lime-500/30 bg-lime-500/5' : 'border-zinc-800/40 bg-zinc-800/20 hover:bg-zinc-800/30'}`}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-zinc-100">{ct.clientName}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                            <span>B/.{fmt(ct.monthlyAmount)}/mes</span>
                            <span>{ct.agentsRequired} agentes</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-zinc-600">{formatDate(ct.startDate)}{ct.endDate ? ` — ${formatDate(ct.endDate)}` : ' — Indefinido'}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* DETAIL */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'clients' && !showClientForm && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
              <BriefLgIcon />
              <p className="text-sm">Seleccione la pestaña Contratos para ver detalles</p>
            </div>
          )}

          {tab === 'contracts' && !selectedContract && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
              <BriefLgIcon />
              <p className="text-sm">Seleccione un contrato</p>
            </div>
          )}

          {tab === 'contracts' && selectedContract && (
            detailLoading ? (
              <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" /></div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold">{selectedContract.clientName}</h2>
                  <p className="mt-1 text-sm text-zinc-500">B/.{fmt(selectedContract.monthlyAmount)}/mes · {selectedContract.agentsRequired} agentes</p>
                  {selectedContract.notes && <p className="mt-2 text-sm text-zinc-400">{selectedContract.notes}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <InfoCard label="Inicio" value={formatDate(selectedContract.startDate)} />
                  <InfoCard label="Vencimiento" value={selectedContract.endDate ? formatDate(selectedContract.endDate) : 'Indefinido'} />
                  <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/40 px-5 py-4">
                    <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Propiedades</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-200">{selectedContract.properties.map((p) => p.name).join(', ') || 'Sin asignar'}</p>
                    <button onClick={openLinkProp} className="mt-2 text-xs font-medium text-lime-400 hover:text-lime-300 cursor-pointer">+ Vincular propiedad</button>
                  </div>
                </div>

                <FileUpload bucket="hr-documents" basePath={`${tenantId}/contratos-comerciales/${selectedContract.id}`} label="Adjuntar contrato firmado (PDF)" accept=".pdf" onUploaded={() => setToast({ type: 'success', msg: 'Contrato adjuntado' })} />

                {/* Stations & Consignas grouped by property */}
                <div>
                  <h3 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-3">Puestos de Control y Consignas</h3>
                  {selectedContract.properties.length === 0 ? (
                    <p className="text-sm text-zinc-600">Vincule una propiedad primero para agregar puestos.</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedContract.properties.map((prop) => {
                        const propStations = stationsDetail.filter((s) => s.propertyId === prop.id);
                        return (
                          <div key={prop.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/10 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/30">
                              <div>
                                <p className="text-sm font-semibold text-zinc-100">{prop.name}</p>
                                <p className="text-[10px] text-zinc-600">{propStations.length} puesto{propStations.length !== 1 ? 's' : ''}</p>
                              </div>
                              <button onClick={() => { setShowStationForm(prop.id); setWsName(''); }}
                                className="text-[11px] font-medium text-lime-400 hover:text-lime-300 cursor-pointer">+ Crear Puesto</button>
                            </div>

                            {/* New station form */}
                            {showStationForm === prop.id && (
                              <div className="px-5 py-3 border-b border-zinc-800/30 bg-zinc-800/20 flex items-center gap-2">
                                <input type="text" value={wsName} onChange={(e) => setWsName(e.target.value)}
                                  placeholder="Nombre del puesto (ej: Garita Principal, Lobby, Ronda Perimetral)"
                                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-lime-500 focus:outline-none" />
                                <button onClick={() => setShowStationForm(null)} className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">Cancelar</button>
                                <button onClick={handleCreateStation} disabled={wsLoading || !wsName.trim()}
                                  className="rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                                  {wsLoading ? '...' : 'Crear'}
                                </button>
                              </div>
                            )}

                            {propStations.length === 0 && !showStationForm ? (
                              <p className="px-5 py-3 text-xs text-zinc-600">Sin puestos. Cree el primer puesto de control.</p>
                            ) : (
                              <div className="divide-y divide-zinc-800/20">
                                {propStations.map((st) => (
                        <div key={st.id} className="flex items-center justify-between px-5 py-3">
                          <p className="text-sm font-medium text-zinc-100">{st.name}</p>
                          <button onClick={() => setQrStation(st)}
                            className="text-[11px] font-medium text-blue-400 hover:text-blue-300 cursor-pointer">QR</button>
                        </div>
                      ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Client form inline */}
          {showClientForm && (
            <div className="max-w-md space-y-4">
              <h3 className="text-lg font-semibold">Nuevo Cliente</h3>
              <label className="block"><span className="text-xs font-medium text-zinc-400">Razon Social</span>
                <input type="text" value={cName} onChange={(e) => setCName(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-medium text-zinc-400">RUC</span>
                  <input type="text" value={cRuc} onChange={(e) => setCRuc(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
                <label className="block"><span className="text-xs font-medium text-zinc-400">Representante Legal</span>
                  <input type="text" value={cRep} onChange={(e) => setCRep(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-medium text-zinc-400">Email</span>
                  <input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
                <label className="block"><span className="text-xs font-medium text-zinc-400">Telefono</span>
                  <input type="text" value={cPhone} onChange={(e) => setCPhone(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowClientForm(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
                <button onClick={handleCreateClient} disabled={!cName.trim() || clientLoading} className="flex flex-1 items-center justify-center rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                  {clientLoading ? <Spinner /> : 'Registrar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contract form modal */}
      {showContractForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowContractForm(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Nuevo Contrato</h3>
            <div className="mt-5 space-y-4">
              <label className="block"><span className="text-xs font-medium text-zinc-400">Cliente</span>
                <select value={ctClient} onChange={(e) => setCtClient(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                  <option value="">Seleccionar...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-medium text-zinc-400">Fecha Inicio</span>
                  <input type="date" value={ctStart} onChange={(e) => setCtStart(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
                <label className="block"><span className="text-xs font-medium text-zinc-400">Fecha Fin (opcional)</span>
                  <input type="date" value={ctEnd} onChange={(e) => setCtEnd(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-medium text-zinc-400">Monto Mensual (B/.)</span>
                  <input type="text" inputMode="decimal" value={ctAmount} onChange={(e) => setCtAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
                <label className="block"><span className="text-xs font-medium text-zinc-400">Agentes Requeridos</span>
                  <input type="text" inputMode="numeric" value={ctAgents} onChange={(e) => setCtAgents(e.target.value.replace(/[^0-9]/g, ''))} placeholder="1" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" /></label>
              </div>
              <label className="block"><span className="text-xs font-medium text-zinc-400">Notas</span>
                <textarea value={ctNotes} onChange={(e) => setCtNotes(e.target.value)} rows={2} className="mt-1 block w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none" /></label>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowContractForm(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleCreateContract} disabled={!ctClient || !ctStart || !ctAmount || parseFloat(ctAmount) <= 0 || contractLoading} className="flex flex-1 items-center justify-center rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {contractLoading ? <Spinner /> : 'Crear Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Property Modal */}
      {showLinkProp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLinkProp(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl space-y-5">
            <h3 className="text-lg font-semibold">Vincular Propiedad al Contrato</h3>
            <p className="text-xs text-zinc-500">{selectedContract?.clientName}</p>

            {!showNewProp ? (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Propiedad existente</span>
                  <select value={selectedProp} onChange={(e) => setSelectedProp(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                    <option value="">Seleccionar propiedad...</option>
                    {availableProps.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-zinc-800" />
                  <span className="text-[10px] text-zinc-600 uppercase">o</span>
                  <div className="flex-1 border-t border-zinc-800" />
                </div>
                <button onClick={() => setShowNewProp(true)}
                  className="w-full rounded-xl border border-dashed border-zinc-700 py-3 text-sm font-medium text-lime-400 hover:border-lime-500/30 hover:bg-lime-500/5 cursor-pointer transition-colors">
                  + Crear Nueva Propiedad
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setShowLinkProp(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
                  <button onClick={handleLinkProp} disabled={!selectedProp || linkLoading}
                    className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                    {linkLoading ? 'Vinculando...' : 'Vincular'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Nombre de la propiedad</span>
                  <input type="text" value={npName} onChange={(e) => setNpName(e.target.value)}
                    placeholder="Ej: Torre Madrid, Oficina Central" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Dirección (opcional)</span>
                  <input type="text" value={npAddress} onChange={(e) => setNpAddress(e.target.value)}
                    placeholder="Ej: Calle 50, Edificio Global" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
                </label>
                <div className="flex gap-3">
                  <button onClick={() => setShowNewProp(false)} className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Volver</button>
                  <button onClick={handleCreateAndLinkProp} disabled={!npName.trim() || npLoading}
                    className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                    {npLoading ? 'Creando...' : 'Crear y Vincular'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setQrStation(null); }}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl text-center space-y-4">
            <h3 className="text-lg font-semibold">Código QR del Puesto</h3>
            <p className="text-xs text-zinc-500">{qrStation.name}</p>
            <div ref={qrRef} className="flex justify-center py-4">
              <QRCodeCanvas
                value={JSON.stringify({ station_id: qrStation.id, token: qrStation.qrToken })}
                size={220}
                bgColor="#ffffff"
                fgColor="#0A0E1A"
                level="H"
                includeMargin
              />
            </div>
            <p className="text-[10px] text-zinc-600 font-mono break-all">Token: {qrStation.qrToken}</p>
            <div className="flex gap-3">
              <button onClick={() => setQrStation(null)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer">Cerrar</button>
              <button onClick={downloadQr}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer">Descargar PNG</button>
            </div>
            <p className="text-[10px] text-zinc-600">Imprima y coloque este QR en el puesto de control. El agente lo escanea para marcar entrada.</p>
          </div>
        </div>
      )}

      {toast && <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-[slideUp_0.3s_ease-out] ${toast.type === 'success' ? 'bg-lime-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>}
    </div>
  );
}

// Sub-components
function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${accent === 'lime' ? 'border-lime-500/20 bg-lime-500/5' : 'border-zinc-700/30 bg-zinc-800/40'}`}>
      <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent === 'lime' ? 'text-lime-400' : 'text-zinc-200'}`}>{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-4 py-3">
      <p className="text-[11px] font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-200">{value}</p>
    </div>
  );
}

function Empty({ title, subtitle, action, onAction }: { title: string; subtitle: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <BriefLgIcon />
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="text-xs text-zinc-600">{subtitle}</p>
      <button onClick={onAction} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer"><PlusIcon /> {action}</button>
    </div>
  );
}

// Icons
function BriefIcon() {
  return <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>;
}
function BriefLgIcon() {
  return <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>;
}
function PlusIcon() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
}
function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}
