import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import {
  PrismaClient,
  AccountType,
  LedgerStatus,
  PaymentStatus,
  type Account,
} from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for prisma db seed');
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PASSWORD = 'Test123!';

function utc(y: number, monthIndex: number, day: number, h = 12, min = 0, sec = 0) {
  return new Date(Date.UTC(y, monthIndex, day, h, min, sec));
}

async function main() {
  await prisma.ledgerEntry.deleteMany();
  await prisma.scheduledPayment.deleteMany();
  await prisma.payee.deleteMany();
  await prisma.message.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);

  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      passwordHash: hash,
      fullName: 'Alice Primary',
      phone: '+1 555 0100',
      locked: false,
      accounts: {
        create: [
          {
            type: AccountType.CHECKING,
            nickname: 'River checking',
            mask: '••8721',
            balanceCents: 0,
          },
          {
            type: AccountType.SAVINGS,
            nickname: 'Growth savings',
            mask: '••0914',
            balanceCents: 100000,
          },
          {
            type: AccountType.CREDIT,
            nickname: 'Travel rewards',
            mask: '••4410',
            balanceCents: 0,
            creditLimitCents: 500000,
            allowOverLimit: false,
            frozen: false,
          },
        ],
      },
    },
    include: { accounts: true },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      passwordHash: hash,
      fullName: 'Bob Thin',
      locked: false,
      accounts: {
        create: [
          {
            type: AccountType.CHECKING,
            nickname: 'Checking',
            mask: '••2100',
            balanceCents: 0,
          },
          {
            type: AccountType.SAVINGS,
            nickname: 'Savings',
            mask: '••2101',
            balanceCents: 50000,
          },
          {
            type: AccountType.CREDIT,
            nickname: 'Starter card',
            mask: '••2102',
            balanceCents: 0,
            creditLimitCents: 100000,
            allowOverLimit: false,
            frozen: false,
          },
        ],
      },
    },
    include: { accounts: true },
  });

  await prisma.user.create({
    data: {
      email: 'carol@example.com',
      passwordHash: hash,
      fullName: 'Carol Locked',
      locked: true,
      accounts: {
        create: {
          type: AccountType.CHECKING,
          nickname: 'Checking',
          mask: '••3300',
          balanceCents: 100000,
        },
      },
    },
  });

  const dan = await prisma.user.create({
    data: {
      email: 'dan@example.com',
      passwordHash: hash,
      fullName: 'Dan Fresh',
      locked: false,
      accounts: {
        create: {
          type: AccountType.CHECKING,
          nickname: 'Checking',
          mask: '••4400',
          balanceCents: 0,
        },
      },
    },
    include: { accounts: true },
  });

  const eve = await prisma.user.create({
    data: {
      email: 'eve@example.com',
      passwordHash: hash,
      fullName: 'Eve Duplicate',
      locked: false,
      accounts: {
        create: [
          {
            type: AccountType.CHECKING,
            nickname: 'Checking',
            mask: '••5500',
            balanceCents: 0,
          },
          {
            type: AccountType.CREDIT,
            nickname: 'Business card',
            mask: '••5501',
            balanceCents: 0,
            creditLimitCents: 250000,
            allowOverLimit: false,
            frozen: false,
          },
        ],
      },
    },
    include: { accounts: true },
  });

  const aliceChecking = alice.accounts.find((a: Account) => a.type === AccountType.CHECKING)!;
  const aliceSavings = alice.accounts.find((a: Account) => a.type === AccountType.SAVINGS)!;
  const aliceCredit = alice.accounts.find((a: Account) => a.type === AccountType.CREDIT)!;
  const bobChecking = bob.accounts.find((a: Account) => a.type === AccountType.CHECKING)!;
  const bobSavings = bob.accounts.find((a: Account) => a.type === AccountType.SAVINGS)!;
  const bobCredit = bob.accounts.find((a: Account) => a.type === AccountType.CREDIT)!;
  const danChecking = dan.accounts[0]!;
  const eveChecking = eve.accounts.find((a: Account) => a.type === AccountType.CHECKING)!;
  const eveCredit = eve.accounts.find((a: Account) => a.type === AccountType.CREDIT)!;

  type Row = {
    accountId: string;
    description: string;
    amountCents: number;
    balanceAfterCents: number;
    status: LedgerStatus;
    occurredAt: Date;
  };

  function buildChain(accountId: string, ops: { desc: string; amt: number; at: Date }[]): Row[] {
    let bal = 0;
    const out: Row[] = [];
    for (const o of ops) {
      bal += o.amt;
      out.push({
        accountId,
        description: o.desc,
        amountCents: o.amt,
        balanceAfterCents: bal,
        status: LedgerStatus.POSTED,
        occurredAt: o.at,
      });
    }
    return out;
  }

  const aliceCheckingOps: { desc: string; amt: number; at: Date }[] = [
    { desc: 'Opening deposit', amt: 250000, at: utc(2026, 3, 28, 9, 0) },
    { desc: 'Card · Cloud Market', amt: -6419, at: utc(2026, 4, 1, 9, 30) },
  ];
  for (let i = 0; i < 40; i++) {
    const day = 2 + (i % 27);
    aliceCheckingOps.push({
      desc: `POS · Merchant ${i + 1}`,
      amt: -(400 + (i % 12) * 75),
      at: utc(2026, 4, day, 10 + (i % 10), i % 60),
    });
  }
  const aliceCheckingRows = buildChain(aliceChecking.id, aliceCheckingOps);

  const aliceSavingsRows = buildChain(aliceSavings.id, [
    { desc: 'Transfer from checking', amt: 100000, at: utc(2026, 4, 5, 8, 15) },
    { desc: 'Interest', amt: 42, at: utc(2026, 4, 28, 0, 1) },
  ]);

  const aliceCreditOps: { desc: string; amt: number; at: Date }[] = [
    { desc: 'Purchase · Apex Airlines', amt: -8500, at: utc(2026, 4, 3, 14, 20) },
    { desc: 'Purchase · Harbor Café', amt: -2100, at: utc(2026, 4, 7, 18, 5) },
    { desc: 'Subscription · StreamMax', amt: -1599, at: utc(2026, 4, 10, 6, 0) },
  ];
  for (let i = 0; i < 18; i++) {
    aliceCreditOps.push({
      desc: `Online · Retail ${i + 1}`,
      amt: -(1200 + (i % 8) * 150),
      at: utc(2026, 4, 4 + (i % 24), 15 + (i % 6), (i * 3) % 60),
    });
  }
  aliceCreditOps.push({
    desc: 'Card payment ← River checking',
    amt: 8000,
    at: utc(2026, 4, 18, 11, 0),
  });
  const aliceCreditRows = buildChain(aliceCredit.id, aliceCreditOps);

  const bobCheckingOps: { desc: string; amt: number; at: Date }[] = [
    { desc: 'Opening deposit', amt: 500, at: utc(2026, 3, 15, 12, 0) },
  ];
  for (let i = 0; i < 22; i++) {
    bobCheckingOps.push({
      desc: `Debit · Shop ${i + 1}`,
      amt: -(45 + (i % 6) * 20),
      at: utc(2026, 4, 1 + (i % 30), 13 + (i % 5), i % 60),
    });
  }
  bobCheckingOps.push({ desc: 'Payroll deposit', amt: 320000, at: utc(2026, 4, 12, 8, 0) });
  const bobCheckingRows = buildChain(bobChecking.id, bobCheckingOps);

  const bobSavingsRows = buildChain(bobSavings.id, [
    { desc: 'Seed deposit', amt: 50000, at: utc(2026, 2, 1) },
  ]);

  const bobCreditOps: { desc: string; amt: number; at: Date }[] = [];
  for (let i = 0; i < 12; i++) {
    bobCreditOps.push({
      desc: `Swipe · Local ${i + 1}`,
      amt: -(800 + i * 120),
      at: utc(2026, 4, 2 + (i % 20), 16, i * 4),
    });
  }
  const bobCreditRows = buildChain(bobCredit.id, bobCreditOps);

  const danOps: { desc: string; amt: number; at: Date }[] = [
    { desc: 'Welcome deposit', amt: 100000, at: utc(2026, 4, 2) },
  ];
  for (let i = 0; i < 30; i++) {
    danOps.push({
      desc: `Activity · Line ${i + 1}`,
      amt: i % 4 === 0 ? 5000 : -(300 + (i % 9) * 40),
      at: utc(2026, 4, 3 + (i % 28), 9 + (i % 8), i % 60),
    });
  }
  const danRows = buildChain(danChecking.id, danOps);

  const eveCheckingOps: { desc: string; amt: number; at: Date }[] = [
    { desc: 'Wire in', amt: 500000, at: utc(2026, 4, 1) },
  ];
  for (let i = 0; i < 25; i++) {
    eveCheckingOps.push({
      desc: `Bill pay · Vendor ${i + 1}`,
      amt: -(5000 + (i % 7) * 800),
      at: utc(2026, 4, 4 + (i % 25), 14, i % 60),
    });
  }
  const eveCheckingRows = buildChain(eveChecking.id, eveCheckingOps);

  const eveCreditOps: { desc: string; amt: number; at: Date }[] = [];
  for (let i = 0; i < 15; i++) {
    eveCreditOps.push({
      desc: `Corp expense · Trip ${i + 1}`,
      amt: -(4000 + i * 350),
      at: utc(2026, 4, 5 + (i % 22), 11, (i * 7) % 60),
    });
  }
  const eveCreditRows = buildChain(eveCredit.id, eveCreditOps);

  await prisma.account.update({
    where: { id: aliceChecking.id },
    data: { balanceCents: aliceCheckingRows[aliceCheckingRows.length - 1]!.balanceAfterCents },
  });
  await prisma.account.update({
    where: { id: aliceSavings.id },
    data: { balanceCents: aliceSavingsRows[aliceSavingsRows.length - 1]!.balanceAfterCents },
  });
  await prisma.account.update({
    where: { id: aliceCredit.id },
    data: { balanceCents: aliceCreditRows[aliceCreditRows.length - 1]!.balanceAfterCents },
  });
  await prisma.account.update({
    where: { id: bobChecking.id },
    data: { balanceCents: bobCheckingRows[bobCheckingRows.length - 1]!.balanceAfterCents },
  });
  await prisma.account.update({
    where: { id: bobSavings.id },
    data: { balanceCents: bobSavingsRows[bobSavingsRows.length - 1]!.balanceAfterCents },
  });
  await prisma.account.update({
    where: { id: bobCredit.id },
    data: { balanceCents: bobCreditRows[bobCreditRows.length - 1]!.balanceAfterCents },
  });
  await prisma.account.update({
    where: { id: danChecking.id },
    data: { balanceCents: danRows[danRows.length - 1]!.balanceAfterCents },
  });
  await prisma.account.update({
    where: { id: eveChecking.id },
    data: { balanceCents: eveCheckingRows[eveCheckingRows.length - 1]!.balanceAfterCents },
  });
  await prisma.account.update({
    where: { id: eveCredit.id },
    data: { balanceCents: eveCreditRows[eveCreditRows.length - 1]!.balanceAfterCents },
  });

  await prisma.ledgerEntry.createMany({
    data: [
      ...aliceCheckingRows,
      ...aliceSavingsRows,
      ...aliceCreditRows,
      ...bobCheckingRows,
      ...bobSavingsRows,
      ...bobCreditRows,
      ...danRows,
      ...eveCheckingRows,
      ...eveCreditRows,
    ],
  });

  await prisma.payee.createMany({
    data: [
      {
        userId: alice.id,
        displayName: 'City Utilities',
        nickname: 'Electric',
        externalRef: 'CHK ••7788',
      },
      {
        userId: alice.id,
        displayName: 'North Rent LLC',
        nickname: 'Landlord',
        externalRef: 'ACH ••9901',
      },
    ],
  });

  await prisma.scheduledPayment.createMany({
    data: [
      {
        userId: alice.id,
        billerName: 'City Utilities',
        fromAccountId: aliceChecking.id,
        amountCents: 12500,
        dueDate: new Date('2026-06-01'),
        status: PaymentStatus.SCHEDULED,
        memo: 'June cycle',
      },
      {
        userId: alice.id,
        billerName: 'Streaming Co',
        fromAccountId: aliceChecking.id,
        amountCents: 1599,
        dueDate: new Date('2026-04-15'),
        status: PaymentStatus.PAID,
        memo: 'Paid early',
      },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        userId: alice.id,
        subject: 'Statement ready',
        body: 'Your March statement is available under Statements.',
        readAt: null,
      },
      {
        userId: alice.id,
        subject: 'Security tip',
        body: 'Enable alerts for large transfers.',
        readAt: null,
      },
      {
        userId: alice.id,
        subject: 'Welcome',
        body: 'Thanks for banking with NorthPeak.',
        readAt: new Date(),
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete. Dev password for all seeded users:', PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
