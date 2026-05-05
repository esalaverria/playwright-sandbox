import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request & { user: { userId: string } }) {
    const items = await this.prisma.message.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    return { messages: items };
  }

  @Patch(':id/read')
  async read(@Req() req: Request & { user: { userId: string } }, @Param('id') id: string) {
    const msg = await this.prisma.message.findFirst({ where: { id, userId: req.user.userId } });
    if (!msg) return { ok: false };
    await this.prisma.message.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
