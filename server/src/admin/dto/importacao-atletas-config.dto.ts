import { IsBoolean } from 'class-validator';

export class ImportacaoAtletasConfigDto {
  // true: o organizador ve o botao "Importar atletas de outro site" neste evento.
  @IsBoolean()
  liberada: boolean;
}
