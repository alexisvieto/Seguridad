import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await getSupabaseAdminClient();
  const now = new Date();
  const hour = now.getUTCHours();
  const today = now.toISOString().split('T')[0]!;

  // Determine which shift just started (with 5 min buffer)
  // 6:05 UTC → check diurno (06:00-18:00)
  // 18:05 UTC → check nocturno (18:00-06:00)
  let shiftType: 'diurno' | 'nocturno';
  let shiftStart: string;

  if (hour >= 5 && hour < 12) {
    shiftType = 'diurno';
    shiftStart = `${today}T06:00:00Z`;
  } else if (hour >= 17) {
    shiftType = 'nocturno';
    shiftStart = `${today}T18:00:00Z`;
  } else {
    return NextResponse.json({ message: 'Not a shift change window', alerts_created: 0 });
  }

  const shiftEnd = new Date(new Date(shiftStart).getTime() + 30 * 60000).toISOString();

  // Get all tenants
  const { data: tenants } = await admin.from('tenants').select('id');

  let totalAlerts = 0;

  for (const tenant of tenants ?? []) {
    // Get programmed assignments for this shift
    const { data: assignments } = await admin
      .from('shift_assignments')
      .select('user_id, work_station_id')
      .eq('tenant_id', tenant.id)
      .lte('start_date', today)
      .or(`end_date.gte.${today},end_date.is.null`);

    if (!assignments || assignments.length === 0) continue;

    // Filter by time overlap
    const relevantAssignments = assignments; // simplified — all assignments for the day

    // Get actual clock-ins in the first 30 min window
    const { data: clockIns } = await admin
      .from('agent_shifts')
      .select('work_station_id')
      .eq('tenant_id', tenant.id)
      .gte('clock_in', shiftStart)
      .lte('clock_in', shiftEnd);

    const coveredStations = new Set((clockIns ?? []).map((c) => c.work_station_id));

    // Also check if someone is still on post from previous shift (no clock_out)
    const { data: holdovers } = await admin
      .from('agent_shifts')
      .select('work_station_id')
      .eq('tenant_id', tenant.id)
      .lt('clock_in', shiftStart)
      .is('clock_out', null);

    for (const h of holdovers ?? []) {
      coveredStations.add(h.work_station_id);
    }

    // Find no-shows: programmed but no clock-in
    for (const a of relevantAssignments) {
      if (coveredStations.has(a.work_station_id)) continue;

      // Create persistent alert
      const { error } = await admin
        .from('shift_alerts')
        .upsert({
          tenant_id: tenant.id,
          work_station_id: a.work_station_id,
          programmed_agent_id: a.user_id,
          shift_type: shiftType,
          alert_date: today,
          status: 'active',
        }, { onConflict: 'tenant_id,work_station_id,alert_date,shift_type' });

      if (!error) totalAlerts++;
    }
  }

  return NextResponse.json({
    message: `Shift alert check complete`,
    shift_type: shiftType,
    date: today,
    alerts_created: totalAlerts,
  });
}
