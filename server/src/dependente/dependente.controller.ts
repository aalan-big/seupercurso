import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { DependenteService } from './dependente.service';
import { CreateDependenteDto } from './dto/create-dependente.dto';
import { UpdateDependenteDto } from './dto/update-dependente.dto';

@Controller('dependentes')
@UseGuards(JwtAuthGuard)
export class DependenteController {
  constructor(private readonly dependenteService: DependenteService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDependenteDto,
  ) {
    return this.dependenteService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.dependenteService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dependenteService.findOne(user.userId, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDependenteDto,
  ) {
    return this.dependenteService.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dependenteService.remove(user.userId, id);
  }
}
