import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemChipDto {
  @IsInt({ message: 'O número de peito deve ser um número inteiro.' })
  numeroPeito: number;

  @IsString({ message: 'A tag EPC deve ser uma string.' })
  @IsNotEmpty({ message: 'A tag EPC não pode estar vazia.' })
  tagEpc: string;
}

export class ImportarChipsDto {
  @IsOptional()
  @IsString()
  csvContent?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemChipDto)
  chips?: ItemChipDto[];

  @IsOptional()
  @IsBoolean()
  substituir?: boolean;
}

/** Item no formato do Mark (snake_case, como o download de inscritos). */
export class ItemChipMarkDto {
  @IsInt({ message: 'O número de peito deve ser um número inteiro.' })
  @Min(1, { message: 'O número de peito deve ser maior que zero.' })
  numero_peito: number;

  @IsString({ message: 'A tag EPC deve ser uma string.' })
  @IsNotEmpty({ message: 'A tag EPC não pode estar vazia.' })
  @MaxLength(64, { message: 'A tag EPC pode ter no máximo 64 caracteres.' })
  tag_epc: string;
}

export class EnviarChipsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Envie ao menos um chip.' })
  @ArrayMaxSize(20000, { message: 'Envie no máximo 20.000 chips por vez.' })
  @ValidateNested({ each: true })
  @Type(() => ItemChipMarkDto)
  chips: ItemChipMarkDto[];

  /** true apaga todos os chips da prova antes de gravar. Padrão: só troca os enviados. */
  @IsOptional()
  @IsBoolean()
  substituir?: boolean;
}
