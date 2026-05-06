import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('month-activity')
  async monthActivity(
    @Req() req: Request & { user: { userId: string } },
    @Query('year') yearRaw?: string,
    @Query('month') monthRaw?: string,
  ) {
    const now = new Date();
    const year = Math.max(2000, Math.min(2100, Number(yearRaw) || now.getUTCFullYear()));
    const month = Math.max(1, Math.min(12, Number(monthRaw) || now.getUTCMonth() + 1));
    return this.dashboard.monthActivity(req.user.userId, year, month);
  }
}
