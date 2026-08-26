import { Module } from '@nestjs/common';
import { PagamentoModule } from '../pagamento/pagamento.module';
import { ArteService } from './arte.service';
import { ArteController } from './arte.controller';
import { ArteAdminController } from './arte-admin.controller';

@Module({
  imports: [PagamentoModule],
  controllers: [ArteController, ArteAdminController],
  providers: [ArteService],
})
export class ArteModule {}
