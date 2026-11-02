import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole | string;
  squadIds: string[];
}

export const EXEC_ROLES: (UserRole | string)[] = [UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO];
export const BOARD_ROLES: (UserRole | string)[] = [UserRole.CFO, UserRole.CTO, UserRole.CPO];

export function isExecRole(role: UserRole | string): boolean {
  return (EXEC_ROLES as string[]).includes(role);
}

export function isBoardRole(role: UserRole | string): boolean {
  return (BOARD_ROLES as string[]).includes(role);
}

/** Roles allowed to act on behalf of squad leadership (CTO gate / CPO ops / CEO override). */
export function isOverrideRole(role: UserRole | string): boolean {
  return role === UserRole.CEO || role === UserRole.CTO || role === UserRole.CPO;
}

/**
 * Enforces the studio email domain for authentication and registration.
 * Configurable via ALLOWED_EMAIL_DOMAIN (comma-separated list), default: seu.edu.bd
 */
export function isAllowedEmailDomain(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const domains = (process.env.ALLOWED_EMAIL_DOMAIN || 'seu.edu.bd')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  return domains.some((domain) => normalized.endsWith(`@${domain}`));
}

