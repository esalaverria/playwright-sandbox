import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PaymentStatus } from '../generated/prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class BillDto {
  @IsString()
  @MinLength(1)
  billerName!: string;

  @IsString()
  fromAccountId!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  memo?: string;
}

@Controller('bill-payments')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request & { user: { userId: string } }) {
    const items = await this.prisma.scheduledPayment.findMany({
      where: { userId: req.user.userId },
      orderBy: { dueDate: 'asc' },
    });
    return { bills: items };
  }

  @Post()
  async create(@Req() req: Request & { user: { userId: string } }, @Body() dto: BillDto) {
    const acc = await this.prisma.account.findFirst({
      where: { id: dto.fromAccountId, userId: req.user.userId },
    });
    if (!acc) throw new BadRequestException('Invalid account');

    const due = new Date(dto.dueDate);
    if (Number.isNaN(due.getTime())) throw new BadRequestException('Invalid date');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) throw new BadRequestException({ code: 'PAST_DATE', message: 'Due date must be today or later' });

    const bill = await this.prisma.scheduledPayment.create({
      data: {
        userId: req.user.userId,
        billerName: dto.billerName.trim(),
        fromAccountId: dto.fromAccountId,
        amountCents: dto.amountCents,
        dueDate: due,
        memo: dto.memo?.trim() || null,
        status: PaymentStatus.SCHEDULED,
      },
    });
    return { bill };
  }

  @Post(':id/pay-now')
  async payNow(@Req() req: Request & { user: { userId: string } }, @Param('id') id: string) {
    const bill = await this.prisma.scheduledPayment.findFirst({
      where: { id, userId: req.user.userId },
    });
    if (!bill) throw new BadRequestException('Not found');
    const updated = await this.prisma.scheduledPayment.update({
      where: { id },
      data: { status: PaymentStatus.PAID },
    });
    return { bill: updated };
  }
}
