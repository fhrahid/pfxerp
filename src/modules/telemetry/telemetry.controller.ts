import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { TelemetryEvent, TelemetryService } from './telemetry.service';

class IngestDto {
  @IsArray()
  events: TelemetryEvent[];
}

class CreateProductDto {
  @IsUUID()
  squadId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  liveUrl?: string;

  @IsOptional()
  @IsBoolean()
  isClientProduct?: boolean;

  @IsOptional()
  @IsUUID()
  clientContractId?: string;
}

@ApiTags('telemetry')
@Controller()
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  /** API-OTH-01: Ingest product telemetry events (stateless, no JWT required). */
  @Public()
  @Post('telemetry/ingest')
  ingest(
    @Headers('x-api-key') headerKey: string,
    @Body() body: IngestDto,
  ) {
    return this.telemetry.ingest(headerKey, body.events);
  }

  @ApiBearerAuth()
  @Post('products')
  @Roles(UserRole.PM, UserRole.CEO, UserRole.CTO, UserRole.CPO)
  createProduct(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.telemetry.createProduct(user, dto);
  }

  @ApiBearerAuth()
  @Get('products')
  listProducts(@CurrentUser() user: AuthUser, @Query('squadId') squadId?: string) {
    return this.telemetry.listProducts(user, squadId);
  }

  @ApiBearerAuth()
  @Get('products/:id')
  getProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.telemetry.getProduct(user, id);
  }

  @ApiBearerAuth()
  @Get('products/:id/telemetry')
  getTelemetry(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('hours') hours?: string) {
    return this.telemetry.getTelemetry(user, id, Number(hours) || 24);
  }
}

