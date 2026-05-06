import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ProfileController } from './profile.controller';

@Module({
  imports: [AccountsModule],
  controllers: [ProfileController],
})
export class ProfileModule {}
