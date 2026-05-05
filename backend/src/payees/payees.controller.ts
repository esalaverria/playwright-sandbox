import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class PayeeDto {
  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsString()
  @MinLength(1)
  externalRef!: string;
}

@Controller('payees')
@UseGuards(JwtAuthGuard)
export class PayeesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request & { user: { userId: string } }) {
    const items = await this.prisma.payee.findMany({
      where: { userId: req.user.userId },
      orderBy: { displayName: 'asc' },
    });
    return { payees: items };
  }

  @Post()
  async create(@Req() req: Request & { user: { userId: string } }, @Body() dto: PayeeDto) {
    const p = await this.prisma.payee.create({
      data: {
        userId: req.user.userId,
        displayName: dto.displayName.trim(),
        nickname: dto.nickname?.trim() || null,
        externalRef: dto.externalRef.trim(),
      },
    });
    return { payee: p };
  }

  @Patch(':id')
  async patch(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: Partial<PayeeDto>,
  ) {
    const existing = await this.prisma.payee.findFirst({ where: { id, userId: req.user.userId } });
    if (!existing) return { ok: false };
    const p = await this.prisma.payee.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.nickname !== undefined ? { nickname: dto.nickname.trim() || null } : {}),
        ...(dto.externalRef !== undefined ? { externalRef: dto.externalRef.trim() } : {}),
      },
    });
    return { payee: p };
  }

  @Delete(':id')
  async remove(@Req() req: Request & { user: { userId: string } }, @Param('id') id: string) {
    const existing = await this.prisma.payee.findFirst({ where: { id, userId: req.user.userId } });
    if (!existing) return { ok: false };
    await this.prisma.payee.delete({ where: { id } });
    return { ok: true };
  }
}
