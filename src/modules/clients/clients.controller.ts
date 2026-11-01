import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { ContractType, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { ClientsService } from './clients.service';

class CreateClientDto {
  @IsString()
  @MinLength(2)
  companyName: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsEmail()
  contactEmail: string;
}

class CreateContractDto {
  @IsUUID()
  clientId: string;

  @IsString()
  @MinLength(5)
  title: string;

  @IsEnum(ContractType)
  contractType: ContractType;

  @IsInt()
  @Min(1)
  totalValue: number;

  @IsOptional()
  studioReservePercent?: number;

  @IsOptional()
  squadSharePercent?: number;

  @IsOptional()
  execOverheadPercent?: number;
}

class AddMilestoneDto {
  @IsUUID()
  contractId: string;

  @IsString()
  @MinLength(3)
  milestoneName: string;

  @IsInt()
  @Min(1)
  payoutAmount: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post()
  @Roles(UserRole.CEO, UserRole.CPO, UserRole.CFO)
  createClient(@Body() dto: CreateClientDto) {
    return this.clients.createClient(dto);
  }

  @Get()
  listClients() {
    return this.clients.listClients();
  }

  @Post('contracts')
  @Roles(UserRole.CEO, UserRole.CPO, UserRole.CFO)
  createContract(@Body() dto: CreateContractDto) {
    return this.clients.createContract(dto);
  }

  @Get('contracts')
  listContracts() {
    return this.clients.listContracts();
  }

  @Post('milestones')
  @Roles(UserRole.CEO, UserRole.CPO, UserRole.CFO, UserRole.PM)
  addMilestone(@Body() dto: AddMilestoneDto) {
    return this.clients.addMilestone(dto);
  }

  @Post('milestones/:id/escrow')
  @Roles(UserRole.CEO, UserRole.CPO, UserRole.CFO)
  fundEscrow(@Param('id') id: string, @Body() body: { amount: number }, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') idem?: string) {
    return this.clients.fundEscrow(user, id, body.amount, idem || '');
  }

  @Post('milestones/:id/assign')
  @Roles(UserRole.CEO, UserRole.CPO, UserRole.CTO, UserRole.PM)
  assign(@Param('id') id: string, @Body() body: { squadId: string }) {
    return this.clients.assignSquad({} as AuthUser, id, body.squadId);
  }

  @Post('milestones/:id/cto-audit')
  @Roles(UserRole.CTO)
  ctoAudit(@Param('id') id: string, @Body() body: { pass: boolean; notes?: string }, @CurrentUser() user: AuthUser) {
    return this.clients.ctoAudit(user.id, id, body.pass, body.notes);
  }

  @Post('milestones/:id/client-accept')
  @Roles(UserRole.PM, UserRole.CEO, UserRole.CPO)
  clientAccept(
    @Param('id') id: string,
    @Body() body: { accepted: boolean },
    @CurrentUser() user: AuthUser,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.clients.clientAccept(user, id, body.accepted, idem || '');
  }
}
