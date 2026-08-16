import { IsOptional, IsString } from 'class-validator';

export class UpdateDadosBancariosDto {
  @IsOptional()
  @IsString()
  chavePix?: string;

  @IsOptional()
  @IsString()
  banco?: string;

  @IsOptional()
  @IsString()
  agencia?: string;

  @IsOptional()
  @IsString()
  conta?: string;
}
