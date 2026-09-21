import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ServidorExtraido {
  cpf: string;
  matricula: string;
  nome?: string;
  orgao?: string;
}

export interface ResultadoExtracaoServidores {
  totalEncontrados: number;
  servidores: ServidorExtraido[];
  linhasIgnoradas: number;
}

@Injectable()
export class ServidorPublicoParserService {
  private readonly logger = new Logger(ServidorPublicoParserService.name);

  async parseArquivo(
    buffer: Buffer,
    mimetype?: string,
    originalname?: string,
  ): Promise<ResultadoExtracaoServidores> {
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

    // Default: tratar como texto / CSV
    return this.parseCsvOuTexto(buffer.toString('utf-8'));
  }

  async parsePdf(buffer: Buffer): Promise<ResultadoExtracaoServidores> {
    try {
      const pdfModule = require('pdf-parse');
      let textoCompleto = '';

      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        try {
          const res = await parser.getText();
          textoCompleto = typeof res === 'string' ? res : res?.text || '';
        } finally {
          if (typeof parser.destroy === 'function') {
            await parser.destroy();
          }
        }
      } else if (typeof pdfModule === 'function') {
        const res = await pdfModule(buffer);
        textoCompleto = res.text || '';
      }

      return this.extrairDeTexto(textoCompleto);
    } catch (err: any) {
      this.logger.error(`Erro ao extrair texto do PDF: ${err.message}`, err.stack);
      throw new Error(
        `Não foi possível ler o arquivo PDF. Verifique se o arquivo não está corrompido ou protegido por senha. Detalhes: ${err.message}`,
      );
    }
  }

  async parseExcel(buffer: Buffer): Promise<ResultadoExtracaoServidores> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const servidoresMap = new Map<string, ServidorExtraido>();
      let linhasIgnoradas = 0;

      workbook.eachSheet((worksheet) => {
        let headerRowIdx = 1;
        let colCpf = -1;
        let colMatricula = -1;
        let colNome = -1;
        let colOrgao = -1;

        worksheet.eachRow((row, rowNumber) => {
          const values: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            values.push(cell.text ? cell.text.toString().trim() : '');
          });

          // Identificar cabeçalhos se ainda não identificados
          if (colCpf === -1 || colMatricula === -1) {
            values.forEach((v, idx) => {
              const lower = v.toLowerCase();
              if (lower === 'cpf' || lower.includes('cpf')) colCpf = idx + 1;
              else if (
                lower.includes('matr') ||
                lower === 'matricula' ||
                lower === 'mat'
              )
                colMatricula = idx + 1;
              else if (lower === 'nome' || lower.includes('servidor') || lower.includes('atleta'))
                colNome = idx + 1;
              else if (lower.includes('orgao') || lower.includes('secretaria') || lower.includes('setor'))
                colOrgao = idx + 1;
            });
            if (colCpf !== -1 && colMatricula !== -1) {
              headerRowIdx = rowNumber;
              return;
            }
          }

          if (rowNumber <= headerRowIdx && colCpf !== -1) return;

          let rawCpf = colCpf !== -1 ? (row.getCell(colCpf).text || '').trim() : '';
          let rawMatricula = colMatricula !== -1 ? (row.getCell(colMatricula).text || '').trim() : '';
          let rawNome = colNome !== -1 ? (row.getCell(colNome).text || '').trim() : '';
          let rawOrgao = colOrgao !== -1 ? (row.getCell(colOrgao).text || '').trim() : '';

          // Se não encontrou por coluna nomeada, busca heurística nas células
          if (!rawCpf || !rawMatricula) {
            for (const val of values) {
              const digits = val.replace(/\D/g, '');
              if (digits.length === 11 && !rawCpf) {
                rawCpf = digits;
              } else if (/^\d{3,12}$/.test(digits) && digits.length !== 11 && !rawMatricula) {
                rawMatricula = val;
              } else if (/^[A-Za-zÀ-ÿ\s]{4,}$/.test(val) && !rawNome) {
                rawNome = val;
              }
            }
          }

          const cpf = rawCpf.replace(/\D/g, '');
          const matricula = rawMatricula.trim();

          if (cpf.length === 11 && matricula) {
            servidoresMap.set(cpf, {
              cpf,
              matricula,
              nome: rawNome || undefined,
              orgao: rawOrgao || undefined,
            });
          } else {
            linhasIgnoradas++;
          }
        });
      });

      const servidores = Array.from(servidoresMap.values());
      return {
        totalEncontrados: servidores.length,
        servidores,
        linhasIgnoradas,
      };
    } catch (err: any) {
      this.logger.error(`Erro ao processar planilha Excel: ${err.message}`, err.stack);
      throw new Error(`Não foi possível processar a planilha: ${err.message}`);
    }
  }

  parseCsvOuTexto(conteudo: string): ResultadoExtracaoServidores {
    return this.extrairDeTexto(conteudo);
  }

  extrairDeTexto(texto: string): ResultadoExtracaoServidores {
    const linhas = texto.split(/\r?\n/);
    const servidoresMap = new Map<string, ServidorExtraido>();
    let linhasIgnoradas = 0;

    const regexCpfFormatado = /\b(\d{3}\.?\d{3}\.?\d{3}[-\s]?\d{2})\b/;
    const regexCpfNumeros = /\b(\d{11})\b/;

    for (const linhaOriginal of linhas) {
      const linha = linhaOriginal.trim();
      if (!linha || linha.length < 10) {
        continue;
      }

      // Procura CPF na linha
      const matchCpf = linha.match(regexCpfFormatado) || linha.match(regexCpfNumeros);
      if (!matchCpf) {
        linhasIgnoradas++;
        continue;
      }

      const cpfBruto = matchCpf[0];
      const cpf = cpfBruto.replace(/\D/g, '');
      if (cpf.length !== 11) {
        linhasIgnoradas++;
        continue;
      }

      // Remove o CPF da linha para extrair os demais dados
      const restante = linha.replace(cpfBruto, ' ').trim();

      // Divide o restante por delimitadores comuns (ponto-e-vírgula, vírgula, tab, múltiplos espaços)
      let tokens = restante
        .split(/[;\t,|]|\s{2,}/)
        .map((t) => t.trim())
        .filter(Boolean);

      let matricula = '';
      let nome = '';

      // Tenta padrão explícito: "Matrícula: 12345" ou "Mat: 12345"
      const matchMatriculaExplicita = restante.match(/(?:matr[ií]cula|matr\.?|mat:?)\s*([0-9A-Za-z\-_/]+)/i);
      if (matchMatriculaExplicita) {
        matricula = matchMatriculaExplicita[1].trim();
      }

      if (!matricula) {
        // Procura primeiro token numérico ou código de matrícula (3 a 12 caracteres com dígitos)
        for (const token of tokens) {
          const limpo = token.replace(/^[^\w]+|[^\w]+$/g, '');
          if (/^[0-9]{3,12}(?:[-/][0-9A-Za-z])?$/.test(limpo)) {
            matricula = limpo;
            break;
          }
        }
      }

      // Se ainda não achou, pega qualquer sequência de dígitos de 3 a 10 caracteres no restante
      if (!matricula) {
        const matchDigitos = restante.match(/\b([0-9]{3,10}(?:[-/][0-9A-Za-z])?)\b/);
        if (matchDigitos) {
          matricula = matchDigitos[1];
        }
      }

      // Nome: busca o token de texto com palavras
      const partesSemMatricula = restante.replace(matricula, ' ').trim();
      const matchNome = partesSemMatricula.match(/([A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,})+)/);
      if (matchNome) {
        const candidatoNome = matchNome[1].trim();
        // Filtra cabeçalhos comuns
        if (
          !/^(PREFEITURA|GOVERNO|ESTADO|SECRETARIA|RELAT[OÓ]RIO|DI[AÁ]RIO|OFICIAL|SERVIDOR|NOME|CPF|MATR[IÍ]CULA|P[AÁ]GINA)/i.test(
            candidatoNome,
          )
        ) {
          nome = candidatoNome;
        }
      }

      if (matricula) {
        servidoresMap.set(cpf, {
          cpf,
          matricula,
          nome: nome || undefined,
        });
      } else {
        linhasIgnoradas++;
      }
    }

    const servidores = Array.from(servidoresMap.values());
    return {
      totalEncontrados: servidores.length,
      servidores,
      linhasIgnoradas,
    };
  }
}
