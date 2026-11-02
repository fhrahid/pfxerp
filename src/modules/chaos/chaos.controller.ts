import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { ChaosEventType, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { ChaosService } from './chaos.service';

class TriggerChaosDto {
  @IsEnum(ChaosEventType)
  type: ChaosEventType;

  @IsString()
  @MinLength(5)
  title: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsOptional()
  @IsUUID()
  targetSquadId?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  penaltyAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  timeLimitSeconds?: number;
}

class ResolveChaosDto {
  @IsString()
  @MinLength(5)
  resolution: string;
}

@ApiTags('chaos')
@ApiBearerAuth()
@Controller('chaos')
export class ChaosController {
  constructor(private readonly chaos: ChaosService) {}

  /** API-CEO-02: trigger a live lab crisis (CEO only). */
  @Post('events')
  @Roles(UserRole.CEO)
  trigger(@Body() dto: TriggerChaosDto, @CurrentUser() user: AuthUser) {
    return this.chaos.trigger(user, dto);
  }

  @Get('events')
  list(@Query('includeResolved') includeResolved?: string) {
    return this.chaos.list(includeResolved === 'true');
  }

  @Post('events/:id/resolve')
  @Roles(UserRole.CEO, UserRole.PM)
  resolve(
    @Param('id') id: string,
    @Body() body: ResolveChaosDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chaos.resolve(user, id, body.resolution);
  }
}
