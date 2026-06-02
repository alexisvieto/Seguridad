# NexGuard360 — CLAUDE.md

## Qué es este proyecto

ERP multi-tenant SaaS para empresas de seguridad privada en Panamá y LATAM. Gestiona el ciclo completo: gestión comercial de clientes, operaciones de campo, RRHH, armamento con ubicaciones y custodia, flota vehicular con GPS, inventario con entregas firmadas, capacitaciones, centro de comando con trazabilidad, nómina quincenal y analítica con IA. Aislamiento total de datos por tenant.

## Stack tecnológico

- **Framework:** Next.js 16 (App Router), TypeScript strict (zero `any`)
- **Base de datos:** Supabase (PostgreSQL 17) con Row Level Security en todas las tablas
- **Auth:** Supabase Auth con JWT refresh en Server Components
- **AI:** Anthropic SDK (Claude Sonnet) para refinamiento de bitácoras + motor de analítica
- **Email:** Resend para reportes diarios automatizados
- **Mapas:** Leaflet + react-leaflet para rastreo vehicular
- **Gráficos:** Recharts para dashboards
- **Validación:** Zod v4 en todos los inputs
- **Estilos:** Tailwind CSS v4, tema dark OLED (lime tactical #84CC16)
- **Animaciones:** Framer Motion (sitio público)
- **Iconos:** Lucide React (sitio público) + SVG inline (dashboard)
- **QR:** qrcode.react para códigos QR de puestos
- **Storage:** Supabase Storage (bucket privado `hr-documents`) con compresión client-side
- **Middleware:** Edge-compatible (zero deps, puro URL parsing)
- **Deploy:** Vercel (www.nexguard360.com) + Namecheap DNS

## Arquitectura

### Multi-tenancy
- Aislamiento por `tenant_id` en todas las tablas operativas (42+ tablas)
- RLS con funciones helper `get_user_tenant_ids()` y `get_user_role_in_tenant()`
- Path-based routing en producción: `nexguard360.com/{tenant}/dashboard`
- Ruta directa en desarrollo: `localhost:3000/{tenant}/...`
- Roles: `owner` (gerente), `admin` (operador), `editor` (agente), `viewer` (auditor/cliente)

### Roles y permisos
| Módulo | owner | admin | editor | viewer |
|--------|:-----:|:-----:|:------:|:------:|
| Clientes y Contratos | ✓ | — | — | — |
| Gerencial + IA | ✓ | ✓ | — | — |
| NOC Monitor | ✓ | ✓ | — | — |
| Centro de Comando | ✓ | ✓ | — | — |
| Cambio de Turno | ✓ | ✓ | — | — |
| Turnos | ✓ | ✓ | — | — |
| Consignas | ✓ | ✓ | — | — |
| Mi Puesto | ✓ | ✓ | ✓ | — |
| Armamento | ✓ | ✓ | — | — |
| Inventario | ✓ | ✓ | — | — |
| Flota | ✓ | ✓ | — | — |
| RRHH | ✓ | ✓ | — | — |
| Capacitaciones | ✓ | ✓ | — | — |
| Nómina | ✓ | — | — | — |
| Portal Cliente | — | — | — | ✓ |

### Estructura de código
```
src/
├── app/
│   ├── page.tsx              # Landing page pública (lime tactical)
│   ├── precios/              # 7 bandas de pricing
│   ├── producto/             # 14 módulos con screenshots + lightbox zoom
│   ├── sobre/                # Historia Nexera
│   ├── contacto/             # Formulario de demo
│   ├── terminos/             # Términos de servicio
│   ├── privacidad/           # Política de privacidad
│   ├── seguridad/            # Seguridad de datos
│   ├── admin/                # Super admin panel (crear tenants/usuarios)
│   ├── login/                # Login centralizado con routing por rol
│   ├── opengraph-image.tsx   # OG image para WhatsApp/LinkedIn
│   ├── sitemap.ts            # SEO sitemap
│   ├── robots.ts             # SEO robots
│   ├── [tenant]/
│   │   ├── sidebar.tsx       # Navegación lateral con permisos por rol
│   │   ├── layout.tsx        # Validación de tenant + auth + role + RealtimeAlerts
│   │   ├── realtime-alerts.tsx # Banner global de alertas + no-show persistentes
│   │   ├── puesto/           # UI del agente (mobile-first, consignas, voz, acción tomada)
│   │   ├── cliente/          # Portal del cliente contratante (PQR, daños)
│   │   └── dashboard/
│   │       ├── page.tsx           # Dashboard Gerencial + IA Analytics
│   │       ├── executive/         # Centro de Comando (operaciones + cliente + auditoría)
│   │       ├── live-monitor/      # NOC Monitor (3 estados: verde/amarillo/rojo)
│   │       ├── cambio-turno/      # Reporte de cambio de turno con narrativa
│   │       ├── turnos/            # Programación (fijo/temporal/mensual)
│   │       ├── consignas/         # Consignas por puesto (operador)
│   │       ├── comercial/         # Clientes, contratos, propiedades, puestos, QR
│   │       ├── armamento/         # Armas con ubicaciones, firma, custodia, PDF
│   │       ├── inventario/        # Stock, activos por puesto, entregas con firma + PDF
│   │       ├── flota/             # Rastreo GPS + Leaflet + mantenimiento
│   │       ├── rrhh/              # Expedientes (5 tabs + file upload)
│   │       ├── capacitaciones/    # Matriz de competencias
│   │       └── nomina/            # Periodos + informe de planilla inline
│   └── api/
│       ├── admin/                 # Super admin (crear tenants/usuarios)
│       ├── command-center/        # Centro de Comando (acciones + auditoría)
│       ├── shift/clock-in/        # QR + GPS + membership + doble turno
│       ├── shifts/assignments/    # Programación de turnos
│       ├── shifts/change-report/  # Reporte cambio turno + PDF
│       ├── incidents/report/      # Novedad con AI refinement + acción tomada
│       ├── incidents/justify/     # Justificación de incidencias
│       ├── firearms/delivery-pdf/ # Acta de custodia de arma (agente o puesto)
│       ├── inventory/loans-pdf/   # Acta de entrega de equipo
│       ├── fleet/telemetry/       # GPS webhook (timing-safe auth)
│       ├── cron/daily-reports/    # Reporte 8AM con Resend
│       ├── cron/shift-alerts/     # Alerta no-show 6:05/18:05
│       ├── payroll/calculate/     # Motor de liquidación quincenal
│       ├── dashboard/executive/   # Agregación paralela (7 queries)
│       ├── analytics/chat/        # IA conversacional + keyword fallback
│       └── contact/               # Formulario de contacto (pendiente Resend)
├── modules/                  # 15 módulos de negocio
├── lib/
│   ├── supabase/             # Clientes (browser, server, admin)
│   ├── payroll/              # Engine + ACH generator
│   ├── upload/               # Compresión de imágenes + FileUpload component
│   ├── ai/                   # Claude con timeout + fallback
│   ├── storage/              # Signed URLs
│   ├── errors/               # AppError centralizado
│   └── reports/              # HTML email generator
├── shared/types/database.ts  # Tipos manuales de todas las tablas
└── scripts/
    ├── admin-cli.ts          # CLI para crear tenants/usuarios
    └── generate-demo-data.ts # Generador de data masiva
```

### Migraciones SQL (26)
`supabase/migrations/` — 00001 a 00026. Nunca crear tablas desde el dashboard.

## Fases completadas

### Fase 1-5 — Core + RRHH + Nómina + Dashboard + Comercial
(Ver historial de commits para detalle)

### Fase 6 — Operaciones en Tiempo Real + Sitio Web
- Realtime notification banner global (Supabase Realtime, solo owner/admin)
- Incident detail modal con justificación y acción tomada
- Shift assignments (fijo/temporal/mensual, nocturno, anti-solapamiento)
- Cambio de turno con detección automática + narrativa + PDF
- NOC Monitor: 3 estados (verde on-time, amarillo tardanza, rojo vacante), 5 por fila
- Centro de Comando: operaciones + cliente, flujo rojo→ambar→verde, auditoría completa
- Consignas por puesto (página separada del comercial)
- Armamento: ubicaciones (armerías), firma digital, devolución con destino, PDF adaptativo
- Inventario: activos por puesto colapsables, entregas con firma + historial por mes + PDF legal
- Comercial: flujo completo cliente→contrato→propiedad→puestos→QR
- QR codes por puesto descargables
- Super admin panel (/admin) para crear tenants y usuarios
- Cron de no-show alerts (6:05/18:05) con alertas persistentes
- Doble turno: re-scan QR en mismo puesto auto-cierra anterior
- Acción tomada: agente documenta qué hizo al reportar novedad
- Alert audit log: trazabilidad completa de acciones del operador
- Sitio web público: landing, producto (14 screenshots + lightbox zoom), precios (7 bandas + toggle + comparador), sobre, contacto, legales, SEO, OG image
- Producción en www.nexguard360.com (Vercel + Namecheap)
- Migración visual emerald → lime tactical (#84CC16) en todo el app
- Logo SVG con transparencia real

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
- Color principal: lime tactical #84CC16 (no emerald)
- Perfiles join: query separada (agent_shifts FK → auth.users, no profiles)

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
```

## Variables de entorno

Ver `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `NEXT_PUBLIC_ROOT_DOMAIN`
- `ANTHROPIC_API_KEY` (opcional — analytics funciona sin ella)
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `GPS_PROVIDER_SECRET`

Vercel tiene las mismas variables configuradas para producción.

## Estado actual

```
Tablas Supabase:    42+
Migraciones:        26
Módulos:            17
Páginas frontend:   20+
API Routes:         14
Scripts:             3
Auditorías:          2
TS errors:           0
Brand:               NexGuard360 (lime tactical #84CC16)
Producción:          www.nexguard360.com
```

## Pendientes priorizados

1. **Módulos activables por tenant** — admin panel selecciona qué módulos ve cada agencia (ALTA PRIORIDAD)
2. **Banner para cliente del PH** — filtrado por property_id, solo novedades de SUS propiedades
3. **Conectar novedades al Cambio de Turno** — contexto para el operador
4. **Modo manual por puesto** — UI para que operador registre entrada/salida sin QR
5. **Stripe Checkout** — integración de pagos con trial sin tarjeta
6. **API /api/contact** — conectar formulario con Resend
7. **Blog** — estructura ISR
8. **PDF reporte ejecutivo** con branding
9. **Wizard de onboarding** para nuevo cliente
