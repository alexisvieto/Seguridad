import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';

interface PayrollMetrics {
  periodLabel: string | null;
  periodStatus: string | null;
  totalGross: number;
  totalNet: number;
  totalOvertimeHours: number;
  agentCount: number;
}

interface ComplianceAlerts {
  contractsPendingSeal: number;
  trainingExpiringSoon: number;
  trainingExpired: number;
}

interface IncidentAnalytics {
  last30DaysTotal: number;
  openIncidents: number;
  resolvedIncidents: number;
}

interface ExecutiveDashboard {
  payroll: PayrollMetrics;
  compliance: ComplianceAlerts;
  incidents: IncidentAnalytics;
  generatedAt: string;
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();

    // 1. Authenticate and resolve tenant
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AppError('UNAUTHORIZED', 'No autenticado');
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      throw new AppError('FORBIDDEN', 'Sin acceso a ningun tenant');
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Acceso restringido a administradores');
    }

    const tenantId = membership.tenant_id;

    // 2. Parallel queries
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]!;
    const today = new Date().toISOString().split('T')[0]!;

    const [
      latestPeriodRes,
      pendingSealRes,
      trainingExpiringRes,
      trainingExpiredRes,
      incidentsRes,
      openIncidentsRes,
      resolvedIncidentsRes,
    ] = await Promise.all([
      // Payroll: latest calculated or closed period
      supabase
        .from('payroll_periods')
        .select('id, start_date, end_date, status')
        .eq('tenant_id', tenantId)
        .in('status', ['calculado', 'cerrado_pagado'])
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Compliance: contracts pending MITRADEL seal
      supabase
        .from('hr_contracts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pendiente_sello'),

      // Compliance: training expiring in next 30 days
      supabase
        .from('agent_training_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('expiry_date', today)
        .lte('expiry_date', thirtyDaysFromNow),

      // Compliance: training already expired
      supabase
        .from('agent_training_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .lt('expiry_date', today),

      // Incidents: total last 30 days
      supabase
        .from('incidents_log')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo),

      // Incidents: currently open
      supabase
        .from('incidents_log')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .gte('created_at', thirtyDaysAgo),

      // Incidents: resolved last 30 days
      supabase
        .from('incidents_log')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'resolved')
        .gte('created_at', thirtyDaysAgo),
    ]);

    // 3. Load payroll consolidated for the latest period
    let payroll: PayrollMetrics = {
      periodLabel: null,
      periodStatus: null,
      totalGross: 0,
      totalNet: 0,
      totalOvertimeHours: 0,
      agentCount: 0,
    };

    if (latestPeriodRes.data) {
      const period = latestPeriodRes.data;

      const { data: consolidated } = await supabase
        .from('payroll_agent_consolidated')
        .select('gross_salary, net_salary, overtime_hours_accumulated')
        .eq('payroll_period_id', period.id);

      const records = consolidated ?? [];

      payroll = {
        periodLabel: `${period.start_date} — ${period.end_date}`,
        periodStatus: period.status,
        totalGross: records.reduce((s, r) => s + Number(r.gross_salary), 0),
        totalNet: records.reduce((s, r) => s + Number(r.net_salary), 0),
        totalOvertimeHours: records.reduce((s, r) => s + Number(r.overtime_hours_accumulated), 0),
        agentCount: records.length,
      };
    }

    // 4. Build response
    const dashboard: ExecutiveDashboard = {
      payroll,
      compliance: {
        contractsPendingSeal: pendingSealRes.count ?? 0,
        trainingExpiringSoon: trainingExpiringRes.count ?? 0,
        trainingExpired: trainingExpiredRes.count ?? 0,
      },
      incidents: {
        last30DaysTotal: incidentsRes.count ?? 0,
        openIncidents: openIncidentsRes.count ?? 0,
        resolvedIncidents: resolvedIncidentsRes.count ?? 0,
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ data: dashboard });
  } catch (error) {
    return handleApiError(error);
  }
}
