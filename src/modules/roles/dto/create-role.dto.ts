import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Unique role identifier in UPPERCASE (alphanumeric and underscores)',
    example: 'CHRO',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Role name must contain only uppercase alphanumeric characters and underscores (e.g., CHRO, QA_LEAD)',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Human-readable description or title of the role',
    example: 'Chief Human Resources Officer',
  })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}
