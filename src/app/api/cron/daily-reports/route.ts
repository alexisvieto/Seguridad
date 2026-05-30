import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { generateDailyReportForProperty, buildReportHtml } from '@/lib/reports/daily-report';
import { sendEmail } from '@/lib/email/send-email';
import type { EmergencyContact } from '@/shared/types/database';

interface PropertyResult {
  property_id: string;
  property_name: string;
  emails_sent: number;
  incidents_marked: number;
  status: 'success' | 'skipped' | 'error';
  error?: string;
}

export async function GET(request: NextRequest) {
  // 1. Validate CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET not configured');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[CRON] Unauthorized cron attempt', {
      ip: request.headers.get('x-forwarded-for'),
      ua: request.headers.get('user-agent'),
    });
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authorization' } },
      { status: 401 },
    );
  }

  const startTime = Date.now();
  const results: PropertyResult[] = [];

  try {
    // 2. Use admin client to bypass RLS (cron has no user session)
    const supabase = await getSupabaseAdminClient();

    // 3. Find all properties that have pending incidents
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingStations, error: stationsError } = await supabase
      .from('incidents_log')
      .select('work_stations(property_id)')
      .eq('am_report_sent', false)
      .gte('created_at', twentyFourHoursAgo);

    if (stationsError) {
      console.error('[CRON] Error fetching pending incidents', stationsError);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Error fetching pending incidents' } },
        { status: 500 },
      );
    }

    // Extract unique property IDs
    const propertyIds = [
      ...new Set(
        pendingStations
          .map((row) => row.work_stations?.property_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];

    if (propertyIds.length === 0) {
      console.info('[CRON] No pending incidents found');
      return NextResponse.json({
        data: {
          message: 'No pending incidents',
          properties_processed: 0,
          duration_ms: Date.now() - startTime,
        },
      });
    }

    console.info(`[CRON] Processing ${propertyIds.length} properties with pending incidents`);

    // 4. Process each property independently
    for (const propertyId of propertyIds) {
      const result: PropertyResult = {
        property_id: propertyId,
        property_name: '',
        emails_sent: 0,
        incidents_marked: 0,
        status: 'skipped',
      };

      try {
        const reportData = await generateDailyReportForProperty(supabase, propertyId);

        if (!reportData) {
          result.status = 'skipped';
          results.push(result);
          continue;
        }

        result.property_name = reportData.property_name;

        // Collect recipient emails from emergency contacts
        const recipientEmails = reportData.contacts
          .filter((c: EmergencyContact) => c.email)
          .map((c: EmergencyContact) => c.email as string);

        if (recipientEmails.length === 0) {
          console.warn(
            `[CRON] Property "${reportData.property_name}" has no email contacts configured`,
          );
          result.status = 'skipped';
          result.error = 'No email contacts configured';
          results.push(result);
          continue;
        }

        // Build HTML
        const html = buildReportHtml(reportData);
        const subject = `Reporte de Seguridad — ${reportData.property_name} — ${reportData.report_date}`;

        // Send email
        await sendEmail({ to: recipientEmails, subject, html });
        result.emails_sent = recipientEmails.length;

        // Mark incidents as sent ONLY after successful email delivery
        const { error: updateError } = await supabase
          .from('incidents_log')
          .update({ am_report_sent: true })
          .in('id', reportData.incident_ids);

        if (updateError) {
          console.error(
            `[CRON] Email sent but failed to mark incidents for "${reportData.property_name}"`,
            updateError,
          );
          result.status = 'error';
          result.error = 'Email sent but failed to update incident flags';
        } else {
          result.incidents_marked = reportData.incident_ids.length;
          result.status = 'success';
        }

        console.info(
          `[CRON] ✓ ${reportData.property_name}: ${result.incidents_marked} incidents, ${result.emails_sent} emails`,
        );
      } catch (propertyError) {
        const message = propertyError instanceof Error
          ? propertyError.message
          : 'Unknown error';

        console.error(`[CRON] ✗ Property ${propertyId}: ${message}`);
        result.status = 'error';
        result.error = message;
      }

      results.push(result);
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const errorCount = results.filter((r) => r.status === 'error').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;

    console.info(
      `[CRON] Completed: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped (${Date.now() - startTime}ms)`,
    );

    return NextResponse.json({
      data: {
        properties_processed: propertyIds.length,
        success: successCount,
        errors: errorCount,
        skipped: skippedCount,
        duration_ms: Date.now() - startTime,
        results,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRON] Fatal error in daily reports', message);

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}
