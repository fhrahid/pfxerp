import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiProperty({ example: 'developer@seu.edu.bd', description: 'Developer email address (must end in @seu.edu.bd)' })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiPropertyOptional({ default: 'DEVELOPER', description: 'Role to assign to the invited user (system role or custom role)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  role?: string = 'DEVELOPER';

  @ApiPropertyOptional({ description: 'Optional squad ID to immediately attach the user to' })
  @IsOptional()
  @IsString()
  targetSquadId?: string;
}

