import { notFound } from 'next/navigation';
import { getCurrentTenant, getCurrentUserRole, getCurrentUserMembership } from '@/lib/tenant/get-tenant';
import { TenantSidebar } from './sidebar';
import { RealtimeAlerts } from './realtime-alerts';

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getCurrentTenant(slug);
    return {
      title: {
        default: tenant.name,
        template: `%s | ${tenant.name}`,
      },
    };
  } catch {
    return { title: 'Tenant no encontrado' };
  }
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { tenant: slug } = await params;

  let tenant;
  try {
    tenant = await getCurrentTenant(slug);
  } catch {
    notFound();
  }

  const membership = await getCurrentUserMembership(tenant.id);

  if (!membership) {
    notFound();
  }

  const role = membership.role;
  const rawType = membership.employee_type;
  const employeeType = (rawType && rawType !== 'agente')
    ? rawType
    : role === 'owner' ? 'gerente' : role === 'viewer' ? 'cliente' : rawType ?? 'agente';

  return (
    <div className="flex h-dvh bg-[#0A0E1A]" data-tenant-id={tenant.id} data-tenant-slug={tenant.slug}>
      <TenantSidebar tenantSlug={slug} tenantName={tenant.name} role={role} employeeType={employeeType} enabledModules={((tenant.settings as Record<string, unknown>)?.['enabled_modules'] as string[] | undefined) ?? []} />
      <main className="relative flex-1 overflow-hidden">
        {(role === 'owner' || role === 'admin') && (
          <RealtimeAlerts tenantId={tenant.id} tenantSlug={slug} />
        )}
        {children}
      </main>
    </div>
  );
}
