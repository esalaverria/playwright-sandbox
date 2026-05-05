import { Module } from '@nestjs/common';
import { PayeesController } from './payees.controller';

@Module({
  controllers: [PayeesController],
})
export class PayeesModule {}
