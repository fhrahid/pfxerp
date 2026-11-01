import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { ConsultancyService } from './consultancy.service';

class BookDto {
  @IsUUID()
  consultantId: string;

  @IsUUID()
  clientSquadId: string;

  @IsDateString()
  scheduledAt: string;
}

class CompleteDto {
  @IsString()
  @MinLength(50)
  meetingNotes: string;

  @IsString()
  @MinLength(8)
  prLinks: string;
}

@ApiTags('consultancy')
@ApiBearerAuth()
@Controller('cto/consultancy/bookings')
export class ConsultancyController {
  constructor(private readonly consultancy: ConsultancyService) {}

  /** API-CTO-22 (simplified v1: direct booking instead of slot calendar). */
  @Post()
  @Roles(UserRole.PM, UserRole.CTO)
  book(@Body() dto: BookDto, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') idem?: string) {
    return this.consultancy.book(user, dto, idem || '');
  }

  @Get()
  list(
    @Query('consultantId') consultantId?: string,
    @Query('clientSquadId') clientSquadId?: string,
    @Query('status') status?: string,
  ) {
    return this.consultancy.list({ consultantId, clientSquadId, status });
  }

  /** API-CTO-23. */
  @Post(':id/complete')
  @Roles(UserRole.CTO, UserRole.DEVELOPER, UserRole.PM, UserRole.CPO)
  complete(@Param('id') id: string, @Body() dto: CompleteDto, @CurrentUser() user: AuthUser) {
    return this.consultancy.complete(user.id, id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.PM, UserRole.CTO)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.consultancy.cancel(user, id);
  }
}
