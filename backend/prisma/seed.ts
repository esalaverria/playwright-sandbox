import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient, AccountType, LedgerStatus, PaymentStatus } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for prisma db seed');
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PASSWORD = 'Test123!';

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
            balanceCents: 243581,
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
            balanceCents: -15000,
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
            balanceCents: 500,
          },
          {
            type: AccountType.SAVINGS,
            nickname: 'Savings',
            mask: '••2101',
            balanceCents: 50000,
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
          balanceCents: 100000,
        },
      },
    },
    include: { accounts: true },
  });

  await prisma.user.create({
    data: {
      email: 'eve@example.com',
      passwordHash: hash,
      fullName: 'Eve Duplicate',
      locked: false,
      accounts: {
        create: {
          type: AccountType.CHECKING,
          nickname: 'Checking',
          mask: '••5500',
          balanceCents: 500000,
        },
      },
    },
  });

  const aliceChecking = alice.accounts.find((a) => a.type === AccountType.CHECKING)!;
  const aliceSavings = alice.accounts.find((a) => a.type === AccountType.SAVINGS)!;
  const aliceCredit = alice.accounts.find((a) => a.type === AccountType.CREDIT)!;

  await prisma.ledgerEntry.createMany({
    data: [
      {
        accountId: aliceChecking.id,
        description: 'Opening deposit',
        amountCents: 250000,
        balanceAfterCents: 250000,
        status: LedgerStatus.POSTED,
      },
      {
        accountId: aliceChecking.id,
        description: 'Card · Cloud Market',
        amountCents: -6419,
        balanceAfterCents: 243581,
        status: LedgerStatus.POSTED,
      },
      {
        accountId: aliceSavings.id,
        description: 'Transfer from checking',
        amountCents: 100000,
        balanceAfterCents: 100000,
        status: LedgerStatus.POSTED,
      },
      {
        accountId: aliceCredit.id,
        description: 'Purchase · Apex Airlines',
        amountCents: -41256,
        balanceAfterCents: -15000,
        status: LedgerStatus.POSTED,
      },
    ],
  });

  const bobChecking = bob.accounts.find((a) => a.type === AccountType.CHECKING)!;

  await prisma.ledgerEntry.createMany({
    data: [
      {
        accountId: bobChecking.id,
        description: 'Opening deposit',
        amountCents: 500,
        balanceAfterCents: 500,
        status: LedgerStatus.POSTED,
      },
    ],
  });

  await prisma.ledgerEntry.create({
    data: {
      accountId: dan.accounts[0].id,
      description: 'Welcome deposit',
      amountCents: 100000,
      balanceAfterCents: 100000,
      status: LedgerStatus.POSTED,
    },
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
