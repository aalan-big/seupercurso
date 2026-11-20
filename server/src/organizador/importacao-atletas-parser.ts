import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

/** Uma linha da planilha como veio, so com os textos limpos. */
export interface LinhaPlanilhaAtleta {
  /** Numero da linha na planilha (1 = cabecalho), para o organizador achar. */
  linha: number;
  nome: string;
  cpf: string;
  /** yyyy-mm-dd, ou o texto original quando nao deu para entender. */
  dataNascimento: string;
  genero: string;
  modalidade: string;
  categoria: string;
  tamanhoCamisa: string;
  numeroPeito: string;
  email: string;
}

type Campo = Exclude<keyof LinhaPlanilhaAtleta, 'linha'>;

/** Limite de linhas por arquivo: evita travar a API com planilha gigante. */
export const MAX_LINHAS_IMPORTACAO = 5000;

// Cabecalhos aceitos. Cada site exporta com um nome; a ordem importa (o CPF
// antes do nome para "Nome" nao pegar "CPF do atleta" e vice-versa).
const CABECALHOS: Array<[Campo, RegExp]> = [
  ['cpf', /\bcpf\b/i],
  ['email', /e-?mail/i],
  ['dataNascimento', /(nasc|data\s*de\s*nasc|anivers)/i],
  ['genero', /^(sexo|g[eê]nero)/i],
  [
    'numeroPeito',
    /(peito|n[uú]mero\s*(de\s*)?peito|^n[ºo°]?\s*$|^bib|^numeral)/i,
  ],
  ['tamanhoCamisa', /(camis|tamanho|camiseta|shirt)/i],
  ['categoria', /^categ/i],
  ['modalidade', /^(modalidade|percurso|dist[aâ]ncia|prova)/i],
  ['nome', /(^nome|atleta|participante|corredor)/i],
];

function identificarColunas(
  celulas: string[],
): Partial<Record<Campo, number>> | null {
  const colunas: Partial<Record<Campo, number>> = {};
  celulas.forEach((texto, idx) => {
    const limpo = texto.trim();
    if (!limpo) return;
    const achado = CABECALHOS.find(
      ([campo, regex]) => colunas[campo] === undefined && regex.test(limpo),
    );
    if (achado) colunas[achado[0]] = idx;
  });
  // Cabecalho de verdade tem pelo menos nome e CPF.
  return colunas.nome !== undefined && colunas.cpf !== undefined
    ? colunas
    : null;
}

function montarLinha(
  numero: number,
  celulas: string[],
  colunas: Partial<Record<Campo, number>>,
): LinhaPlanilhaAtleta {
  const pegar = (campo: Campo) => {
    const idx = colunas[campo];
    return idx === undefined ? '' : (celulas[idx] ?? '').toString().trim();
  };
  return {
    linha: numero,
    nome: pegar('nome').replace(/\s+/g, ' '),
    cpf: pegar('cpf'),
    dataNascimento: normalizarData(pegar('dataNascimento')),
    genero: pegar('genero'),
    modalidade: pegar('modalidade'),
    categoria: pegar('categoria'),
    tamanhoCamisa: pegar('tamanhoCamisa'),
    numeroPeito: pegar('numeroPeito'),
    email: pegar('email'),
  };
}

/**
 * Le a planilha (Excel ou CSV) de atletas vendidos em outro site. Acha a linha
 * de cabecalho (precisa ter Nome e CPF), le as linhas abaixo e ignora as
 * vazias. Nao valida nada: isso e da `ImportacaoAtletasService`.
 */
export async function lerPlanilhaAtletas(
  buffer: Buffer,
  mimetype?: string,
  nomeArquivo?: string,
): Promise<LinhaPlanilhaAtleta[]> {
  const nome = (nomeArquivo || '').toLowerCase();
  const mime = (mimetype || '').toLowerCase();

  let tabela: string[][];
  if (nome.endsWith('.xlsx') || mime.includes('spreadsheetml')) {
    tabela = await lerExcel(buffer);
  } else if (
    nome.endsWith('.csv') ||
    nome.endsWith('.txt') ||
    mime.includes('csv') ||
    mime.startsWith('text/')
  ) {
    tabela = lerCsv(buffer.toString('utf-8'));
  } else {
    throw new BadRequestException(
      'Envie a planilha em Excel (.xlsx) ou CSV. Se o outro site exportou em .xls, abra no Excel e salve como .xlsx.',
    );
  }

  const linhas: LinhaPlanilhaAtleta[] = [];
  let colunas: Partial<Record<Campo, number>> | null = null;

  tabela.forEach((celulas, i) => {
    if (!colunas) {
      colunas = identificarColunas(celulas);
      return;
    }
    if (celulas.every((c) => !c || !c.trim())) return;
    linhas.push(montarLinha(i + 1, celulas, colunas));
  });

  if (!colunas) {
    throw new BadRequestException(
      'Não encontramos o cabeçalho da planilha. A primeira linha precisa ter pelo menos as colunas "Nome" e "CPF".',
    );
  }
  if (linhas.length === 0) {
    throw new BadRequestException(
      'A planilha não tem nenhum atleta abaixo do cabeçalho.',
    );
  }
  if (linhas.length > MAX_LINHAS_IMPORTACAO) {
    throw new BadRequestException(
      `A planilha tem ${linhas.length} atletas. Envie no máximo ${MAX_LINHAS_IMPORTACAO} por vez.`,
    );
  }
  return linhas;
}

async function lerExcel(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new BadRequestException(
      'Não foi possível abrir a planilha. Salve como .xlsx ou CSV e tente de novo.',
    );
  }
  // So a primeira aba: as outras costumam ser resumo ou financeiro.
  const planilha = workbook.worksheets[0];
  if (!planilha) return [];

  const tabela: string[][] = [];
  planilha.eachRow({ includeEmpty: true }, (linha, numero) => {
    const celulas: string[] = [];
    linha.eachCell({ includeEmpty: true }, (celula, coluna) => {
      celulas[coluna - 1] = textoDaCelula(celula);
    });
    tabela[numero - 1] = Array.from(celulas, (c) => c ?? '');
  });
  return Array.from(tabela, (l) => l ?? []);
}

function textoDaCelula(celula: ExcelJS.Cell): string {
  const valor = celula.value as unknown;
  // Data de verdade no Excel: vira yyyy-mm-dd sem passar pelo fuso.
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }
  // CPF digitado como numero perde o zero da frente (01234567890 -> 1234567890).
  if (typeof valor === 'number') {
    return String(valor);
  }
  return celula.text ? celula.text.toString() : '';
}

/** CSV com `;` (Excel brasileiro) ou `,`, com aspas. */
export function lerCsv(texto: string): string[][] {
  // Excel salva CSV com a marca BOM (U+FEFF) no inicio.
  const semBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const primeira = semBom.split(/\r?\n/, 1)[0] ?? '';
  const separador =
    (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const tabela: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;

  for (let i = 0; i < semBom.length; i++) {
    const c = semBom[i];
    if (aspas) {
      if (c === '"' && semBom[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === separador) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && semBom[i + 1] === '\n') i++;
      linha.push(campo);
      tabela.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo || linha.length) {
    linha.push(campo);
    tabela.push(linha);
  }
  return tabela;
}

/**
 * Data de nascimento em yyyy-mm-dd. Aceita dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa,
 * aaaa-mm-dd e o numero de serie do Excel. Ano com 2 digitos e ambiguo
 * (05 = 1905 ou 2005?): volta o texto como veio e a validacao recusa.
 */
export function normalizarData(texto: string): string {
  const t = (texto || '').trim();
  if (!t) return '';

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return montarData(+m[1], +m[2], +m[3]) ?? t;

  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return montarData(+m[3], +m[2], +m[1]) ?? t;

  // Numero de serie do Excel (dias desde 1899-12-30), quando a celula veio
  // como numero e nao como data.
  if (/^\d{4,5}$/.test(t)) {
    const serie = Number(t);
    if (serie > 1 && serie < 80000) {
      const data = new Date(Date.UTC(1899, 11, 30) + serie * 86400000);
      return data.toISOString().slice(0, 10);
    }
  }
  return t;
}

function montarData(ano: number, mes: number, dia: number): string | null {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** MASCULINO, FEMININO, OUTRO ou null quando nao da para saber. */
export function normalizarGenero(
  texto: string,
): 'MASCULINO' | 'FEMININO' | 'OUTRO' | null {
  const t = (texto || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!t) return null;
  if (['M', 'MASC', 'MASCULINO', 'H', 'HOMEM', 'MALE'].includes(t))
    return 'MASCULINO';
  if (['F', 'FEM', 'FEMININO', 'MULHER', 'FEMALE'].includes(t))
    return 'FEMININO';
  if (['O', 'OUTRO', 'OUTROS', 'NAO BINARIO', 'NB'].includes(t)) return 'OUTRO';
  return null;
}

/** CPF so com digitos, devolvendo o zero da frente que o Excel tira. */
export function normalizarCpf(texto: string): string {
  const digitos = (texto || '').replace(/\D/g, '');
  if (digitos.length >= 9 && digitos.length < 11)
    return digitos.padStart(11, '0');
  return digitos;
}

/** Texto para comparar nomes de modalidade/categoria ("5 KM" = "5km"). */
export function chaveTexto(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
