import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';

const SUPER_ADMIN_EMAILS = ['alexisvieto@gmail.com'];

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function verifySuperAdmin(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? '')) {
    throw new AppError('FORBIDDEN', 'Acceso restringido a super administradores');
  }
  return user;
}

export async function GET(request: NextRequest) {
  try {
    await verifySuperAdmin(request);
    const admin = getAdminClient();

    const { data: tenants } = await admin
      .from('tenants')
      .select('id, name, slug, plan, settings, created_at')
      .order('created_at', { ascending: false });

    const { data: memberships } = await admin
      .from('memberships')
      .select('tenant_id, user_id, role');

    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });

    const userMap = new Map(
      (users?.users ?? []).map((u) => [u.id, { email: u.email, name: u.user_metadata?.full_name ?? '' }]),
    );

    const tenantsWithUsers = (tenants ?? []).map((t) => {
      const members = (memberships ?? [])
        .filter((m) => m.tenant_id === t.id)
        .map((m) => ({
          userId: m.user_id,
          email: userMap.get(m.user_id)?.email ?? '',
          name: userMap.get(m.user_id)?.name ?? '',
          role: m.role,
        }));

      const settings = (t.settings ?? {}) as Record<string, unknown>;
      const enabledModules = (settings['enabled_modules'] as string[] | undefined) ?? [];
      const maxAgents = Number(settings['max_agents'] ?? 0);
      return { ...t, members, enabledModules, maxAgents };
    });

    return NextResponse.json({ data: tenantsWithUsers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifySuperAdmin(request);

    const body = await request.json() as Record<string, unknown>;
    const action = body['action'] as string;
    const admin = getAdminClient();

    if (action === 'create_tenant') {
      const name = String(body['name'] ?? '').trim();
      const slug = String(body['slug'] ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const plan = String(body['plan'] ?? 'pro');
      const enabledModules = (body['enabled_modules'] as string[] | undefined) ?? [];
      const maxAgents = Number(body['max_agents'] ?? 0);

      if (!name || !slug) throw new AppError('VALIDATION_ERROR', 'Nombre y slug son requeridos');

      const { data: existing } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
      if (existing) throw new AppError('CONFLICT', `El slug "${slug}" ya existe`);

      const settings: Record<string, unknown> = {};
      if (enabledModules.length > 0) settings['enabled_modules'] = enabledModules;
      if (maxAgents > 0) settings['max_agents'] = maxAgents;

      const { data: tenant, error } = await admin
        .from('tenants')
        .insert({ name, slug, plan, settings })
        .select()
        .single();

      if (error) throw new AppError('INTERNAL_ERROR', 'Error al crear tenant');

      return NextResponse.json({ data: tenant }, { status: 201 });
    }

    if (action === 'create_user') {
      const email = String(body['email'] ?? '').trim();
      const password = String(body['password'] ?? '');
      const fullName = String(body['full_name'] ?? '').trim();
      const tenantId = String(body['tenant_id'] ?? '');
      const rawRole = String(body['role'] ?? 'admin');
      const validRoles = ['owner', 'admin', 'editor', 'viewer'] as const;
      if (!validRoles.includes(rawRole as typeof validRoles[number])) throw new AppError('VALIDATION_ERROR', 'Rol inválido');
      const role = rawRole;
      const employeeType = String(body['employee_type'] ?? '');
      const cedula = String(body['cedula'] ?? '').trim();
      const salary = String(body['salary'] ?? '');

      if (!email || !password || !fullName || !tenantId) {
        throw new AppError('VALIDATION_ERROR', 'Email, contraseña, nombre y tenant son requeridos');
      }

      if (password.length < 6) throw new AppError('VALIDATION_ERROR', 'Contraseña debe tener al menos 6 caracteres');

      // Check agent limit
      const { data: tenantData } = await admin.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
      const tenantSettings = (tenantData?.settings ?? {}) as Record<string, unknown>;
      const maxAgentsLimit = Number(tenantSettings['max_agents'] ?? 0);

      if (maxAgentsLimit > 0) {
        const { count } = await admin.from('memberships').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
        if ((count ?? 0) >= maxAgentsLimit) {
          throw new AppError('CONFLICT', `Ha alcanzado el máximo de ${maxAgentsLimit} usuarios de su plan. Contacte a NexGuard360 para actualizar.`);
        }
      }

      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authError) {
        if (authError.message.includes('already been registered')) {
          throw new AppError('CONFLICT', 'Este email ya está registrado');
        }
        throw new AppError('INTERNAL_ERROR', `Error al crear usuario: ${authError.message}`);
      }

      const memberInsert: Record<string, unknown> = {
        tenant_id: tenantId,
        user_id: authUser.user.id,
        role,
      };
      if (employeeType) memberInsert['employee_type'] = employeeType;

      const { error: memberError } = await admin
        .from('memberships')
        .insert(memberInsert);

      if (memberError) {
        throw new AppError('INTERNAL_ERROR', 'Usuario creado pero error al asignar membership');
      }

      // Create HR profile if cedula or salary provided
      if (cedula || salary) {
        const hrInsert: Record<string, unknown> = {
          tenant_id: tenantId,
          user_id: authUser.user.id,
        };
        if (cedula) hrInsert['cedula'] = cedula;

        await admin.from('hr_agent_profiles').upsert(hrInsert, { onConflict: 'tenant_id,user_id' });

        // Create contract with salary if provided
        if (salary && parseFloat(salary) > 0) {
          await admin.from('hr_contracts').insert({
            tenant_id: tenantId,
            user_id: authUser.user.id,
            contract_type: 'indefinido',
            base_salary: parseFloat(salary),
            start_date: new Date().toISOString().split('T')[0],
          });
        }
      }

      return NextResponse.json({
        data: {
          id: authUser.user.id,
          email,
          name: fullName,
          role,
          tenant_id: tenantId,
        },
      }, { status: 201 });
    }

    if (action === 'update_modules') {
      const tenantId = String(body['tenant_id'] ?? '');
      const enabledModules = (body['enabled_modules'] as string[] | undefined) ?? [];

      if (!tenantId) throw new AppError('VALIDATION_ERROR', 'tenant_id requerido');

      const { data: tenant } = await admin.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
      const currentSettings = (tenant?.settings ?? {}) as Record<string, unknown>;

      const { error } = await admin.from('tenants').update({
        settings: { ...currentSettings, enabled_modules: enabledModules },
      }).eq('id', tenantId);

      if (error) throw new AppError('INTERNAL_ERROR', 'Error al actualizar módulos');

      return NextResponse.json({ success: true });
    }

    throw new AppError('VALIDATION_ERROR', 'Acción no reconocida');
  } catch (error) {
    return handleApiError(error);
  }
}
