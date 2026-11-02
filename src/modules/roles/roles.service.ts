import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser } from '../../common/types';
import { CreateRoleDto } from './dto/create-role.dto';

export const SYSTEM_ROLES: { name: string; description: string }[] = [
  { name: 'CEO', description: 'Chief Executive Officer' },
  { name: 'CFO', description: 'Chief Financial Officer' },
  { name: 'CTO', description: 'Chief Technology Officer' },
  { name: 'CPO', description: 'Chief Product Officer' },
  { name: 'PM', description: 'Project Manager' },
  { name: 'DEVELOPER', description: 'Software Developer' },
];

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedSystemRoles();
  }

  /**
   * Seeds default system roles into the Role table if not present.
   */
  async seedSystemRoles() {
    for (const sysRole of SYSTEM_ROLES) {
      await this.prisma.role.upsert({
        where: { name: sysRole.name },
        create: {
          name: sysRole.name,
          description: sysRole.description,
          isSystem: true,
        },
        update: {
          isSystem: true,
        },
      });
    }
    this.logger.log('System roles verified and seeded.');
  }

  /**
   * Lists all roles in the system (system roles first, then custom roles).
   */
  async findAll() {
    return this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Finds a role by name (case-insensitive).
   */
  async findByName(name: string) {
    if (!name || typeof name !== 'string') return null;
    const normalized = name.trim().toUpperCase();
    return this.prisma.role.findFirst({
      where: { name: { equals: normalized, mode: 'insensitive' } },
    });
  }

  /**
   * CEO-only: creates a new custom role.
   */
  async createRole(creator: AuthUser, dto: CreateRoleDto) {
    if (creator.role !== UserRole.CEO) {
      throw new AppException('AUTHZ_FORBIDDEN', 'Only the Chief Executive Officer (CEO) has authority to create new roles.');
    }

    const name = dto.name.trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,30}$/.test(name)) {
      throw new AppException(
        'VALIDATION_FAILED',
        'Role name must be 2 to 30 characters long and contain only uppercase letters, numbers, and underscores.',
      );
    }

    // Check if role already exists
    const existing = await this.findByName(name);
    if (existing) {
      throw new AppException('CONFLICT', `Role '${name}' already exists in the system.`);
    }

    const description = dto.description?.trim() || null;

    const newRole = await this.prisma.role.create({
      data: {
        name,
        description,
        isSystem: false,
      },
    });

    this.logger.log(`New custom role created: ${name} by CEO ${creator.email}`);
    return newRole;
  }
}
