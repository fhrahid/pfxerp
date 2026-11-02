import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'The 64-char invitation token received in the email invitation link' })
  @IsString()
  @IsNotEmpty({ message: 'Invitation token is required' })
  token: string;

  @ApiProperty({ description: 'Full legal/studio name for the developer profile' })
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  fullName: string;

  @ApiProperty({ description: 'Password (minimum 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({ description: 'Optional Southeast University Student ID' })
  @IsOptional()
  @IsString()
  studentId?: string;
}

