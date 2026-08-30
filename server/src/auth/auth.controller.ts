import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterCompletoDto } from './dto/register-completo.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { LoginDto } from './dto/login.dto';
import { ChangeSenhaDto } from './dto/change-senha.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('registro-completo')
  registrarCompleto(@Body() dto: RegisterCompletoDto) {
    return this.authService.registrarCompleto(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('check-email')
  checkEmail(@Body() dto: CheckEmailDto) {
    return this.authService.emailDisponivel(dto.email);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verificar-email')
  verificarEmail(@Body() dto: { token: string }) {
    return this.authService.verificarEmail(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('reenviar-verificacao')
  reenviarVerificacao(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.reenviarVerificacao(user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('esqueci-senha')
  solicitarRecuperacaoSenha(@Body() dto: { email: string }) {
    return this.authService.solicitarRecuperacaoSenha(dto.email);
  }

  @HttpCode(HttpStatus.OK)
  @Post('redefinir-senha')
  redefinirSenha(@Body() dto: { token: string; novaSenha: string }) {
    return this.authService.redefinirSenha(dto.token, dto.novaSenha);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getPerfil(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('senha')
  alterarSenha(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeSenhaDto,
  ) {
    return this.authService.alterarSenha(user.userId, dto);
  }
}
