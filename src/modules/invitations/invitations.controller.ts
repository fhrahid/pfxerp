import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C-Level executives create and dispatch a 72-hour developer invitation link' })
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvitationDto) {
    return this.invitationsService.createInvitation(user, dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C-Level executives list all invitations and their live statuses' })
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  list(@CurrentUser() user: AuthUser) {
    return this.invitationsService.listInvitations(user);
  }

  @Post(':id/resend')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'C-Level executives resend an invitation with a fresh 72-hour validity window' })
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  resend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitationsService.resendInvitation(user, id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C-Level executives revoke a pending invitation' })
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitationsService.revokeInvitation(user, id);
  }

  @Public()
  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify whether an invitation token is still valid before presenting setup form' })
  verify(@Param('token') token: string) {
    return this.invitationsService.verifyInvitation(token);
  }

  @Public()
  @Post('accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept invitation, configure password, and auto-login with initial personal wallet' })
  accept(@Body() dto: AcceptInvitationDto) {
    return this.invitationsService.acceptInvitation(dto);
  }
}

