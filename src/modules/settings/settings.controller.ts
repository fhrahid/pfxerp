import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../prisma/prisma.service';

class UpdateSettingDto {
  @IsString()
  @MinLength(1)
  key: string;

  @IsString()
  @MinLength(1)
  value: string;

  @IsIn(['STRING', 'NUMBER', 'JSON', 'BOOLEAN'])
  type: string;
}

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  async list() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  @Put()
  @Roles(UserRole.CEO) // BR: System settings update is CEO-only (security.md §3.1)
  async update(@Body() dto: UpdateSettingDto) {
    if (dto.type === 'NUMBER' && !Number.isFinite(Number(dto.value))) {
      throw new Error('NUMBER type requires a numeric value');
    }
    return this.settings.upsert(dto.key, dto.value, dto.type);
  }
}
