import { Module } from '@nestjs/common';
import { TransfersModule } from '../transfers/transfers.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [TransfersModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
