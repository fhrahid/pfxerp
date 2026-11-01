import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { CertificationType, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { CertificationsService } from './certifications.service';

class ApplyDto {
  @IsEnum(CertificationType)
  certificationType: CertificationType;

  @IsOptional()
  @IsString()
  portfolioUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  applicationNotes?: string;
}

class ReviewDto {
  @IsInt()
  @Min(0)
  @Max(100)
  qualityScore: number;

  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('certifications')
@ApiBearerAuth()
@Controller('cto/certifications')
export class CertificationsController {
  constructor(private readonly certs: CertificationsService) {}

  /** API-CTO-07. */
  @Post('apply')
  apply(@Body() dto: ApplyDto, @CurrentUser() user: AuthUser) {
    return this.certs.apply(user, dto);
  }

  /** API-CTO-08. */
  @Get('queue')
  @Roles(UserRole.CTO)
  queue() {
    return this.certs.queue();
  }

  /** API-CTO-10. */
  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.certs.userCertifications(user.id);
  }

  /** Public directory of bookable consultants (frontend helper). */
  @Get('consultants')
  consultants() {
    return this.certs.consultants();
  }

  @Get('user/:userId')
  byUser(@Param('userId') userId: string) {
    return this.certs.userCertifications(userId);
  }

  /** API-CTO-09. */
  @Post(':id/review')
  @Roles(UserRole.CTO)
  review(@Param('id') id: string, @Body() dto: ReviewDto, @CurrentUser() user: AuthUser) {
    return this.certs.review(user.id, id, dto);
  }
}
