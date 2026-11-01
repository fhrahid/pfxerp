import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { IsIn, IsUUID, Max, Min, IsNumber } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { SquadsService } from './squads.service';

class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsIn(['PM', 'DEVELOPER'])
  role: 'PM' | 'DEVELOPER';

  @IsNumber()
  @Min(0.01)
  @Max(1)
  allocation: number;
}

class TransferMemberDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  fromSquadId: string;

  @IsUUID()
  toSquadId: string;

  @IsNumber()
  @Min(0.01)
  @Max(1)
  allocation: number;
}

@ApiTags('squads')
@ApiBearerAuth()
@Controller('squads')
export class SquadsController {
  constructor(private readonly squads: SquadsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.squads.listSquads(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squads.getSquad(user, id);
  }

  /** CPO roster management (chro.md §2.5). */
  @Post(':id/members')
  @Roles(UserRole.CPO, UserRole.CEO)
  addMember(@Param('id') squadId: string, @Body() dto: AddMemberDto, @CurrentUser() user: AuthUser) {
    return this.squads.addMember(user.id, squadId, dto);
  }

  @Post('members/transfer')
  @Roles(UserRole.CPO, UserRole.CEO)
  transferMember(
    @Body() dto: TransferMemberDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.squads.transferMember(user.id, dto, idem || '');
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.CPO, UserRole.CEO)
  removeMember(
    @Param('id') squadId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.squads.removeMember(user.id, squadId, userId, idem || '');
  }
}
