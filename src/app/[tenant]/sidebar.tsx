'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  tenantSlug: string;
  tenantName: string;
  role: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  section: 'commercial' | 'operations' | 'resources' | 'hr' | 'finance' | 'client';
  badgeCount?: number;
}

const sectionLabels: Record<string, string> = {
  operations: 'Operaciones',
  resources: 'Recursos',
  commercial: 'Gestion Comercial',
  hr: 'RRHH',
  finance: 'Finanzas',
  client: 'Clientes',
};

export function TenantSidebar({ tenantSlug, tenantName, role }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const base = `/${tenantSlug}`;

  useEffect(() => {
    if (role !== 'owner' && role !== 'admin') return;
    (async () => {
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const supabase = getSupabaseBrowserClient();
      const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
      if (!tenant) return;

      const [ticketsRes, damagesRes] = await Promise.all([
        supabase.from('client_tickets').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).in('status', ['abierto', 'en_proceso']),
        supabase.from('client_damage_reports').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'bajo_investigacion'),
      ]);

      setPendingCount((ticketsRes.count ?? 0) + (damagesRes.count ?? 0));
    })();
  }, [tenantSlug, role]);

  const navItems: NavItem[] = [
    {
      href: `${base}/dashboard/comercial`,
      label: 'Clientes y Contratos',
      icon: <BriefcaseIcon />,
      roles: ['owner', 'admin'],
      section: 'commercial',
    },
    {
      href: `${base}/dashboard`,
      label: 'Gerencial',
      icon: <DashboardIcon />,
      roles: ['owner', 'admin'],
      section: 'operations',
    },
    {
      href: `${base}/dashboard/live-monitor`,
      label: 'NOC Monitor',
      icon: <MonitorIcon />,
      roles: ['owner', 'admin'],
      section: 'operations',
    },
    {
      href: `${base}/dashboard/executive`,
      label: 'Centro de Comando',
      icon: <ChartIcon />,
      roles: ['owner', 'admin'],
      section: 'operations',
    },
    {
      href: `${base}/dashboard/cambio-turno`,
      label: 'Cambio de Turno',
      icon: <SwapIcon />,
      roles: ['owner', 'admin'],
      section: 'operations',
    },
    {
      href: `${base}/dashboard/turnos`,
      label: 'Turnos',
      icon: <CalendarIcon />,
      roles: ['owner', 'admin'],
      section: 'operations',
    },
    {
      href: `${base}/puesto`,
      label: 'Mi Puesto',
      icon: <QrIcon />,
      roles: ['owner', 'admin', 'editor'],
      section: 'operations',
    },
    {
      href: `${base}/dashboard/armamento`,
      label: 'Armamento',
      icon: <ShieldIcon />,
      roles: ['owner', 'admin'],
      section: 'resources',
    },
    {
      href: `${base}/dashboard/inventario`,
      label: 'Inventario',
      icon: <BoxIcon />,
      roles: ['owner', 'admin'],
      section: 'resources',
    },
    {
      href: `${base}/dashboard/flota`,
      label: 'Flota',
      icon: <TruckIcon />,
      roles: ['owner', 'admin'],
      section: 'resources',
    },
    {
      href: `${base}/dashboard/rrhh`,
      label: 'RRHH',
      icon: <UserFileIcon />,
      roles: ['owner', 'admin'],
      section: 'hr',
    },
    {
      href: `${base}/dashboard/capacitaciones`,
      label: 'Capacitaciones',
      icon: <CertIcon />,
      roles: ['owner', 'admin'],
      section: 'hr',
    },
    {
      href: `${base}/dashboard/nomina`,
      label: 'Nomina',
      icon: <WalletIcon />,
      roles: ['owner', 'admin'],
      section: 'finance',
    },
    {
      href: `${base}/dashboard/atencion-cliente`,
      label: 'Atención al Cliente',
      icon: <TicketIcon />,
      roles: ['owner', 'admin'],
      section: 'client',
      badgeCount: pendingCount,
    },
    {
      href: `${base}/cliente`,
      label: 'Portal Cliente',
      icon: <BuildingIcon />,
      roles: ['viewer'],
      section: 'client',
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  const sections = [...new Set(visibleItems.map((i) => i.section))];

  return (
    <aside className={`flex shrink-0 flex-col border-r border-zinc-800/60 bg-[#080D18] transition-all duration-200 ${
      collapsed ? 'w-16' : 'w-56'
    }`}>

      {/* Logo */}
      <div className="border-b border-zinc-800/60 px-2 py-5">
        {collapsed ? (
          <div className="flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-600/20">
              <span className="text-sm font-bold text-lime-400">N</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 min-w-0">
            <img src="/brand/logo-nexguard360-dark.svg" alt="NexGuard360" className="w-full h-auto" />
            <p className="text-[10px] text-zinc-600 truncate px-1">{tenantName}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section} className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                {sectionLabels[section]}
              </p>
            )}
            {visibleItems
              .filter((item) => item.section === section)
              .map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer mb-0.5 min-h-[36px] ${
                      isActive
                        ? 'bg-lime-500/10 text-lime-400'
                        : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                    }`}
                  >
                    <span className="relative shrink-0">
                      {item.icon}
                      {item.badgeCount !== undefined && item.badgeCount > 0 && collapsed && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{item.badgeCount > 9 ? '9+' : item.badgeCount}</span>
                      )}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badgeCount !== undefined && item.badgeCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{item.badgeCount > 99 ? '99+' : item.badgeCount}</span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-zinc-800/60 px-2 py-3 space-y-1">
        <button
          onClick={async () => {
            const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
            const supabase = getSupabaseBrowserClient();
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400 cursor-pointer min-h-[36px] ${collapsed ? 'justify-center' : ''}`}
        >
          <LogoutIcon />
          {!collapsed && <span className="truncate">Cerrar Sesión</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg px-2.5 py-2 text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300 cursor-pointer min-h-[36px]"
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Icons (16x16, consistent stroke)
// ---------------------------------------------------------------------------

function MonitorIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function CertIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function UserFileIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H18.75M3.375 14.25h.008v.008h-.008v-.008zm0 0V4.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v8.25M18.75 14.25l-3-6h-4.5" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}
