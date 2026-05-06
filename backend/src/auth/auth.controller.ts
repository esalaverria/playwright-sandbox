import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Response, Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private cookieOptions() {
    const secure = this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    const { token, user: u } = await this.auth.login(user.id, user.email);
    res.cookie('np_token', token, this.cookieOptions());
    return {
      user: {
        id: u!.id,
        email: u!.email,
        fullName: u!.fullName,
        phone: u!.phone,
        defaultCardLimitCents: u!.defaultCardLimitCents,
      },
    };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.register(dto);
    res.cookie('np_token', token, this.cookieOptions());
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        defaultCardLimitCents: user.defaultCardLimitCents,
      },
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('np_token', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: { userId: string } }) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        locked: true,
        defaultCardLimitCents: true,
        primaryCardId: true,
      },
    });
    return { user };
  }
}
