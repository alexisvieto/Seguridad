#!/usr/bin/env npx tsx
/**
 * NexGuard360 — Demo Data Generator
 *
 * Populates Supabase with 15 tenants, 45 agents, 6 months of operations.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 *
 * Usage:
 *   npx tsx scripts/generate-demo-data.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TENANT_COUNT = 15;
const AGENTS_PER_TENANT = 3;
const STATIONS_PER_TENANT = 2;
const CHECKPOINTS_PER_STATION = 4;
const MONTHLY_SALARY = 1000.00;
const HOURLY_RATE = 4.17; // 1000 / 240
const ORDINARY_LIMIT = 96;
const SS_RATE = 0.0975;
const EI_RATE = 0.0125;
const IRREGULAR_RATE = 0.02;

const MONTHS = [
  { year: 2026, month: 0, label: 'Ene 2026' },
  { year: 2026, month: 1, label: 'Feb 2026' },
  { year: 2026, month: 2, label: 'Mar 2026' },
  { year: 2026, month: 3, label: 'Abr 2026' },
  { year: 2026, month: 4, label: 'May 2026' },
  { year: 2026, month: 5, label: 'Jun 2026' },
];

const TENANT_NAMES = [
  'Seguridad Alfa', 'Delta Custodia', 'Proteccion Centinela',
  'Guardian Prime', 'Escudo Nacional', 'Vigilancia Total',
  'Halcon Seguridad', 'Fortaleza Panama', 'Elite Security',
  'Omega Proteccion', 'Blindaje Corp', 'Sentinel Group',
  'Atlas Seguridad', 'Vanguardia Security', 'Nova Custodia',
];

const PROPERTY_NAMES = [
  ['Fabrica Galera Central', 'PH Altamira'],
  ['Centro Comercial Dorado', 'Residencial Costa del Este'],
  ['Edificio Torre Global', 'PH Punta Pacifica'],
  ['Bodega Industrial Norte', 'Condominio Vista Alegre'],
  ['Mall Multiplaza', 'PH Costa Verde'],
  ['Parque Industrial Sur', 'Torres del Pacifico'],
  ['Centro Empresarial Obarrio', 'PH Brisas del Golf'],
  ['Almacen Zona Libre', 'Residencial Clayton'],
  ['Edificio Financial Park', 'PH San Francisco'],
  ['Fabrica Textil Panama', 'Torres de Las Americas'],
  ['Centro Logistico Colon', 'PH El Cangrejo'],
  ['Bodega Tocumen', 'Residencial Albrook'],
  ['Plaza Concordia', 'PH Coco del Mar'],
  ['Parque Tech Panama', 'Torres Bella Vista'],
  ['Deposito Balboa', 'PH Dos Mares'],
];

const CHECKPOINT_NAMES = [
  'Garita Principal', 'Deposito Trasero', 'Estacionamiento Nivel B2', 'Azotea Torre A',
];

const FIRST_NAMES = [
  'Juan', 'Carlos', 'Miguel', 'Roberto', 'Pedro', 'Luis', 'Jorge', 'Fernando',
  'Ricardo', 'Alejandro', 'Daniel', 'Eduardo', 'Andres', 'Rafael', 'Gabriel',
  'Marco', 'Hector', 'Oscar', 'Raul', 'Diego', 'Ivan', 'Felix', 'Ernesto',
  'Arturo', 'Sergio', 'Manuel', 'Francisco', 'Alberto', 'Enrique', 'Ramon',
  'Victor', 'Pablo', 'Ruben', 'Julio', 'Gustavo', 'Alfredo', 'Cesar', 'Tomas',
  'Hugo', 'Ignacio', 'Nelson', 'Walter', 'Gilberto', 'Braulio', 'Edgardo',
];

const LAST_NAMES = [
  'Rodriguez', 'Martinez', 'Gonzalez', 'Lopez', 'Perez', 'Garcia', 'Hernandez',
  'Castillo', 'Morales', 'Jimenez', 'Ruiz', 'Diaz', 'Torres', 'Vargas', 'Romero',
  'Sanchez', 'Flores', 'Rivera', 'Gomez', 'Cruz', 'Mendoza', 'Herrera', 'Ramos',
  'Ortega', 'Nunez', 'Medina', 'Castro', 'Reyes', 'Gutierrez', 'Aguilar',
  'Delgado', 'Vega', 'Soto', 'Pineda', 'Espinosa', 'Cordoba', 'Avila', 'Salazar',
  'Pena', 'Rojas', 'Mejia', 'Barrera', 'Campos', 'Paredes', 'Zamora',
];

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function progress(current: number, total: number, label: string): void {
  const pct = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r  ${bar} ${pct}% ${label}`);
  if (current === total) process.stdout.write('\n');
}

const log = {
  header: (msg: string) => console.log(`\n\x1b[1m${msg}\x1b[0m`),
  success: (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`),
  info: (msg: string) => console.log(`  \x1b[36m→\x1b[0m ${msg}`),
  dim: (msg: string) => console.log(`  \x1b[90m${msg}\x1b[0m`),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function randomCedula(): string {
  const prov = Math.floor(Math.random() * 9) + 1;
  const vol = Math.floor(Math.random() * 900) + 100;
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${prov}-${vol}-${num}`;
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startTime = Date.now();
  log.header('NexGuard360 — Demo Data Generator');
  log.info(`Generating ${TENANT_COUNT} tenants, ${TENANT_COUNT * AGENTS_PER_TENANT} agents, 6 months of history`);

  // ================================================================
  // 1. TENANTS (trigger auto-seeds payroll_configs, courses, categories)
  // ================================================================

  log.header('Step 1: Creating tenants');

  const tenants: { id: string; slug: string; name: string }[] = [];

  for (let t = 0; t < TENANT_COUNT; t++) {
    const name = TENANT_NAMES[t]!;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { data, error } = await supabase
      .from('tenants')
      .insert({ name, slug, plan: t < 5 ? 'enterprise' : t < 10 ? 'pro' : 'free' })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabase.from('tenants').select('id').eq('slug', slug).single();
        if (existing) { tenants.push({ id: existing.id, slug, name }); continue; }
      }
      console.error(`\nFailed to create tenant ${name}:`, error.message);
      continue;
    }

    tenants.push({ id: data.id, slug, name });
    progress(t + 1, TENANT_COUNT, name);
  }

  log.success(`${tenants.length} tenants created`);

  // ================================================================
  // 2. PROPERTIES & WORK STATIONS
  // ================================================================

  log.header('Step 2: Creating properties & stations');

  const allStations: { id: string; tenantId: string; propertyId: string }[] = [];

  for (let t = 0; t < tenants.length; t++) {
    const tenant = tenants[t]!;
    const propNames = PROPERTY_NAMES[t % PROPERTY_NAMES.length]!;

    for (let p = 0; p < STATIONS_PER_TENANT; p++) {
      const { data: prop } = await supabase
        .from('properties_ph')
        .insert({
          tenant_id: tenant.id,
          name: propNames[p]!,
          address: `Calle ${Math.floor(Math.random() * 80) + 1}, Panama City`,
          contact_emergency: [{ name: 'Admin PH', phone: '6' + String(Math.floor(Math.random() * 9000000) + 1000000), role: 'Administrador' }],
        })
        .select('id')
        .single();

      if (!prop) continue;

      for (let c = 0; c < CHECKPOINTS_PER_STATION; c++) {
        const { data: station } = await supabase
          .from('work_stations')
          .insert({
            tenant_id: tenant.id,
            property_id: prop.id,
            name: `${CHECKPOINT_NAMES[c]!} - ${propNames[p]!.slice(0, 15)}`,
          })
          .select('id')
          .single();

        if (station) {
          allStations.push({ id: station.id, tenantId: tenant.id, propertyId: prop.id });
        }
      }
    }

    progress(t + 1, tenants.length, `${tenant.name}: ${STATIONS_PER_TENANT} props, ${STATIONS_PER_TENANT * CHECKPOINTS_PER_STATION} stations`);
  }

  log.success(`${allStations.length} work stations created`);

  // ================================================================
  // 3. AGENTS (Auth + Membership + HR + Contract)
  // ================================================================

  log.header('Step 3: Creating agents');

  interface AgentRecord {
    userId: string;
    tenantId: string;
    name: string;
  }

  const allAgents: AgentRecord[] = [];
  let nameIdx = 0;

  for (let t = 0; t < tenants.length; t++) {
    const tenant = tenants[t]!;

    for (let a = 0; a < AGENTS_PER_TENANT; a++) {
      const firstName = FIRST_NAMES[nameIdx % FIRST_NAMES.length]!;
      const lastName = LAST_NAMES[nameIdx % LAST_NAMES.length]!;
      const fullName = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${nameIdx}@demo.nexguard360.com`;
      nameIdx++;

      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: 'Demo2026!Pass',
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authErr || !authData.user) continue;
      const userId = authData.user.id;

      await supabase.from('memberships').insert({
        tenant_id: tenant.id, user_id: userId, role: a === 0 ? 'admin' : 'editor',
      });

      await supabase.from('hr_agent_profiles').insert({
        tenant_id: tenant.id, user_id: userId, cedula: randomCedula(),
        hire_date: '2025-06-01',
      });

      await supabase.from('hr_contracts').insert({
        tenant_id: tenant.id, user_id: userId, contract_type: 'indefinido',
        start_date: '2025-06-01', base_salary: MONTHLY_SALARY,
      });

      allAgents.push({ userId, tenantId: tenant.id, name: fullName });
    }

    progress(t + 1, tenants.length, `${tenant.name}: ${AGENTS_PER_TENANT} agents`);
  }

  log.success(`${allAgents.length} agents created`);

  // ================================================================
  // 4. SHIFT HISTORY (6 months of 12h shifts)
  // ================================================================

  log.header('Step 4: Generating shift history (6 months)');

  const shiftBatches: {
    tenant_id: string;
    user_id: string;
    work_station_id: string;
    clock_in: string;
    clock_out: string;
    clock_in_gps: { lat: number; lng: number };
    clock_out_gps: { lat: number; lng: number };
  }[] = [];

  const incidentBatches: {
    tenant_id: string;
    work_station_id: string;
    user_id: string;
    raw_text: string;
    ai_refined_text: string;
    status: string;
  }[] = [];

  const INCIDENT_TEXTS = [
    'Vehiculo sospechoso merodeando el perimetro este',
    'Puerta de emergencia bloque B encontrada abierta',
    'Residente reporta ruidos extraños en piso 12',
    'Falla en camara CCTV sector norte',
    'Visitante sin identificacion intento ingresar',
    'Corto circuito en iluminacion del estacionamiento',
    'Persona en estado de ebriedad en el lobby',
    'Entrega de paquete sospechoso en recepcion',
  ];

  for (const month of MONTHS) {
    const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();

    for (const agent of allAgents) {
      const tenantStations = allStations.filter((s) => s.tenantId === agent.tenantId);
      if (tenantStations.length === 0) continue;

      for (let day = 1; day <= daysInMonth; day++) {
        if (Math.random() > 0.85) continue; // 15% days off

        const station = tenantStations[day % tenantStations.length]!;
        const isNight = day % 2 === 0;
        const startHour = isNight ? 18 : 6;
        const dateBase = dateStr(month.year, month.month, day);

        const clockIn = `${dateBase}T${String(startHour).padStart(2, '0')}:00:00.000Z`;
        const clockOutHour = startHour + 12;
        const clockOutDay = clockOutHour >= 24 ? day + 1 : day;
        const clockOutH = clockOutHour % 24;

        if (clockOutDay > daysInMonth) continue;

        const clockOutDate = dateStr(month.year, month.month, clockOutDay);
        const clockOut = `${clockOutDate}T${String(clockOutH).padStart(2, '0')}:00:00.000Z`;

        const lat = 8.9 + Math.random() * 0.2;
        const lng = -79.5 + Math.random() * 0.1;

        shiftBatches.push({
          tenant_id: agent.tenantId,
          user_id: agent.userId,
          work_station_id: station.id,
          clock_in: clockIn,
          clock_out: clockOut,
          clock_in_gps: { lat: r2(lat), lng: r2(lng) },
          clock_out_gps: { lat: r2(lat + 0.001), lng: r2(lng + 0.001) },
        });

        // 2% irregular incidents
        if (Math.random() < IRREGULAR_RATE) {
          incidentBatches.push({
            tenant_id: agent.tenantId,
            work_station_id: station.id,
            user_id: agent.userId,
            raw_text: INCIDENT_TEXTS[Math.floor(Math.random() * INCIDENT_TEXTS.length)]!,
            ai_refined_text: 'Se registró una novedad operativa durante el turno. El agente procedió según protocolo establecido.',
            status: Math.random() > 0.3 ? 'resolved' : 'open',
          });
        }
      }
    }

    log.info(`${month.label}: ${shiftBatches.length} shifts queued`);
  }

  // Insert shifts in batches of 500
  log.header('Step 5: Inserting shifts');
  const BATCH_SIZE = 500;
  for (let i = 0; i < shiftBatches.length; i += BATCH_SIZE) {
    const batch = shiftBatches.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('agent_shifts').insert(batch);
    if (error) console.error(`\nShift batch error at ${i}:`, error.message);
    progress(Math.min(i + BATCH_SIZE, shiftBatches.length), shiftBatches.length, `${shiftBatches.length} shifts`);
  }

  log.success(`${shiftBatches.length} shifts inserted`);

  // Insert incidents
  if (incidentBatches.length > 0) {
    for (let i = 0; i < incidentBatches.length; i += BATCH_SIZE) {
      const batch = incidentBatches.slice(i, i + BATCH_SIZE);
      await supabase.from('incidents_log').insert(batch);
    }
    log.success(`${incidentBatches.length} incidents inserted`);
  }

  // ================================================================
  // 6. PAYROLL HISTORY (12 biweekly periods per tenant)
  // ================================================================

  log.header('Step 6: Generating payroll history');

  let payrollCount = 0;

  for (let t = 0; t < tenants.length; t++) {
    const tenant = tenants[t]!;
    const tenantAgents = allAgents.filter((a) => a.tenantId === tenant.id);

    for (const month of MONTHS) {
      const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();

      // Two biweekly periods per month
      const periods = [
        { start: dateStr(month.year, month.month, 1), end: dateStr(month.year, month.month, 15) },
        { start: dateStr(month.year, month.month, 16), end: dateStr(month.year, month.month, daysInMonth) },
      ];

      for (const period of periods) {
        const { data: periodData } = await supabase
          .from('payroll_periods')
          .insert({ tenant_id: tenant.id, start_date: period.start, end_date: period.end, status: 'cerrado_pagado' })
          .select('id')
          .single();

        if (!periodData) continue;

        const consolidated = tenantAgents.map((agent) => {
          const baseHours = 96 + Math.floor(Math.random() * 48);
          const regularHours = Math.min(baseHours, ORDINARY_LIMIT);
          const overtimeHours = r2(Math.max(0, baseHours - ORDINARY_LIMIT));

          const gross = r2((regularHours + overtimeHours) * HOURLY_RATE);
          const ss = r2(gross * SS_RATE);
          const ei = r2(gross * EI_RATE);
          const net = r2(gross - ss - ei);

          return {
            tenant_id: tenant.id,
            payroll_period_id: periodData.id,
            user_id: agent.userId,
            rate_per_hour: HOURLY_RATE,
            regular_hours_accumulated: regularHours,
            overtime_hours_accumulated: overtimeHours,
            holiday_hours_accumulated: 0,
            adjustments_addition: 0,
            adjustments_deduction: 0,
            gross_salary: gross,
            social_security_deduction: ss,
            educational_insurance_deduction: ei,
            net_salary: net,
          };
        });

        const { error } = await supabase.from('payroll_agent_consolidated').insert(consolidated);
        if (error) console.error(`\nPayroll error:`, error.message);

        payrollCount += consolidated.length;
      }
    }

    progress(t + 1, tenants.length, `${tenant.name}: 12 periods`);
  }

  log.success(`${payrollCount} payroll records inserted`);

  // ================================================================
  // Summary
  // ================================================================

  const duration = Math.round((Date.now() - startTime) / 1000);

  log.header('Generation complete');
  log.dim(`  Tenants:           ${tenants.length}`);
  log.dim(`  Properties:        ${tenants.length * STATIONS_PER_TENANT}`);
  log.dim(`  Work stations:     ${allStations.length}`);
  log.dim(`  Agents:            ${allAgents.length}`);
  log.dim(`  Shifts:            ${shiftBatches.length}`);
  log.dim(`  Incidents:         ${incidentBatches.length}`);
  log.dim(`  Payroll records:   ${payrollCount}`);
  log.dim(`  Payroll periods:   ${tenants.length * 12}`);
  log.dim(`  Duration:          ${duration}s`);
  log.dim('');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n\x1b[31mFatal:\x1b[0m ${msg}`);
  process.exit(1);
});
