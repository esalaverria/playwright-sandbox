import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('recipients')
@UseGuards(JwtAuthGuard)
export class RecipientsController {
  constructor(private prisma: PrismaService) {}

  @Get('preview')
  async preview(
    @Req() req: Request & { user: { userId: string } },
    @Query('email') emailRaw?: string,
  ) {
    const email = emailRaw?.toLowerCase().trim() ?? '';
    if (!email) return { userExists: false, accounts: [] };

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        accounts: {
          select: { id: true, mask: true, type: true, nickname: true },
          orderBy: { nickname: 'asc' },
        },
      },
    });

    if (!user) return { userExists: false, accounts: [] };
    if (user.id === req.user.userId) return { userExists: false, accounts: [] };

    return {
      userExists: true,
      accounts: user.accounts.map((a) => ({
        id: a.id,
        mask: a.mask,
        type: a.type,
        nickname: a.nickname,
      })),
    };
  }
}
