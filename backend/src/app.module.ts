import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { BillsModule } from './bills/bills.module';
import { HealthModule } from './health/health.module';
import { MessagesModule } from './messages/messages.module';
import { PayeesModule } from './payees/payees.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { RecipientsModule } from './recipients/recipients.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AccountsModule,
    TransfersModule,
    RecipientsModule,
    ProfileModule,
    PayeesModule,
    BillsModule,
    MessagesModule,
    HealthModule,
  ],
})
export class AppModule {}
