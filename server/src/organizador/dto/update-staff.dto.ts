import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  nome?: string;

  @IsOptional()
  @IsString()
  funcao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
