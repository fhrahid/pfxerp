import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { Public, CurrentUser } from '../../common/decorators';
import { AuthService } from './auth.service';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @HttpCode(200)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.id);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        account: true,
        squadMemberships: { where: { leftAt: null }, include: { squad: { select: { id: true, name: true } } } },
      },
    });
    if (!dbUser) return null;
    const { passwordHash: _p, refreshTokenHash: _r, ...safe } = dbUser;
    return {
      ...safe,
      walletBalance: dbUser.account ? Number(dbUser.account.balance) : 0,
    };
  }
}
