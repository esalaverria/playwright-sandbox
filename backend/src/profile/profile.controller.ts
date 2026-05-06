import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class PatchMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(10000)
  defaultCardLimitCents?: number;
}

class PasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private prisma: PrismaService) {}

  @Patch()
  async patch(@Req() req: Request & { user: { userId: string } }, @Body() dto: PatchMeDto) {
    const user = await this.prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.defaultCardLimitCents !== undefined
          ? { defaultCardLimitCents: dto.defaultCardLimitCents }
          : {}),
      },
      select: { id: true, email: true, fullName: true, phone: true, defaultCardLimitCents: true },
    });
    return { user };
  }

  @Post('password')
  async password(@Req() req: Request & { user: { userId: string } }, @Body() dto: PasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: req.user.userId } });
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      return { ok: false, message: 'Current password incorrect' };
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return { ok: true };
  }
}
