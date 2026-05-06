import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountType } from '../generated/prisma/enums';
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
      select: { id: true },
    });

    if (!user) return { userExists: false, accounts: [] };
    if (user.id === req.user.userId) return { userExists: false, accounts: [] };

    const accounts = await this.prisma.account.findMany({
      where: {
        userId: user.id,
        closedAt: null,
        frozen: false,
        type: { in: [AccountType.CHECKING, AccountType.SAVINGS] },
      },
      select: { id: true, mask: true, type: true, nickname: true, balanceCents: true },
      orderBy: { nickname: 'asc' },
    });
    return {
      userExists: true,
      accounts: accounts.map((a) => ({
        id: a.id,
        mask: a.mask,
        type: a.type,
        nickname: a.nickname,
        balanceCents: a.balanceCents,
      })),
    };
  }
}
