import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all available roles (system & custom roles)' })
  @ApiResponse({ status: 200, description: 'List of roles' })
  async listRoles() {
    return this.rolesService.findAll();
  }

  @Post()
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'CEO only: create a new custom role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 403, description: 'Only CEO can create roles' })
  @ApiResponse({ status: 409, description: 'Role already exists' })
  async createRole(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(user, dto);
  }
}
