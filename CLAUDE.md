# NexGuard360 — CLAUDE.md

## Qué es este proyecto

ERP multi-tenant SaaS para empresas de seguridad privada en Panamá. Gestiona operaciones de campo, RRHH, armamento, flota vehicular, inventario, capacitaciones, atención al cliente y nómina desde una sola plataforma con aislamiento total de datos por tenant.

## Stack tecnológico

- **Framework:** Next.js 15 (App Router), TypeScript strict (zero `any`)
- **Base de datos:** Supabase (PostgreSQL 17) con Row Level Security en todas las tablas
- **Auth:** Supabase Auth con JWT refresh via middleware
- **AI:** Anthropic SDK (Claude Sonnet) para refinamiento de bitácoras
- **Email:** Resend para reportes diarios automatizados
- **Validación:** Zod v4 en todos los inputs
- **Estilos:** Tailwind CSS, tema dark OLED para dashboards
- **Storage:** Supabase Storage (bucket privado `hr-documents`)

## Arquitectura

### Multi-tenancy
- Aislamiento por `tenant_id` en todas las tablas operativas
- RLS con funciones helper `get_user_tenant_ids()` y `get_user_role_in_tenant()`
- Subdominios dinámicos: `tenant-slug.dominio.com` → rewrite a `/[tenant]/...`
- Roles: `owner`, `admin`, `editor`, `viewer`

### Estructura de código
```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page pública
│   ├── login/              # Login centralizado con routing por rol
│   ├── [tenant]/           # Rutas dinámicas por tenant (rewrite desde subdomain)
│   │   ├── puesto/         # UI del agente (mobile-first)
│   │   ├── cliente/        # Portal del cliente contratante
│   │   └── dashboard/      # Dashboards administrativos
│   └── api/                # Route Handlers
├── modules/                # Arquitectura modular por dominio
│   └── {module}/           # types/ schemas/ services/ actions/
├── lib/                    # Utilidades compartidas
│   ├── supabase/           # Clientes (browser, server, middleware, admin)
│   ├── errors/             # AppError + handleApiError centralizado
│   ├── ai/                 # Cliente Anthropic con timeout
│   ├── storage/            # Signed URLs para documentos privados
│   └── reports/            # Generador de HTML para email diario
└── shared/                 # Tipos, constantes, utils
    └── types/database.ts   # Tipo Database manual (~1400 líneas)
```

### Módulos de negocio (15)
tenant, auth, documents, properties, shifts, incidents, firearms, inventory, fleet, hr, training, client-service, payroll

### Migraciones SQL
Todas en `supabase/migrations/` (00001 a 00013 + audit fixes + storage). Nunca crear tablas desde el dashboard — todo via archivos SQL para CI/CD.

## Metodología de desarrollo

### Fases con auditoría
Este proyecto se construye en fases secuenciales. Al cerrar cada fase se ejecuta una auditoría con dos agentes (Software Architect + Code Reviewer) que revisan:
1. Aislamiento multi-tenant (RLS en todas las tablas)
2. Integridad de TypeScript (zero `any`, tipos alineados con SQL)
3. Middleware y routing (sin bucles, cookies propagadas)
4. Seguridad de Storage (signed URLs, RLS en objetos)
5. Error handling en API routes (Zod + try/catch + AI fallback)

Los hallazgos se corrigen antes de avanzar a la siguiente fase.

### Convenciones de código
- Race conditions se resuelven a nivel de DB (partial unique indexes + manejo de error 23505), no con check-then-insert
- Stock de inventario usa funciones SQL atómicas (`decrement_stock`/`increment_stock`)
- Services reciben `SupabaseClient` inyectado, no lo crean internamente
- `.maybeSingle()` en vez de `.single()` para queries que pueden no retornar datos
- Schemas Zod deben alinearse con CHECK constraints de las tablas SQL
- Todas las mutaciones en API routes validan membership del tenant explícitamente

## Modelo de nómina (Fase 4) — IMPORTANTE PARA FUTURO

### Calco del negocio real (Panamá)
El sistema suma las marcas del QR y el GPS del agente, topa a 96 las ordinarias (12 días x 8h por quincena), manda el excedente a la bolsa de extras planas, y aplica el descuento de Seguro Social (9.75%) y Educativo (1.25%) calcando el resultado final centavo a centavo con el Excel actual de la agencia.

### Escalabilidad SaaS para múltiples formatos de pago
Si en el futuro una agencia de seguridad corporativa compra el software y dice: "Es que yo sí pago las horas extras con el 25% de recargo según la ley", solo hay que cambiar el flag `overtime_flat_rate` a `FALSE` en la configuración de ese tenant (`payroll_configs`). El sistema se adapta de inmediato sin alterar una sola línea del código base.

La tabla `payroll_configs` es extensible para soportar:
- Diferentes límites de horas ordinarias por quincena
- Recargos por días feriados nacionales (flag `pays_holiday_premium`)
- Tasas de retención personalizadas por país o jurisdicción
- Cualquier modelo de compensación que un nuevo cliente traiga

**Esto queda abierto deliberadamente** para acomodar clientes con formatos de pago diferentes sin refactoring.

## Comandos útiles

```bash
npx tsc --noEmit          # Type-check sin compilar
npm run build             # Build de producción
npm run dev               # Dev server en localhost:3000
npx supabase gen types    # Regenerar tipos (cuando se configure local)
```

## Variables de entorno requeridas

Ver `.env.local.example` para la lista completa:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `NEXT_PUBLIC_ROOT_DOMAIN`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `GPS_PROVIDER_SECRET`
