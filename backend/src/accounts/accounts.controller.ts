import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';

class FreezeDto {
  @IsBoolean()
  frozen!: boolean;
}

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Get()
  async list(@Req() req: Request & { user: { userId: string } }) {
    const items = await this.accounts.listForUser(req.user.userId);
    return { accounts: items };
  }

  @Get(':id/transactions')
  async txs(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Query('take') takeRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('q') q?: string,
  ) {
    const take = Math.min(100, Math.max(1, Number(takeRaw) || 25));
    return this.accounts.transactions(req.user.userId, id, { take, cursor, q });
  }

  @Get(':id/statements')
  async statements(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.accounts.statementMonths(req.user.userId, id);
  }

  @Get(':id/statements/:period/export')
  async export(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Param('period') period: string,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.accounts.exportCsv(req.user.userId, id, period);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(content);
  }

  @Patch(':id/freeze')
  async freeze(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: FreezeDto,
  ) {
    return this.accounts.setFrozen(req.user.userId, id, dto.frozen);
  }
}
