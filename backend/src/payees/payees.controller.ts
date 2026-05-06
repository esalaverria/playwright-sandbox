import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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

class PayeePatchDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  externalRef?: string;
}

@Controller('payees')
@UseGuards(JwtAuthGuard)
export class PayeesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request & { user: { userId: string } }, @Query('q') q?: string) {
    const term = q?.trim();
    const items = await this.prisma.payee.findMany({
      where: {
        userId: req.user.userId,
        ...(term
          ? {
              OR: [
                { displayName: { contains: term, mode: 'insensitive' } },
                { nickname: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
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
    await this.prisma.userActivity.create({
      data: {
        userId: req.user.userId,
        action: 'PAYEE_CREATED',
        meta: { payeeId: p.id, displayName: p.displayName, nickname: p.nickname },
      },
    });
    return { payee: p };
  }

  @Patch(':id')
  async patch(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: PayeePatchDto,
  ) {
    const existing = await this.prisma.payee.findFirst({ where: { id, userId: req.user.userId } });
    if (!existing) return { ok: false };
    const p = await this.prisma.payee.update({
      where: { id },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname.trim() || null } : {}),
        ...(dto.externalRef !== undefined ? { externalRef: dto.externalRef.trim() } : {}),
      },
    });
    await this.prisma.userActivity.create({
      data: {
        userId: req.user.userId,
        action: 'PAYEE_UPDATED',
        meta: { payeeId: p.id, nickname: p.nickname, externalRef: p.externalRef },
      },
    });
    return { payee: p };
  }

  @Delete(':id')
  async remove(@Req() req: Request & { user: { userId: string } }, @Param('id') id: string) {
    const existing = await this.prisma.payee.findFirst({ where: { id, userId: req.user.userId } });
    if (!existing) return { ok: false };
    await this.prisma.payee.delete({ where: { id } });
    await this.prisma.userActivity.create({
      data: {
        userId: req.user.userId,
        action: 'PAYEE_DELETED',
        meta: { payeeId: existing.id, displayName: existing.displayName },
      },
    });
    return { ok: true };
  }
}
