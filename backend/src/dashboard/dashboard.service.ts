import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /** Daily aggregates for all ledger activity across the user's accounts in a calendar month (UTC). */
  async monthActivity(userId: string, year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));

    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        occurredAt: { gte: start, lte: end },
        account: { userId },
      },
      select: { occurredAt: true, amountCents: true },
    });

    const byDay = new Map<string, { netCents: number; count: number }>();
    for (const r of rows) {
      const key = r.occurredAt.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { netCents: 0, count: 0 };
      cur.netCents += r.amountCents;
      cur.count += 1;
      byDay.set(key, cur);
    }

    const points: { date: string; netCents: number; count: number }[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(Date.UTC(year, month - 1, d));
      const key = date.toISOString().slice(0, 10);
      const agg = byDay.get(key);
      points.push({
        date: key,
        netCents: agg?.netCents ?? 0,
        count: agg?.count ?? 0,
      });
    }

    return { year, month, points };
  }
}
