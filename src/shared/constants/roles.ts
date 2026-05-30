import type { MembershipRole } from '@/shared/types/database';

export const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function hasMinimumRole(
  userRole: MembershipRole,
  requiredRole: MembershipRole,
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
