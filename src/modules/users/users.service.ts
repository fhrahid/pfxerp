import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { isAllowedEmailDomain } from '../../common/types';

export interface CreateUserDto {
  email: string;
  fullName: string;
  password: string;
  role: string;
  studentId?: string;
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  role?: string;
  studentId?: string | null;
  isActive?: boolean;
  password?: string;
}

/**
 * People operations (chro.md §2.1): CPO/CEO create user profiles (with an
 * auto-provisioned personal wallet) and manage them — role changes, renaming,
 * password resets and (de)activation.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private safe(user: { id: string; email: string; fullName: string; role: string; studentId: string | null; isActive: boolean }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      studentId: user.studentId,
      isActive: user.isActive,
      hasPassword: true,
    };
  }

  async createUser(dto: CreateUserDto, caller?: { role: string }) {
    const email = dto.email.trim().toLowerCase();
    if (!isAllowedEmailDomain(email)) {
      throw new AppException('VALIDATION_FAILED', 'Email must be an @seu.edu.bd address');
    }

    const roleName = (dto.role || 'DEVELOPER').trim().toUpperCase();
    const roleExists = await this.prisma.role.findFirst({
      where: { name: { equals: roleName, mode: 'insensitive' } },
    });
    if (!roleExists) {
      throw new AppException('VALIDATION_FAILED', `Role '${dto.role}' does not exist.`);
    }

    if (caller && caller.role !== UserRole.CEO) {
      if (roleExists.name !== 'DEVELOPER' && roleExists.name !== 'PM') {
        throw new AppException('AUTHZ_FORBIDDEN', 'Only the CEO can assign executive or custom roles.');
      }
    }

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) throw new AppException('CONFLICT', `A user with email ${email} already exists`);
    // Blank student IDs become NULL — Postgres UNIQUE allows many NULLs but only one ''
    const studentId = dto.studentId?.trim() || null;
    if (studentId) {
      const clash = await this.prisma.user.findUnique({ where: { studentId } });
      if (clash) throw new AppException('CONFLICT', `Student ID ${studentId} is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName,
        passwordHash,
        role: roleExists.name,
        studentId,
        isActive: true,
      },
    });

    // Every user gets a PERSONAL_WALLET at enrollment (BR-DEV-14)
    await this.prisma.account.create({
      data: { ownerId: user.id, type: 'PERSONAL_WALLET', balance: 0, currency: 'BDT' },
    });

    return this.safe(user);
  }

  async updateUser(userId: string, dto: UpdateUserDto, caller?: { role: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let assignedRole: string | undefined = undefined;
    if (dto.role) {
      const roleName = dto.role.trim().toUpperCase();
      const roleExists = await this.prisma.role.findFirst({
        where: { name: { equals: roleName, mode: 'insensitive' } },
      });
      if (!roleExists) {
        throw new AppException('VALIDATION_FAILED', `Role '${dto.role}' does not exist.`);
      }
      if (caller && caller.role !== UserRole.CEO) {
        if (roleExists.name !== 'DEVELOPER' && roleExists.name !== 'PM') {
          throw new AppException('AUTHZ_FORBIDDEN', 'Only the CEO can assign executive or custom roles.');
        }
      }
      assignedRole = roleExists.name;
    }

    // Blank student IDs become NULL — Postgres UNIQUE allows many NULLs but only one ''
    const studentId = dto.studentId === undefined ? undefined : dto.studentId?.trim() || null;
    const email = dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined;

    if (email && email !== user.email.toLowerCase()) {
      if (!isAllowedEmailDomain(email)) {
        throw new AppException('VALIDATION_FAILED', 'Email must be an @seu.edu.bd address');
      }
      const clash = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (clash) throw new AppException('CONFLICT', `A user with email ${email} already exists`);
    }
    if (studentId && studentId !== user.studentId) {
      const clash = await this.prisma.user.findUnique({ where: { studentId } });
      if (clash) throw new AppException('CONFLICT', `Student ID ${studentId} is already taken`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(assignedRole ? { role: assignedRole } : {}),
        ...(studentId !== undefined ? { studentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 12) } : {}),
        // password change or deactivation invalidates all refresh sessions
        ...(dto.password || dto.isActive === false ? { refreshTokenHash: null } : {}),
      },
    });
    return this.safe(updated);
  }
}
