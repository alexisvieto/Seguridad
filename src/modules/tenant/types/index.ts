export type { Tenant, Membership, MembershipRole, TenantPlan } from '@/shared/types/database';

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: TenantPlan;
}

export interface UpdateTenantInput {
  name?: string;
  logo_url?: string | null;
  settings?: Record<string, unknown>;
}

export interface InviteMemberInput {
  email: string;
  role: MembershipRole;
}

import type { TenantPlan, MembershipRole } from '@/shared/types/database';
