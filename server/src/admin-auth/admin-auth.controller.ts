import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import {
  CurrentAdmin,
  type AuthenticatedAdmin,
} from './decorators/current-admin.decorator';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @UseGuards(AdminJwtGuard)
  @Get('me')
  getMe(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminAuthService.getPerfil(admin.adminId);
  }
}
