import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  squadIds: string[];
}

export const EXEC_ROLES: UserRole[] = [UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO];
export const BOARD_ROLES: UserRole[] = [UserRole.CFO, UserRole.CTO, UserRole.CPO];

export function isExecRole(role: UserRole): boolean {
  return (EXEC_ROLES as string[]).includes(role);
}

export function isBoardRole(role: UserRole): boolean {
  return (BOARD_ROLES as string[]).includes(role);
}

/** Roles allowed to act on behalf of squad leadership (CTO gate / CPO ops / CEO override). */
export function isOverrideRole(role: UserRole): boolean {
  return role === UserRole.CEO || role === UserRole.CTO || role === UserRole.CPO;
}

/** Enforces strictly @seu.edu.bd email domain for authentication and registration. */
export function isAllowedEmailDomain(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return /^[a-zA-Z0-9._%+-]+@seu\.edu\.bd$/.test(normalized);
}

