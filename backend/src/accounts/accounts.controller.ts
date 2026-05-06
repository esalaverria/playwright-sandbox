import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AccountType, CardBrand, CardLifecycleStatus as CLS } from '../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';

class FreezeDto {
  @IsBoolean()
  frozen!: boolean;
}

class AllowOverLimitDto {
  @IsBoolean()
  allowOverLimit!: boolean;
}

class PrimaryCardDto {
  @IsOptional()
  @IsString()
  accountId?: string | null;
}

class CreateAccountDto {
  @IsIn([AccountType.CHECKING, AccountType.SAVINGS])
  type!: AccountType;

  @IsString()
  @MinLength(1)
  nickname!: string;
}

class RequestCardDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsEnum(CardBrand)
  brand?: CardBrand;
}

class CloseAccountDto {
  @IsOptional()
  @IsString()
  transferToAccountId?: string;
}

class CardLifecycleBodyDto {
  @IsIn([CLS.CANCELLED])
  lifecycle!: typeof CLS.CANCELLED;
}

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Post()
  async create(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: CreateAccountDto,
  ) {
    const account = await this.accounts.createDepositAccount(req.user.userId, dto);
    return { account };
  }

  @Post('credit-cards')
  async requestCard(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: RequestCardDto,
  ) {
    const account = await this.accounts.requestCreditCard(req.user.userId, dto);
    return { account };
  }

  @Get('activity-log')
  async activityLog(@Req() req: Request & { user: { userId: string } }) {
    const items = await this.accounts.listActivity(req.user.userId);
    return { activities: items };
  }

  @Get()
  async list(@Req() req: Request & { user: { userId: string } }) {
    const items = await this.accounts.listForUser(req.user.userId);
    return { accounts: items };
  }

  @Get(':id/sensitive-card')
  async sensitiveCard(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
  ) {
    const details = await this.accounts.getSensitiveCardDetails(req.user.userId, id);
    return { details };
  }

  @Get(':id/transactions')
  async txs(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
    @Query('q') q?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ) {
    const page = Math.max(1, Number(pageRaw) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeRaw) || 15));
    return this.accounts.transactions(req.user.userId, id, {
      page,
      pageSize,
      q,
      from: fromDate,
      to: toDate,
    });
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

  @Patch(':id/close')
  async close(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: CloseAccountDto,
  ) {
    return this.accounts.closeDepositAccount(req.user.userId, id, dto.transferToAccountId);
  }

  @Patch(':id/card-lifecycle')
  async cardLifecycle(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: CardLifecycleBodyDto,
  ) {
    return this.accounts.setCardLifecycle(req.user.userId, id, dto.lifecycle);
  }

  @Post(':id/report-lost-replace')
  async reportLostReplace(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.accounts.reportLostAndReplace(req.user.userId, id);
  }

  @Patch(':id/freeze')
  async freeze(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: FreezeDto,
  ) {
    return this.accounts.setFrozen(req.user.userId, id, dto.frozen);
  }

  @Patch(':id/credit-settings')
  async creditSettings(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: AllowOverLimitDto,
  ) {
    return this.accounts.setAllowOverLimit(req.user.userId, id, dto.allowOverLimit);
  }

  @Patch('primary-card')
  async primaryCard(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: PrimaryCardDto,
  ) {
    return this.accounts.setPrimaryCard(req.user.userId, dto.accountId ?? null);
  }
}
