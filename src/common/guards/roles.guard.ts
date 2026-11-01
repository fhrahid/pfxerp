import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators';
import { AuthUser } from '../types';

/**
 * Coarse RBAC guard (security.md §4). The CEO bypasses all role checks.
 * Fine-grained ownership (ABAC) rules are enforced inside services.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (!user) {
      return false;
    }
    if (user.role === UserRole.CEO) {
      return true; // supreme authority
    }
    return requiredRoles.includes(user.role);
  }
}
