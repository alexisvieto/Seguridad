import { notFound } from 'next/navigation';
import { getCurrentTenant, getCurrentUserRole } from '@/lib/tenant/get-tenant';
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

  const role = await getCurrentUserRole(tenant.id);

  if (!role) {
    notFound();
  }

  return (
    <div className="flex h-dvh bg-[#0A0E1A]" data-tenant-id={tenant.id} data-tenant-slug={tenant.slug}>
      <TenantSidebar tenantSlug={slug} tenantName={tenant.name} role={role} />
      <main className="relative flex-1 overflow-hidden">
        <RealtimeAlerts tenantId={tenant.id} tenantSlug={slug} />
        {children}
      </main>
    </div>
  );
}
