import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillsService } from './bills.service';

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

  /** `schedule` (default) creates a future payment; `pay_now` pays immediately. */
  @IsOptional()
  @IsIn(['schedule', 'pay_now'])
  mode?: 'schedule' | 'pay_now';
}

class BillPatchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  billerName?: string;

  @IsOptional()
  @IsString()
  fromAccountId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}

@Controller('bill-payments')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private bills: BillsService) {}

  @Get()
  async list(@Req() req: Request & { user: { userId: string } }) {
    return this.bills.list(req.user.userId);
  }

  @Post()
  async create(@Req() req: Request & { user: { userId: string } }, @Body() dto: BillDto) {
    return this.bills.create(req.user.userId, dto);
  }

  @Patch(':id')
  async patch(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: BillPatchDto,
  ) {
    return this.bills.update(req.user.userId, id, dto);
  }

  @Post(':id/pay-now')
  async payNow(@Req() req: Request & { user: { userId: string } }, @Param('id') id: string) {
    return this.bills.payNow(req.user.userId, id);
  }
}
