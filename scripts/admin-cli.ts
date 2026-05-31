#!/usr/bin/env npx tsx
/**
 * NexGuard360 — Admin CLI
 *
 * Production administration tool for tenant and user management.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 *
 * Commands:
 *   npx tsx scripts/admin-cli.ts create-tenant --name="Agencia Alfa" --slug="alfa"
 *   npx tsx scripts/admin-cli.ts create-tenant --name="Agencia Alfa" --slug="alfa" --plan="enterprise"
 *
 *   npx tsx scripts/admin-cli.ts create-user --email="admin@alfa.com" --password="Pass123!" \
 *     --name="Raul Romero" --cedula="8-888-888" --tenant="alfa" --role="admin"
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedArgs {
  command: string;
  flags: Map<string, string>;
}

type ValidRole = 'owner' | 'admin' | 'editor' | 'viewer';

const VALID_ROLES = new Set<ValidRole>(['owner', 'admin', 'editor', 'viewer']);
const VALID_PLANS = new Set(['free', 'pro', 'enterprise']);
const DEFAULT_RATE_PER_HOUR = 3.04;
const DEFAULT_MONTHLY_SALARY = 729.60; // 3.04 * 240

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const log = {
  info: (msg: string) => console.log(`  \x1b[36m→\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`),
  error: (msg: string) => console.error(`  \x1b[31m✗\x1b[0m ${msg}`),
  header: (msg: string) => console.log(`\n\x1b[1m${msg}\x1b[0m`),
  dim: (msg: string) => console.log(`  \x1b[90m${msg}\x1b[0m`),
};

// ---------------------------------------------------------------------------
// Arg parser
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] ?? '';
  const flags = new Map<string, string>();

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    const match = arg.match(/^--([a-z_-]+)=(.+)$/);
    if (match?.[1] && match[2]) {
      flags.set(match[1], match[2]);
    }
  }

  return { command, flags };
}

function requireFlag(flags: Map<string, string>, name: string): string {
  const value = flags.get(name);
  if (!value) {
    log.error(`Missing required flag: --${name}`);
    process.exit(1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    log.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Command: create-tenant
// ---------------------------------------------------------------------------

async function createTenant(flags: Map<string, string>): Promise<void> {
  const name = requireFlag(flags, 'name');
  const slug = requireFlag(flags, 'slug');
  const plan = flags.get('plan') ?? 'free';

  if (!VALID_PLANS.has(plan)) {
    log.error(`Invalid plan: "${plan}". Valid: free, pro, enterprise`);
    process.exit(1);
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.length < 3) {
    log.error(`Invalid slug: "${slug}". Use lowercase letters, numbers, hyphens. Min 3 chars.`);
    process.exit(1);
  }

  log.header(`Creating tenant: ${name}`);
  const supabase = getAdminClient();

  // Check if slug already exists
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    log.error(`Slug "${slug}" already exists (tenant ${existing.id})`);
    process.exit(1);
  }

  // Insert tenant (trigger auto-seeds payroll_configs, training_courses, incident_categories)
  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({ name, slug, plan })
    .select()
    .single();

  if (error || !tenant) {
    log.error(`Failed to create tenant: ${error?.message ?? 'Unknown error'}`);
    process.exit(1);
  }

  log.success(`Tenant created: ${tenant.id}`);
  log.dim(`Name: ${name}`);
  log.dim(`Slug: ${slug}`);
  log.dim(`Plan: ${plan}`);

  // Verify auto-seeded data
  const [configRes, coursesRes, categoriesRes] = await Promise.all([
    supabase.from('payroll_configs').select('id').eq('tenant_id', tenant.id),
    supabase.from('training_courses').select('id').eq('tenant_id', tenant.id),
    supabase.from('incident_categories').select('id').eq('tenant_id', tenant.id),
  ]);

  log.info('Auto-seeded by trigger:');
  log.dim(`  Payroll config: ${configRes.data?.length ?? 0} (96h cap, SS 9.75%, SE 1.25%)`);
  log.dim(`  Training courses: ${coursesRes.data?.length ?? 0} (DIASP, PH Protocol, First Aid)`);
  log.dim(`  Incident categories: ${categoriesRes.data?.length ?? 0}`);

  log.header('Done');
  log.dim(`URL: http://${slug}.localhost:3000/dashboard/live-monitor`);
}

// ---------------------------------------------------------------------------
// Command: create-user
// ---------------------------------------------------------------------------

async function createUser(flags: Map<string, string>): Promise<void> {
  const email = requireFlag(flags, 'email');
  const password = requireFlag(flags, 'password');
  const fullName = requireFlag(flags, 'name');
  const tenantSlug = requireFlag(flags, 'tenant');
  const roleStr = requireFlag(flags, 'role');
  const cedula = flags.get('cedula') ?? null;

  if (!VALID_ROLES.has(roleStr as ValidRole)) {
    log.error(`Invalid role: "${roleStr}". Valid: owner, admin, editor, viewer`);
    process.exit(1);
  }

  const role = roleStr as ValidRole;

  if (password.length < 8) {
    log.error('Password must be at least 8 characters');
    process.exit(1);
  }

  log.header(`Creating user: ${fullName} (${email})`);
  const supabase = getAdminClient();

  // 1. Find tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (!tenant) {
    log.error(`Tenant "${tenantSlug}" not found`);
    process.exit(1);
  }

  log.info(`Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      tenant_id: tenant.id,
      role,
    },
  });

  if (authError || !authData.user) {
    log.error(`Auth error: ${authError?.message ?? 'Unknown error'}`);
    process.exit(1);
  }

  const userId = authData.user.id;
  log.success(`Auth user created: ${userId}`);

  // 3. Create membership
  const { error: memberError } = await supabase.from('memberships').insert({
    tenant_id: tenant.id,
    user_id: userId,
    role,
  });

  if (memberError) {
    log.error(`Membership error: ${memberError.message}`);
    process.exit(1);
  }

  log.success(`Membership created: ${role}`);

  // 4. Create HR profile with banking placeholder
  const { error: hrError } = await supabase.from('hr_agent_profiles').insert({
    tenant_id: tenant.id,
    user_id: userId,
    cedula,
    hire_date: new Date().toISOString().split('T')[0],
  });

  if (hrError) {
    log.error(`HR profile error: ${hrError.message}`);
    process.exit(1);
  }

  log.success('HR profile created');

  // 5. Create active contract
  const today = new Date().toISOString().split('T')[0]!;

  const { error: contractError } = await supabase.from('hr_contracts').insert({
    tenant_id: tenant.id,
    user_id: userId,
    contract_type: 'indefinido',
    start_date: today,
    base_salary: DEFAULT_MONTHLY_SALARY,
  });

  if (contractError) {
    log.error(`Contract error: ${contractError.message}`);
    process.exit(1);
  }

  log.success(`Contract created: indefinido, B/.${DEFAULT_MONTHLY_SALARY}/month (B/.${DEFAULT_RATE_PER_HOUR}/h)`);

  // Summary
  log.header('User created successfully');
  log.dim(`  Email: ${email}`);
  log.dim(`  Name: ${fullName}`);
  log.dim(`  Cedula: ${cedula ?? '(not set)'}`);
  log.dim(`  Role: ${role}`);
  log.dim(`  Tenant: ${tenant.name} (${tenantSlug})`);
  log.dim(`  User ID: ${userId}`);
  log.dim(`  Rate: B/.${DEFAULT_RATE_PER_HOUR}/h`);

  if (role === 'owner' || role === 'admin') {
    log.dim(`  Login URL: http://${tenantSlug}.localhost:3000/login`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  switch (command) {
    case 'create-tenant':
      await createTenant(flags);
      break;

    case 'create-user':
      await createUser(flags);
      break;

    case '':
    case 'help':
      log.header('NexGuard360 Admin CLI');
      console.log(`
  Usage:
    npx tsx scripts/admin-cli.ts <command> [flags]

  Commands:
    create-tenant   Create a new security company
    create-user     Create a user and link to a tenant

  create-tenant flags:
    --name="Company Name"     Required. Display name
    --slug="company-slug"     Required. URL subdomain (lowercase, hyphens)
    --plan="pro"              Optional. free | pro | enterprise (default: free)

  create-user flags:
    --email="user@co.com"     Required. Login email
    --password="Pass123!"     Required. Min 8 chars
    --name="Full Name"        Required. Display name
    --tenant="slug"           Required. Tenant slug to link
    --role="admin"            Required. owner | admin | editor | viewer
    --cedula="8-888-888"      Optional. National ID

  Environment:
    NEXT_PUBLIC_SUPABASE_URL      Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY     Service role key (bypasses RLS)
`);
      break;

    default:
      log.error(`Unknown command: "${command}". Run without args for help.`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error(`Fatal: ${message}`);
  process.exit(1);
});
