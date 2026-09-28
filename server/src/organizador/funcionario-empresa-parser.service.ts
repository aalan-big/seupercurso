import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface FuncionarioExtraido {
  matricula: string;
  nome?: string;
  cpf?: string;
}

export interface ResultadoExtracaoFuncionarios {
  totalEncontrados: number;
  funcionarios: FuncionarioExtraido[];
  linhasIgnoradas: number;
  /** Matriculas que apareceram mais de uma vez no arquivo (vale a ultima). */
  matriculasRepetidas: number;
}

// Cabecalhos aceitos. Empresas chamam a matricula de muitos jeitos: a Dakota,
// por exemplo, manda "Contrato" (o numero do cracha).
const CABECALHO_MATRICULA =
  /^(matr|contrato|crach|chapa|registro|re$|c[oó]d|id\s*funcional|n[uú]mero\s*funcional)/i;
const CABECALHO_NOME = /^(nome|funcion[aá]rio|colaborador|empregado|servidor)/i;
const CABECALHO_CPF = /cpf/i;

// Codigo de matricula: sem espacos, ate 20 caracteres, com ao menos um digito.
const REGEX_MATRICULA = /^(?=[0-9A-Za-z./\-]*\d)[0-9A-Za-z][0-9A-Za-z./\-]{0,19}$/;
// Nome: ao menos duas palavras so com letras.
const REGEX_NOME = /^[A-Za-zÀ-ÿ'´`^~]{2,}(?:\s+[A-Za-zÀ-ÿ'´`^~]+)+$/;
const REGEX_CPF_FORMATADO = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;
const REGEX_CPF_NUMEROS = /\b\d{11}\b/;
const CABECALHOS_DE_RELATORIO =
  /^(PREFEITURA|GOVERNO|ESTADO|SECRETARIA|RELA[CÇ][AÃ]O|RELAT[OÓ]RIO|DI[AÁ]RIO|OFICIAL|NOME|CPF|MATR[IÍ]CULA|CONTRATO|P[AÁ]GINA|EMPRESA)\b/i;

/**
 * Leitor da lista de funcionarios do desconto da empresa organizadora.
 *
 * Separado do leitor do servidor publico, que continua exigindo CPF: aqui a
 * chave e a MATRICULA (ou contrato/cracha) e o CPF e opcional, porque o RH das
 * empresas costuma mandar so matricula e nome.
 *
 * Toda linha aceita precisa de matricula e de nome ou CPF: so um numero solto
 * (data, pagina, codigo de relatorio) nao vira funcionario.
 */
@Injectable()
export class FuncionarioEmpresaParserService {
  private readonly logger = new Logger(FuncionarioEmpresaParserService.name);

  async parseArquivo(
    buffer: Buffer,
    mimetype?: string,
    originalname?: string,
  ): Promise<ResultadoExtracaoFuncionarios> {
    const nome = (originalname || '').toLowerCase();
    const mime = (mimetype || '').toLowerCase();

    if (mime.includes('pdf') || nome.endsWith('.pdf')) {
      return this.parsePdf(buffer);
    }

    if (
      mime.includes('spreadsheet') ||
      mime.includes('excel') ||
      nome.endsWith('.xlsx') ||
      nome.endsWith('.xls')
    ) {
      return this.parseExcel(buffer);
    }

    return this.extrairDeTexto(buffer.toString('utf-8'));
  }

  async parsePdf(buffer: Buffer): Promise<ResultadoExtracaoFuncionarios> {
    let texto = '';
    try {
      const pdfModule = require('pdf-parse');
      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        try {
          const res = await parser.getText();
          texto = typeof res === 'string' ? res : res?.text || '';
        } finally {
          if (typeof parser.destroy === 'function') {
            await parser.destroy();
          }
        }
      } else if (typeof pdfModule === 'function') {
        const res = await pdfModule(buffer);
        texto = res.text || '';
      }
    } catch (err: any) {
      this.logger.error(`Erro ao extrair texto do PDF: ${err.message}`, err.stack);
      throw new BadRequestException(
        'Não foi possível ler o arquivo PDF. Verifique se ele não está corrompido ou protegido por senha.',
      );
    }

    // PDF digitalizado ou "impresso como imagem": so sobram os marcadores de
    // pagina ("-- 1 of 26 --"). Avisar isso e melhor que "nenhum funcionario".
    const semMarcadores = texto.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '').trim();
    if (semMarcadores.length < 10) {
      throw new BadRequestException(
        'Este PDF é uma imagem (digitalizado ou salvo como foto) e não tem texto para ler. Peça ao RH a lista em Excel ou CSV, ou um PDF gerado direto pelo sistema.',
      );
    }

    return this.extrairDeTexto(texto);
  }

  async parseExcel(buffer: Buffer): Promise<ResultadoExtracaoFuncionarios> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch (err: any) {
      this.logger.error(`Erro ao abrir planilha: ${err.message}`, err.stack);
      throw new BadRequestException(
        'Não foi possível abrir a planilha. Salve como .xlsx ou CSV e tente de novo.',
      );
    }

    const acumulador = novoAcumulador();

    workbook.eachSheet((planilha) => {
      let colMatricula = -1;
      let colNome = -1;
      let colCpf = -1;

      planilha.eachRow((linha) => {
        const celulas: string[] = [];
        linha.eachCell({ includeEmpty: true }, (celula) => {
          celulas.push(celula.text ? celula.text.toString().trim() : '');
        });

        // Linha de cabecalho: descobre as colunas e segue para a proxima.
        if (colMatricula === -1) {
          const idx = celulas.findIndex((c) => CABECALHO_MATRICULA.test(c));
          if (idx !== -1) {
            colMatricula = idx;
            colNome = celulas.findIndex((c) => CABECALHO_NOME.test(c));
            colCpf = celulas.findIndex((c) => CABECALHO_CPF.test(c));
            return;
          }
        }

        if (colMatricula !== -1) {
          acumulador.adicionar(
            celulas[colMatricula],
            colNome !== -1 ? celulas[colNome] : undefined,
            colCpf !== -1 ? celulas[colCpf] : undefined,
          );
          return;
        }

        // Planilha sem cabecalho reconhecido: tenta pelas celulas da linha.
        acumulador.adicionarTokens(celulas);
      });
    });

    return acumulador.resultado();
  }

  extrairDeTexto(texto: string): ResultadoExtracaoFuncionarios {
    const acumulador = novoAcumulador();

    for (const original of texto.split(/\r?\n/)) {
      const linha = original.trim();
      if (!linha) continue;

      // CSV/TXT com separador: cada campo e um token.
      if (/[;\t|,]/.test(linha)) {
        acumulador.adicionarTokens(linha.split(/[;\t|,]/).map((t) => t.trim()));
        continue;
      }

      // Linha de relatorio: "18 Jose Uchoa de Lima", "Jose Uchoa de Lima 18",
      // opcionalmente com CPF no meio.
      const cpfMatch = linha.match(REGEX_CPF_FORMATADO) || linha.match(REGEX_CPF_NUMEROS);
      const semCpf = cpfMatch ? linha.replace(cpfMatch[0], ' ').replace(/\s+/g, ' ').trim() : linha;
      const cpf = cpfMatch?.[0];

      const explicita = semCpf.match(
        /^(.*?)(?:matr[ií]cula|contrato|crach[aá])\s*(?:n[º°o]\.?)?\s*[:.\-]?\s*(\S+)\s*(.*)$/i,
      );
      if (explicita) {
        acumulador.adicionar(explicita[2], `${explicita[1]} ${explicita[3]}`.trim(), cpf);
        continue;
      }

      const inicio = semCpf.match(/^(\S+)\s+(.+)$/);
      if (inicio && REGEX_MATRICULA.test(inicio[1])) {
        acumulador.adicionar(inicio[1], inicio[2], cpf);
        continue;
      }

      const fim = semCpf.match(/^(.+?)\s+(\S+)$/);
      if (fim && REGEX_MATRICULA.test(fim[2])) {
        acumulador.adicionar(fim[2], fim[1], cpf);
        continue;
      }

      acumulador.ignorar();
    }

    return acumulador.resultado();
  }
}

function limparNome(bruto?: string): string | undefined {
  const nome = (bruto || '').replace(/\s+/g, ' ').trim();
  if (!REGEX_NOME.test(nome) || CABECALHOS_DE_RELATORIO.test(nome)) return undefined;
  return nome;
}

function limparCpf(bruto?: string): string | undefined {
  const digitos = (bruto || '').replace(/\D/g, '');
  return digitos.length === 11 ? digitos : undefined;
}

function novoAcumulador() {
  const porMatricula = new Map<string, FuncionarioExtraido>();
  let linhasIgnoradas = 0;
  let matriculasRepetidas = 0;

  function adicionar(matriculaBruta?: string, nomeBruto?: string, cpfBruto?: string) {
    const matricula = (matriculaBruta || '').trim();
    const nome = limparNome(nomeBruto);
    const cpf = limparCpf(cpfBruto);

    // CPF nunca e matricula (planilha com as colunas trocadas).
    if (!REGEX_MATRICULA.test(matricula) || limparCpf(matricula) || (!nome && !cpf)) {
      linhasIgnoradas++;
      return;
    }

    const chave = matricula.toUpperCase();
    if (porMatricula.has(chave)) matriculasRepetidas++;
    porMatricula.set(chave, { matricula, nome, cpf });
  }

  /** Linha sem colunas conhecidas: acha CPF, matricula e nome pelas celulas. */
  function adicionarTokens(tokens: string[]) {
    const cpf = tokens.map(limparCpf).find(Boolean);
    const matricula = tokens.find((t) => REGEX_MATRICULA.test(t) && !limparCpf(t));
    const nome = tokens.map(limparNome).find(Boolean);
    if (!matricula && !nome && !cpf) return; // linha vazia ou decorativa
    adicionar(matricula, nome, cpf);
  }

  return {
    adicionar,
    adicionarTokens,
    ignorar: () => {
      linhasIgnoradas++;
    },
    resultado: (): ResultadoExtracaoFuncionarios => {
      const funcionarios = Array.from(porMatricula.values());
      return {
        totalEncontrados: funcionarios.length,
        funcionarios,
        linhasIgnoradas,
        matriculasRepetidas,
      };
    },
  };
}
