import { Module } from '@nestjs/common';
import { CronometragemController } from './cronometragem.controller';
import { CronometragemService } from './cronometragem.service';

@Module({
  controllers: [CronometragemController],
  providers: [CronometragemService],
  exports: [CronometragemService],
})
export class CronometragemModule {}
