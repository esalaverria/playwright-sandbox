import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransfersService } from './transfers.service';

class InternalDto {
  @IsString()
  fromAccountId!: string;

  @IsString()
  toAccountId!: string;

  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsOptional()
  @IsString()
  memo?: string;
}

class PeerDto {
  @IsString()
  fromAccountId!: string;

  @IsEmail()
  recipientEmail!: string;

  @IsString()
  toAccountId!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  memo?: string;
}

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private transfers: TransfersService) {}

  @Post('internal')
  async internal(@Req() req: Request & { user: { userId: string } }, @Body() dto: InternalDto) {
    return this.transfers.internal(req.user.userId, dto);
  }

  @Post('peer')
  async peer(@Req() req: Request & { user: { userId: string } }, @Body() dto: PeerDto) {
    return this.transfers.peer(req.user.userId, dto);
  }
}
