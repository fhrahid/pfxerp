import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser, isExecRole } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  role: string;

  @IsOptional()
  @IsString()
  studentId?: string;
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  studentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

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
        squadMemberships: {
          where: { leftAt: null },
          select: { squadId: true, role: true, allocation: true, squad: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
    return users;
  }

  /** CPO/CEO: create a member profile (wallet auto-provisioned). */
  @Post()
  @Roles(UserRole.CPO, UserRole.CEO)
  create(@Body() dto: CreateUserDto, @CurrentUser() caller: AuthUser) {
    return this.usersService.createUser(dto, caller);
  }

  /** Developers/PMs may only fetch themselves; executives may fetch anyone. */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (!isExecRole(user.role) && user.id !== id) {
      throw new ForbiddenException('AUTHZ_NOT_OWNER');
    }
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        squadMemberships: { where: { leftAt: null }, select: { squad: { select: { id: true, name: true } }, role: true, allocation: true } },
      },
    });
    if (!target) throw new ForbiddenException('NOT_FOUND');
    return target;
  }

  /** CPO/CEO: update a profile (rename, role change, password reset, deactivate). */
  @Patch(':id')
  @Roles(UserRole.CPO, UserRole.CEO)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() caller: AuthUser) {
    return this.usersService.updateUser(id, dto, caller);
  }
}
