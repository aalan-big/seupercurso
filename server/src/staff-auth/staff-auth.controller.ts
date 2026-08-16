import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { StaffAuthService } from './staff-auth.service';
import { StaffLoginDto } from './dto/staff-login.dto';

@Controller('staff-auth')
export class StaffAuthController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: StaffLoginDto) {
    return this.staffAuthService.login(dto);
  }
}
