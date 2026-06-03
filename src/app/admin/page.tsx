'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface TenantMember {
  userId: string;
  email: string;
  name: string;
  role: string;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  members: TenantMember[];
  enabledModules: string[];
}

const ALL_MODULES = [
  { key: 'comercial', label: 'Clientes y Contratos' },
  { key: 'gerencial', label: 'Dashboard Gerencial' },
  { key: 'noc', label: 'NOC Monitor' },
  { key: 'comando', label: 'Centro de Comando' },
  { key: 'cambio_turno', label: 'Cambio de Turno' },
  { key: 'turnos', label: 'Programación de Turnos' },
  { key: 'consignas', label: 'Consignas' },
  { key: 'puesto', label: 'Mi Puesto' },
  { key: 'armamento', label: 'Armamento' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'flota', label: 'Flota' },
  { key: 'rrhh', label: 'RRHH' },
  { key: 'capacitaciones', label: 'Capacitaciones' },
  { key: 'nomina', label: 'Nómina' },
  { key: 'cliente', label: 'Portal Cliente' },
];

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  // Create tenant
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [tName, setTName] = useState('');
  const [tSlug, setTSlug] = useState('');
  const [tPlan, setTPlan] = useState('pro');
  const [tModules, setTModules] = useState<string[]>(ALL_MODULES.map((m) => m.key));
  const [tLoading, setTLoading] = useState(false);
  const [tMsg, setTMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Edit tenant modules
  const [editingModules, setEditingModules] = useState<string | null>(null);
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editModLoading, setEditModLoading] = useState(false);

  // Create user
  const [showUserForm, setShowUserForm] = useState(false);
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uName, setUName] = useState('');
  const [uTenant, setUTenant] = useState('');
  const [uRole, setURole] = useState('owner');
  const [uLoading, setULoading] = useState(false);
  const [uMsg, setUMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Check auth
  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email === 'alexisvieto@gmail.com') {
        setIsAuthed(true);
      }
      setIsLoading(false);
    })();
  }, []);

  // Load tenants
  const loadTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/admin');
      if (res.ok) {
        const { data } = await res.json() as { data: TenantRow[] };
        setTenants(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { if (isAuthed) loadTenants(); }, [isAuthed, loadTenants]);

  // Create tenant
  const handleCreateTenant = useCallback(async () => {
    if (!tName.trim() || !tSlug.trim()) return;
    setTLoading(true); setTMsg(null);

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_tenant', name: tName.trim(), slug: tSlug.trim(), plan: tPlan, enabled_modules: tModules }),
      });

      if (res.ok) {
        setTMsg({ type: 'ok', text: `Tenant "${tName}" creado` });
        setTName(''); setTSlug(''); setTPlan('pro');
        setShowTenantForm(false);
        loadTenants();
      } else {
        const err = await res.json() as Record<string, unknown>;
        const msg = (err['error'] && typeof err['error'] === 'object' && 'message' in (err['error'] as object))
          ? String((err['error'] as { message: unknown }).message) : 'Error';
        setTMsg({ type: 'err', text: msg });
      }
    } catch { setTMsg({ type: 'err', text: 'Error de conexión' }); }
    finally { setTLoading(false); }
  }, [tName, tSlug, tPlan, loadTenants]);

  // Create user
  const handleCreateUser = useCallback(async () => {
    if (!uEmail.trim() || !uPassword || !uName.trim() || !uTenant) return;
    setULoading(true); setUMsg(null);

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_user', email: uEmail.trim(), password: uPassword, full_name: uName.trim(), tenant_id: uTenant, role: uRole }),
      });

      if (res.ok) {
        setUMsg({ type: 'ok', text: `Usuario "${uName}" creado en ${tenants.find(t => t.id === uTenant)?.name}` });
        setUEmail(''); setUPassword(''); setUName('');
        setShowUserForm(false);
        loadTenants();
      } else {
        const err = await res.json() as Record<string, unknown>;
        const msg = (err['error'] && typeof err['error'] === 'object' && 'message' in (err['error'] as object))
          ? String((err['error'] as { message: unknown }).message) : 'Error';
        setUMsg({ type: 'err', text: msg });
      }
    } catch { setUMsg({ type: 'err', text: 'Error de conexión' }); }
    finally { setULoading(false); }
  }, [uEmail, uPassword, uName, uTenant, uRole, tenants, loadTenants]);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A] text-zinc-100">
        <div className="text-center">
          <p className="text-lg font-bold">Acceso Restringido</p>
          <p className="mt-2 text-sm text-zinc-500">Panel de super administrador. Inicie sesión con una cuenta autorizada.</p>
          <a href="/login" className="mt-6 inline-block rounded-xl bg-lime-600 px-6 py-3 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer">
            Iniciar Sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-lime-500 uppercase">Super Admin</p>
          <h1 className="text-lg font-bold">Panel de Administración NexGuard360</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setShowTenantForm(true); setTMsg(null); }}
            className="flex items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-500 cursor-pointer">
            + Nuevo Tenant
          </button>
          <button onClick={() => { setShowUserForm(true); setUMsg(null); }}
            className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer">
            + Nuevo Usuario
          </button>
        </div>
      </header>

      {/* Messages */}
      {(tMsg || uMsg) && (
        <div className="px-6 py-2">
          {tMsg && <p className={`text-sm ${tMsg.type === 'ok' ? 'text-lime-400' : 'text-red-400'}`}>{tMsg.text}</p>}
          {uMsg && <p className={`text-sm ${uMsg.type === 'ok' ? 'text-lime-400' : 'text-red-400'}`}>{uMsg.text}</p>}
        </div>
      )}

      {/* Tenants list */}
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-4">
          Tenants ({tenants.length})
        </p>
        <div className="space-y-3">
          {tenants.map((t) => {
            const isExpanded = expandedTenant === t.id;
            return (
              <div key={t.id} className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={() => setExpandedTenant(isExpanded ? null : t.id)}
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{t.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      /{t.slug} — Plan: <span className="text-zinc-300">{t.plan}</span> — {t.members.length} usuario{t.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600">{new Date(t.created_at).toLocaleDateString('es-PA')}</span>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-800/30">
                    {/* Users */}
                    <div className="px-5 py-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Usuarios</p>
                      {t.members.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic">Sin usuarios</p>
                      ) : (
                        <div className="space-y-2">
                          {t.members.map((m) => (
                            <div key={m.userId} className="flex items-center justify-between text-xs">
                              <div>
                                <span className="text-zinc-200 font-medium">{m.name}</span>
                                <span className="text-zinc-500 ml-2">{m.email}</span>
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                m.role === 'owner' ? 'bg-lime-500/15 text-lime-400' :
                                m.role === 'admin' ? 'bg-blue-500/15 text-blue-400' :
                                m.role === 'editor' ? 'bg-amber-500/15 text-amber-400' :
                                'bg-zinc-500/15 text-zinc-400'
                              }`}>{m.role === 'owner' ? 'Gerente' : m.role === 'admin' ? 'Operador' : m.role === 'editor' ? 'Agente' : 'Cliente'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Modules */}
                    <div className="px-5 py-3 border-t border-zinc-800/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Módulos ({t.enabledModules.length}/{ALL_MODULES.length})</p>
                        <button onClick={(e) => { e.stopPropagation(); setEditingModules(t.id); setEditModules(t.enabledModules.length > 0 ? t.enabledModules : ALL_MODULES.map((m) => m.key)); }}
                          className="text-[10px] font-medium text-lime-400 hover:text-lime-300 cursor-pointer">Editar</button>
                      </div>
                      {editingModules === t.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-1">
                            {ALL_MODULES.map((m) => (
                              <label key={m.key} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-zinc-800/50 cursor-pointer">
                                <input type="checkbox" checked={editModules.includes(m.key)}
                                  onChange={(e) => setEditModules((prev) => e.target.checked ? [...prev, m.key] : prev.filter((k) => k !== m.key))}
                                  className="h-3 w-3 rounded border-zinc-600 text-lime-600 focus:ring-lime-500 cursor-pointer" />
                                <span className="text-[10px] text-zinc-300">{m.label}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingModules(null)} className="px-3 py-1.5 text-[10px] text-zinc-500 cursor-pointer">Cancelar</button>
                            <button disabled={editModLoading} onClick={async () => {
                              setEditModLoading(true);
                              await fetch('/api/admin', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'update_modules', tenant_id: t.id, enabled_modules: editModules }),
                              });
                              setEditingModules(null); setEditModLoading(false);
                              setTMsg({ type: 'ok', text: `Módulos actualizados para ${t.name}` });
                              loadTenants();
                            }} className="rounded-lg bg-lime-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                              {editModLoading ? '...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {t.enabledModules.length === 0 ? (
                            <span className="text-[10px] text-amber-400">Todos los módulos (sin restricción)</span>
                          ) : (
                            t.enabledModules.map((key) => {
                              const mod = ALL_MODULES.find((m) => m.key === key);
                              return mod ? (
                                <span key={key} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">{mod.label}</span>
                              ) : null;
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Tenant Modal */}
      {showTenantForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowTenantForm(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl space-y-5">
            <h3 className="text-lg font-semibold">Nuevo Tenant</h3>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Nombre de la empresa</span>
              <input type="text" value={tName} onChange={(e) => setTName(e.target.value)}
                placeholder="Seguridad Alfa" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Slug (URL)</span>
              <input type="text" value={tSlug} onChange={(e) => setTSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="alfa" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 font-mono focus:border-lime-500 focus:outline-none" />
              <p className="mt-1 text-[10px] text-zinc-600">nexguard360.com/{tSlug || 'slug'}/dashboard</p>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Plan</span>
              <select value={tPlan} onChange={(e) => setTPlan(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none cursor-pointer">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            {/* Modules */}
            <div>
              <span className="text-xs font-medium text-zinc-400">Módulos habilitados</span>
              <div className="mt-2 grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                {ALL_MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800/50 cursor-pointer">
                    <input type="checkbox" checked={tModules.includes(m.key)}
                      onChange={(e) => setTModules((prev) => e.target.checked ? [...prev, m.key] : prev.filter((k) => k !== m.key))}
                      className="h-3.5 w-3.5 rounded border-zinc-600 text-lime-600 focus:ring-lime-500 cursor-pointer" />
                    <span className="text-xs text-zinc-300">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowTenantForm(false)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer">Cancelar</button>
              <button onClick={handleCreateTenant} disabled={tLoading || !tName.trim() || !tSlug.trim()}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                {tLoading ? 'Creando...' : 'Crear Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showUserForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowUserForm(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl space-y-5">
            <h3 className="text-lg font-semibold">Nuevo Usuario</h3>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Tenant</span>
              <select value={uTenant} onChange={(e) => setUTenant(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none cursor-pointer">
                <option value="">Seleccionar empresa...</option>
                {tenants.map((t) => (<option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Nombre completo</span>
              <input type="text" value={uName} onChange={(e) => setUName(e.target.value)}
                placeholder="Juan Pérez" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Email</span>
              <input type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)}
                placeholder="juan@empresa.com" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Contraseña</span>
              <input type="text" value={uPassword} onChange={(e) => setUPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 font-mono focus:border-lime-500 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Rol</span>
              <select value={uRole} onChange={(e) => setURole(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-lime-500 focus:outline-none cursor-pointer">
                <option value="owner">Gerente / Dueño — acceso total al ERP</option>
                <option value="admin">Operador — gestión operativa sin comercial ni nómina</option>
                <option value="editor">Agente de Campo — solo Mi Puesto y reporte de novedades</option>
                <option value="viewer">Cliente / Auditor — solo lectura, portal del cliente</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button onClick={() => setShowUserForm(false)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer">Cancelar</button>
              <button onClick={handleCreateUser} disabled={uLoading || !uEmail.trim() || !uPassword || !uName.trim() || !uTenant}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer">
                {uLoading ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
