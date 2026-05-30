import { getCurrentTenant } from '@/lib/tenant/get-tenant';

interface DashboardPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { tenant: slug } = await params;
  const tenant = await getCurrentTenant(slug);

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold">{tenant.name}</h1>
      <p className="mt-2 text-zinc-500">Dashboard — Plan: {tenant.plan}</p>
    </main>
  );
}
