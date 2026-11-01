import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser, isExecRole, isBoardRole, isOverrideRole } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Executive roster view (chro.md §3.1). */
  @Get()
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  async list() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        studentId: true,
        role: true,
        tier: true,
        squadMemberships: {
          where: { leftAt: null },
          select: { squadId: true, role: true, allocation: true, squad: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
    return users;
  }

  /** Developers/PMs may only fetch themselves; executives may fetch anyone. */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const isExec = isExecRole(user.role);
    if (!isExec && user.id !== id) {
      throw new ForbiddenException('AUTHZ_NOT_OWNER');
    }
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tier: true,
        squadMemberships: { where: { leftAt: null }, select: { squad: { select: { id: true, name: true } }, role: true, allocation: true } },
      },
    });
    if (!target) throw new ForbiddenException('NOT_FOUND');
    return target;
  }
}
