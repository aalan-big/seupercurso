import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DependenteController } from './dependente.controller';
import { DependenteService } from './dependente.service';

@Module({
  imports: [PrismaModule],
  controllers: [DependenteController],
  providers: [DependenteService],
  exports: [DependenteService],
})
export class DependenteModule {}
