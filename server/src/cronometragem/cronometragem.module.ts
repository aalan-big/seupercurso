import { Module } from '@nestjs/common';
import { CronometragemController } from './cronometragem.controller';
import { CronometragemService } from './cronometragem.service';
import { LicencaService } from './licenca.service';

@Module({
  controllers: [CronometragemController],
  providers: [CronometragemService, LicencaService],
  exports: [CronometragemService],
})
export class CronometragemModule {}
