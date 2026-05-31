/**
 * NexGuard360 — Tenant Seed Script
 *
 * Creates a new tenant with all default configurations.
 * The DB trigger `handle_new_tenant_seed` auto-populates:
 *   - payroll_configs (Panama flat-rate defaults)
 *   - training_courses (3 mandatory certifications)
 *   - incident_categories (8 field categories)
 *
 * This script additionally creates:
 *   - The owner user (via Supabase Auth)
 *   - The owner membership
 *   - The user profile
 *
 * Usage:
 *   npx tsx scripts/seed-tenant.ts
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config — edit these for each new tenant
// ---------------------------------------------------------------------------

const TENANT_CONFIG = {
  name: 'Alfa Seguridad S.A.',
  slug: 'alfa-seguridad',
  plan: 'pro' as const,
};

const OWNER_CONFIG = {
  email: 'admin@alfaseguridad.com',
  password: 'SecureP@ssw0rd2026!',
  fullName: 'Carlos Mendoza',
};

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n[Seed] Creating tenant: ${TENANT_CONFIG.name} (${TENANT_CONFIG.slug})`);

  // 1. Create tenant (trigger auto-seeds payroll_configs, training_courses, incident_categories)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: TENANT_CONFIG.name,
      slug: TENANT_CONFIG.slug,
      plan: TENANT_CONFIG.plan,
    })
    .select()
    .single();

  if (tenantError) {
    console.error('[Seed] Failed to create tenant:', tenantError.message);
    process.exit(1);
  }

  console.log(`[Seed] Tenant created: ${tenant.id}`);

  // 2. Create owner user via Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: OWNER_CONFIG.email,
    password: OWNER_CONFIG.password,
    email_confirm: true,
    user_metadata: { full_name: OWNER_CONFIG.fullName },
  });

  if (authError || !authData.user) {
    console.error('[Seed] Failed to create user:', authError?.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`[Seed] User created: ${userId} (${OWNER_CONFIG.email})`);

  // 3. Create owner membership
  const { error: memberError } = await supabase.from('memberships').insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: 'owner',
  });

  if (memberError) {
    console.error('[Seed] Failed to create membership:', memberError.message);
    process.exit(1);
  }

  console.log('[Seed] Owner membership created');

  // 4. Verify auto-seeded data
  const [configRes, coursesRes, categoriesRes] = await Promise.all([
    supabase.from('payroll_configs').select('id').eq('tenant_id', tenant.id),
    supabase.from('training_courses').select('id').eq('tenant_id', tenant.id),
    supabase.from('incident_categories').select('id').eq('tenant_id', tenant.id),
  ]);

  console.log('\n[Seed] Auto-seeded by trigger:');
  console.log(`  Payroll configs: ${configRes.data?.length ?? 0}`);
  console.log(`  Training courses: ${coursesRes.data?.length ?? 0}`);
  console.log(`  Incident categories: ${categoriesRes.data?.length ?? 0}`);

  console.log('\n[Seed] Complete!');
  console.log(`  Tenant: ${TENANT_CONFIG.name}`);
  console.log(`  Slug: ${TENANT_CONFIG.slug}`);
  console.log(`  Owner: ${OWNER_CONFIG.email}`);
  console.log(`  URL: http://${TENANT_CONFIG.slug}.localhost:3000/dashboard/live-monitor`);
  console.log('');
}

main().catch((err) => {
  console.error('[Seed] Unexpected error:', err);
  process.exit(1);
});
