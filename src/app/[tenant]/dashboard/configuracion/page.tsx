'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface BrandingConfig {
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

interface RegionalConfig {
  country: string;
  currency_symbol: string;
  currency_code: string;
  timezone: string;
}

interface PayrollDeduction {
  name: string;
  pct: string;
}

interface PayrollConfig {
  deductions: PayrollDeduction[];
  max_regular_hours: string;
  overtime_enabled: boolean;
}

interface FirearmsConfig {
  regulatory_entity: string;
  default_permit_months: string;
}

const countryDefaults: Record<string, { currency_symbol: string; currency_code: string; timezone: string }> = {
  PA: { currency_symbol: 'B/.', currency_code: 'USD', timezone: 'America/Panama' },
  CO: { currency_symbol: '$', currency_code: 'COP', timezone: 'America/Bogota' },
  CR: { currency_symbol: '₡', currency_code: 'CRC', timezone: 'America/Costa_Rica' },
  GT: { currency_symbol: 'Q', currency_code: 'GTQ', timezone: 'America/Guatemala' },
  HN: { currency_symbol: 'L', currency_code: 'HNL', timezone: 'America/Tegucigalpa' },
  SV: { currency_symbol: '$', currency_code: 'USD', timezone: 'America/El_Salvador' },
  NI: { currency_symbol: 'C$', currency_code: 'NIO', timezone: 'America/Managua' },
  DO: { currency_symbol: 'RD$', currency_code: 'DOP', timezone: 'America/Santo_Domingo' },
  EC: { currency_symbol: '$', currency_code: 'USD', timezone: 'America/Guayaquil' },
  PE: { currency_symbol: 'S/', currency_code: 'PEN', timezone: 'America/Lima' },
  MX: { currency_symbol: '$', currency_code: 'MXN', timezone: 'America/Mexico_City' },
};

export default function ConfiguracionPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [branding, setBranding] = useState<BrandingConfig>({ logo_url: '', address: '', phone: '', email: '', website: '' });
  const [regional, setRegional] = useState<RegionalConfig>({ country: 'PA', currency_symbol: 'B/.', currency_code: 'USD', timezone: 'America/Panama' });
  const [payroll, setPayroll] = useState<PayrollConfig>({
    deductions: [
      { name: 'CSS (Seguro Social)', pct: '9.75' },
      { name: 'Seguro Educativo', pct: '1.25' },
    ],
    max_regular_hours: '96',
    overtime_enabled: true,
  });
  const [firearms, setFirearms] = useState<FirearmsConfig>({ regulatory_entity: 'DIASP', default_permit_months: '12' });

  // Logo upload
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const loadConfig = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;
    setTenantId(tenant.id);

    const res = await fetch(`/api/tenant-config?tenant_id=${tenant.id}`);
    if (!res.ok) return;
    const { data } = await res.json() as { data: { id: string; name: string; settings: Record<string, unknown>; logo_url: string | null } };

    setTenantName(data.name);
    if (data.logo_url) setLogoPreview(data.logo_url);

    const s = data.settings ?? {};
    if (s['branding']) setBranding(s['branding'] as BrandingConfig);
    if (s['regional']) setRegional(s['regional'] as RegionalConfig);
    if (s['payroll']) {
      const p = s['payroll'] as Record<string, unknown>;
      if (Array.isArray(p['deductions'])) {
        setPayroll(p as unknown as PayrollConfig);
      } else {
        // Migrate old format
        setPayroll({
          deductions: [
            { name: String(p['deduction1_name'] ?? 'CSS'), pct: String(p['deduction1_pct'] ?? '9.75') },
            { name: String(p['deduction2_name'] ?? 'SE'), pct: String(p['deduction2_pct'] ?? '1.25') },
          ],
          max_regular_hours: String(p['max_regular_hours'] ?? '96'),
          overtime_enabled: true,
        });
      }
    }
    if (s['firearms']) setFirearms(s['firearms'] as FirearmsConfig);

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = useCallback(async () => {
    if (!tenantId) return;
    setSaving(true);

    try {
      let logoUrl = branding.logo_url;

      // Upload logo if new file
      if (logoFile) {
        const supabase = getSupabaseBrowserClient();
        const ext = logoFile.name.split('.').pop() ?? 'png';
        const path = `${tenantId}/branding/logo.${ext}`;
        await supabase.storage.from('hr-documents').upload(path, logoFile, { contentType: logoFile.type, upsert: true });
        logoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/hr-documents/${path}`;
      }

      const res = await fetch('/api/tenant-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: tenantName.trim(),
          logo_url: logoUrl || null,
          branding: { ...branding, logo_url: logoUrl },
          regional,
          payroll,
          firearms,
        }),
      });

      if (!res.ok) { setToast('Error al guardar configuración'); setSaving(false); return; }

      setToast('Configuración guardada');
      setLogoFile(null);
    } catch {
      setToast('Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [tenantId, tenantName, branding, regional, payroll, firearms, logoFile]);

  const updateBranding = (key: keyof BrandingConfig, val: string) => setBranding((p) => ({ ...p, [key]: val }));
  const updateRegional = (key: keyof RegionalConfig, val: string) => setRegional((p) => ({ ...p, [key]: val }));
  const updateFirearms = (key: keyof FirearmsConfig, val: string) => setFirearms((p) => ({ ...p, [key]: val }));

  if (isLoading) {
    return <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" /></div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Administración</p>
          <h1 className="text-lg font-bold">Configuración de Empresa</h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-3xl">

        {/* BRANDING */}
        <Section title="Identidad de la Empresa">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-zinc-400">Nombre de la Empresa</span>
              <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none" />
            </label>
            <div className="sm:col-span-2">
              <span className="text-xs font-medium text-zinc-400">Logo de la Empresa</span>
              <div className="mt-1 flex items-center gap-4">
                {(logoPreview || branding.logo_url) && (
                  <img src={logoPreview ?? branding.logo_url} alt="Logo" className="h-12 w-auto rounded-lg bg-zinc-800 p-1" />
                )}
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { if (logoPreview) URL.revokeObjectURL(logoPreview); setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
                }} className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-xs file:text-zinc-300 file:cursor-pointer cursor-pointer" />
              </div>
              <p className="mt-1 text-[10px] text-zinc-600">Este logo aparecerá en todos los reportes PDF generados por su empresa.</p>
            </div>
            <Field label="Dirección" value={branding.address} onChange={(v) => updateBranding('address', v)} placeholder="Calle 50, Ciudad de Panamá" />
            <Field label="Teléfono" value={branding.phone} onChange={(v) => updateBranding('phone', v)} placeholder="+507 6000-0000" />
            <Field label="Email" value={branding.email} onChange={(v) => updateBranding('email', v)} placeholder="info@empresa.com" />
            <Field label="Sitio Web (opcional)" value={branding.website} onChange={(v) => updateBranding('website', v)} placeholder="www.empresa.com" />
          </div>
        </Section>

        {/* REGIONAL */}
        <Section title="Configuración Regional">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">País</span>
              <select value={regional.country} onChange={(e) => {
                  const code = e.target.value;
                  const defaults = countryDefaults[code];
                  if (defaults) {
                    setRegional({ country: code, ...defaults });
                  } else {
                    updateRegional('country', code);
                  }
                }}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none cursor-pointer">
                <option value="PA">Panamá</option>
                <option value="CO">Colombia</option>
                <option value="CR">Costa Rica</option>
                <option value="GT">Guatemala</option>
                <option value="HN">Honduras</option>
                <option value="SV">El Salvador</option>
                <option value="NI">Nicaragua</option>
                <option value="DO">República Dominicana</option>
                <option value="EC">Ecuador</option>
                <option value="PE">Perú</option>
                <option value="MX">México</option>
              </select>
            </label>
            <Field label="Símbolo de Moneda" value={regional.currency_symbol} onChange={(v) => updateRegional('currency_symbol', v)} placeholder="B/." />
            <Field label="Código de Moneda" value={regional.currency_code} onChange={(v) => updateRegional('currency_code', v)} placeholder="USD" />
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Zona Horaria</span>
              <select value={regional.timezone} onChange={(e) => updateRegional('timezone', e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none cursor-pointer">
                <option value="America/Panama">Panamá (UTC-5)</option>
                <option value="America/Bogota">Colombia (UTC-5)</option>
                <option value="America/Costa_Rica">Costa Rica (UTC-6)</option>
                <option value="America/Guatemala">Guatemala (UTC-6)</option>
                <option value="America/Tegucigalpa">Honduras (UTC-6)</option>
                <option value="America/El_Salvador">El Salvador (UTC-6)</option>
                <option value="America/Managua">Nicaragua (UTC-6)</option>
                <option value="America/Santo_Domingo">Rep. Dominicana (UTC-4)</option>
                <option value="America/Guayaquil">Ecuador (UTC-5)</option>
                <option value="America/Lima">Perú (UTC-5)</option>
                <option value="America/Mexico_City">México Central (UTC-6)</option>
              </select>
            </label>
          </div>
        </Section>

        {/* PAYROLL */}
        <Section title="Configuración de Nómina">
          <p className="text-xs text-zinc-500 mb-4">Estos valores se usan para calcular las retenciones en la planilla quincenal.</p>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-400">Deducciones sobre el salario bruto</span>
              <button onClick={() => setPayroll((p) => ({ ...p, deductions: [...p.deductions, { name: '', pct: '' }] }))}
                className="text-[11px] font-medium text-lime-400 hover:text-lime-300 cursor-pointer">+ Agregar Deducción</button>
            </div>
            <div className="space-y-3">
              {payroll.deductions.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input type="text" value={d.name} placeholder="Nombre de la deducción"
                    onChange={(e) => setPayroll((p) => ({ ...p, deductions: p.deductions.map((dd, j) => j === i ? { ...dd, name: e.target.value } : dd) }))}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none" />
                  <div className="flex items-center gap-1">
                    <input type="number" value={d.pct} placeholder="%" step="0.01"
                      onChange={(e) => setPayroll((p) => ({ ...p, deductions: p.deductions.map((dd, j) => j === i ? { ...dd, pct: e.target.value } : dd) }))}
                      className="w-24 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-sm text-zinc-100 text-center focus:border-lime-500 focus:outline-none" />
                    <span className="text-xs text-zinc-500">%</span>
                  </div>
                  {payroll.deductions.length > 1 && (
                    <button onClick={() => setPayroll((p) => ({ ...p, deductions: p.deductions.filter((_, j) => j !== i) }))}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-500/10 hover:text-red-400 cursor-pointer shrink-0">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={payroll.overtime_enabled}
                onChange={(e) => setPayroll((p) => ({ ...p, overtime_enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-600 text-lime-600 focus:ring-lime-500 cursor-pointer" />
              <div>
                <span className="text-sm font-medium text-zinc-200">Pagar horas extras</span>
                <p className="text-[10px] text-zinc-500">Si está desactivado, todas las horas se pagan a tarifa normal sin recargo por extras.</p>
              </div>
            </label>

            {payroll.overtime_enabled && (
              <label className="block max-w-xs">
                <span className="text-xs font-medium text-zinc-400">Máximo de Horas Ordinarias por Quincena</span>
                <input type="number" value={payroll.max_regular_hours} onChange={(e) => setPayroll((p) => ({ ...p, max_regular_hours: e.target.value }))} placeholder="96"
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none" />
                <p className="mt-1 text-[10px] text-zinc-600">Las horas que excedan este tope se pagan como horas extras.</p>
              </label>
            )}
          </div>
        </Section>

        {/* FIREARMS */}
        <Section title="Configuración de Armamento">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entidad Reguladora" value={firearms.regulatory_entity} onChange={(v) => updateFirearms('regulatory_entity', v)} placeholder="DIASP" />
            <Field label="Vigencia por Defecto de Permisos (meses)" value={firearms.default_permit_months} onChange={(v) => updateFirearms('default_permit_months', v)} placeholder="12" type="number" />
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">El nombre de la entidad reguladora aparecerá en los reportes y fichas de armamento en lugar de &quot;DIASP&quot;.</p>
        </Section>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-lime-600 px-5 py-3 text-sm font-medium text-white shadow-lg animate-[slideUp_0.3s_ease-out]">{toast}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800/40 bg-zinc-800/10 p-6">
      <h2 className="text-xs font-semibold tracking-widest text-lime-400 uppercase mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <input type={type ?? 'text'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none" />
    </label>
  );
}
