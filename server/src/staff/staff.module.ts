import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { OrganizadorModule } from '../organizador/organizador.module';
import { StaffController } from './staff.controller';

@Module({
  imports: [StaffAuthModule, OrganizadorModule],
  controllers: [StaffController],
})
export class StaffModule {}
