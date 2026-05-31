# NexGuard360 — CLAUDE.md

## Qué es este proyecto

ERP multi-tenant SaaS para empresas de seguridad privada en Panamá y LATAM. Gestiona el ciclo completo: gestión comercial de clientes, operaciones de campo, RRHH, armamento, flota vehicular con GPS, inventario, capacitaciones, atención al cliente, nómina quincenal y analítica con IA. Aislamiento total de datos por tenant.

## Stack tecnológico

- **Framework:** Next.js 15 (App Router), TypeScript strict (zero `any`)
- **Base de datos:** Supabase (PostgreSQL 17) con Row Level Security en todas las tablas
- **Auth:** Supabase Auth con JWT refresh en Server Components
- **AI:** Anthropic SDK (Claude Sonnet) para refinamiento de bitácoras + motor de analítica
- **Email:** Resend para reportes diarios automatizados
- **Mapas:** Leaflet + react-leaflet para rastreo vehicular
- **Gráficos:** Recharts para dashboards ejecutivos
- **Validación:** Zod v4 en todos los inputs
- **Estilos:** Tailwind CSS, tema dark OLED para dashboards
- **Storage:** Supabase Storage (bucket privado `hr-documents`) con compresión client-side
- **Middleware:** Edge-compatible (zero deps, puro URL parsing)

## Arquitectura

### Multi-tenancy
- Aislamiento por `tenant_id` en todas las tablas operativas (36 tablas)
- RLS con funciones helper `get_user_tenant_ids()` y `get_user_role_in_tenant()`
- Subdominios dinámicos en producción: `tenant.nexguard360.com` → rewrite a `/[tenant]/...`
- Ruta directa en desarrollo: `localhost:3000/{tenant}/...`
- Roles: `owner`, `admin`, `editor`, `viewer`

### Estructura de código
```
src/
├── app/
│   ├── page.tsx              # Landing page pública NexGuard360
│   ├── login/                # Login centralizado con routing por rol
│   ├── [tenant]/
│   │   ├── sidebar.tsx       # Navegación lateral con 12 módulos
│   │   ├── layout.tsx        # Validación de tenant + auth + role
│   │   ├── puesto/           # UI del agente (mobile-first, consignas, voz)
│   │   ├── cliente/          # Portal del cliente contratante (PQR, daños)
│   │   └── dashboard/
│   │       ├── page.tsx           # Dashboard Gerencial + IA Analytics
│   │       ├── executive/         # Centro de Comando (Recharts)
│   │       ├── live-monitor/      # NOC Monitor (WebSockets)
│   │       ├── comercial/         # Clientes, contratos, consignas
│   │       ├── armamento/         # Control de armas (master-detail)
│   │       ├── inventario/        # Stock, activos, entregas con firma
│   │       ├── flota/             # Rastreo GPS + Leaflet + mantenimiento
│   │       ├── rrhh/              # Expedientes (5 tabs + file upload)
│   │       ├── capacitaciones/    # Matriz de competencias
│   │       └── nomina/            # Periodos + sábana de pagos inline
│   └── api/
│       ├── shift/clock-in/        # QR + GPS + membership validation
│       ├── incidents/report/      # AI text refinement
│       ├── fleet/telemetry/       # GPS webhook (timing-safe auth)
│       ├── cron/daily-reports/    # Reporte 8AM con Resend
│       ├── payroll/calculate/     # Motor de liquidación quincenal
│       ├── dashboard/executive/   # Agregación paralela (7 queries)
│       └── analytics/chat/        # IA conversacional + keyword fallback
├── modules/                  # 15 módulos de negocio
├── lib/
│   ├── supabase/             # Clientes (browser, server, admin)
│   ├── payroll/              # Engine + ACH generator
│   ├── upload/               # Compresión de imágenes + FileUpload component
│   ├── ai/                   # Claude con timeout + fallback
│   ├── storage/              # Signed URLs
│   ├── errors/               # AppError centralizado
│   └── reports/              # HTML email generator
├── shared/types/database.ts  # ~1600 líneas de tipos manuales
└── scripts/
    ├── admin-cli.ts          # CLI para crear tenants/usuarios
    └── generate-demo-data.ts # Generador de data masiva
```

### Módulos de negocio (15)
tenant, auth, documents, properties, shifts, incidents, firearms, inventory, fleet, hr, training, client-service, payroll, commercial (+ analytics engine)

### Migraciones SQL (20)
`supabase/migrations/` — 00001 a 00019 + audit fixes. Nunca crear tablas desde el dashboard.

## Fases completadas

### Fase 1 — Operaciones Core
- Tenants, memberships, profiles con auto-seed via trigger
- Properties, work stations con QR tokens
- Agent shifts con clock-in/out (QR + GPS + membership validation)
- Incidents log con AI text refinement (Claude Sonnet)
- Daily report cron (7:45 AM → HTML email via Resend)
- Middleware edge-compatible para subdominios

### Fase 2 — Recursos Críticos
- Firearms inventory con permisos DIASP y semáforo de vencimientos
- Agent compliance (tiro, psicología, dopaje)
- Firearms assignments con partial unique index
- Inventory items con stock atómico (decrement/increment SQL functions)
- Station asset custody con reporte de daños
- Agent equipment loans con firma digital (canvas)
- Fleet vehicles con GPS device binding
- Vehicle GPS logs (BIGINT, alta frecuencia)
- Geofence violations (velocidad, zona, parada)
- Telemetry webhook con timing-safe auth

### Fase 3 — RRHH y Compliance Legal
- HR agent profiles (cédula, CSS, seguro, carnet DIASP, datos bancarios)
- HR contracts (definido/indefinido, MITRADEL seal, pendiente_sello default)
- HR disciplinary records (evidencia fotográfica, validez legal)
- HR employee vault (bóveda documental indexada)
- HR agent requests (portal autoservicio del agente)
- HR medical leaves (incapacidades con certificado)
- Training courses + agent training logs (auto-expiry)
- Station required trainings (motor de idoneidad)
- Client tickets (PQR system)
- Client damage reports (costo, evidencia, responsable)
- Storage bucket privado hr-documents con RLS
- File upload con compresión client-side (Canvas API, 75% quality, max 1200px)

### Fase 4 — Nómina Quincenal
- Payroll configs per tenant (96h cap, flat OT, CSS 9.75%, SE 1.25%)
- Payroll periods (abierto → calculado → cerrado_pagado)
- Payroll agent consolidated (espejo del Excel MICRO)
- Motor de liquidación: shifts → hours → distribute → calculate → upsert
- Retenciones CSS/SE calculadas sobre bruto ANTES de deducciones (fix auditoría)
- ACH generator (formato bancario Panamá, sanitización de texto)
- Sábana de pagos con inline editing + debounce save
- Auto-init payroll configs via trigger on tenant creation

### Fase 5 — Dashboard Ejecutivo + Analytics
- Executive dashboard API (7 queries paralelas)
- Executive dashboard UI (Recharts bar chart, KPIs, alertas)
- Dashboard Gerencial con date range picker
- Rankings: asistencia perfecta, puntualidad, preservación de flota
- Motor de analítica IA (40+ intents, 8 categorías)
- Keyword classifier local (funciona sin API key)
- Upgrade opcional con Claude cuando ANTHROPIC_API_KEY disponible
- Preguntas respondidas con datos reales: Bradford, CPK, overtime por propiedad/agente
- Station consignas (tareas por puesto, descargadas al clock-in)
- Commercial clients + contracts + contract_properties
- Cadena completa: Cliente → Contrato → Propiedad → Puestos → Consignas → Agente

### Auditorías (2 completadas)
- Auditoría 1: Race conditions (partial unique indexes), RLS gaps, middleware edge
- Auditoría 2: Payroll math (CSS/SE base), stale closures, timing-safe auth, RLS tightening

## Metodología de desarrollo

### Fases con auditoría
Construcción en fases secuenciales. Al cerrar cada fase se ejecuta auditoría con dos agentes (Software Architect + Code Reviewer). Hallazgos se corrigen antes de avanzar.

### Convenciones de código
- Race conditions: partial unique indexes + manejo de 23505
- Stock: funciones SQL atómicas (`decrement_stock`/`increment_stock`)
- Services: reciben `SupabaseClient` inyectado
- Queries: `.maybeSingle()` en vez de `.single()`
- Schemas Zod: alineados con CHECK constraints SQL
- API routes: validan membership del tenant explícitamente
- Inputs numéricos: strings en estado, parseo al submit (evita leading zeros)
- Las agencias custodian todo tipo de negocios (no solo PHs o galeras)

## Modelo de nómina — IMPORTANTE

### Calco del negocio real (Panamá)
Suma marcas QR/GPS, topa 96h ordinarias, excedente a extras planas, retenciones CSS 9.75% + SE 1.25% sobre bruto antes de deducciones. Centavo a centavo con el Excel.

### Escalabilidad SaaS
`overtime_flat_rate = FALSE` → activa recargo 25% legal. `pays_holiday_premium = TRUE` → 1.50x en feriados. Cada tenant configurable sin tocar código.

## Comandos

```bash
npm run dev                    # Dev server
npm run build                  # Build producción
npx tsc --noEmit               # Type-check
npm run admin-cli help         # CLI de administración
npm run admin-cli create-tenant --name="X" --slug="x"
npm run admin-cli create-user --email="x" --password="x" --name="x" --tenant="x" --role="admin"
npx tsx scripts/generate-demo-data.ts  # Data demo masiva
```

## Variables de entorno

Ver `.env.local.example`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `NEXT_PUBLIC_ROOT_DOMAIN`
- `ANTHROPIC_API_KEY` (opcional — analytics funciona sin ella)
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `GPS_PROVIDER_SECRET`

## Estado actual

```
Tablas Supabase:    36 (todas con RLS)
Migraciones:        20
Módulos:            15
Páginas frontend:   13
API Routes:          8
Scripts:             3
Auditorías:          2
TS errors:           0
Brand:               NexGuard360
```
