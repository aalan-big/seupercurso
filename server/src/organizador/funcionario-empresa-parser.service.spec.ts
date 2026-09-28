import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { FuncionarioEmpresaParserService } from './funcionario-empresa-parser.service';

describe('FuncionarioEmpresaParserService', () => {
  const parser = new FuncionarioEmpresaParserService();

  describe('texto de relatorio (PDF com texto)', () => {
    it('le "contrato nome" sem CPF, como o relatorio da Dakota', () => {
      const texto = [
        'Dakota Nordeste S/A 28/09/2026 08:23 Página: 1',
        '28/09/2026',
        'RELAÇÃO FUNCIONARIOS RHPR1870/VE22',
        'Contrato Nome',
        '18 Jose Uchoa de Lima',
        '20 Ana Claudia de Queiroz Lopes',
        '299 Maria Ferreira da Conceicao  Barbosa',
        '-- 1 of 26 --',
      ].join('\n');

      const res = parser.extrairDeTexto(texto);

      expect(res.funcionarios).toEqual([
        { matricula: '18', nome: 'Jose Uchoa de Lima', cpf: undefined },
        { matricula: '20', nome: 'Ana Claudia de Queiroz Lopes', cpf: undefined },
        { matricula: '299', nome: 'Maria Ferreira da Conceicao Barbosa', cpf: undefined },
      ]);
    });

    it('aceita matricula no fim da linha e CPF opcional no meio', () => {
      const res = parser.extrairDeTexto(
        ['Ana Souza 123.456.789-09 D-100', 'Bruno Lima 4500'].join('\n'),
      );

      expect(res.funcionarios).toEqual([
        { matricula: 'D-100', nome: 'Ana Souza', cpf: '12345678909' },
        { matricula: '4500', nome: 'Bruno Lima', cpf: undefined },
      ]);
    });

    it('numero solto sem nome nao vira funcionario', () => {
      const res = parser.extrairDeTexto(['Página: 1', '12345', '28/09/2026 08:23'].join('\n'));

      expect(res.funcionarios).toEqual([]);
      expect(res.linhasIgnoradas).toBe(3);
    });

    it('matricula repetida conta uma vez e vale a ultima linha', () => {
      const res = parser.extrairDeTexto(['18 Jose Lima', '18 Jose Uchoa de Lima'].join('\n'));

      expect(res.funcionarios).toEqual([
        { matricula: '18', nome: 'Jose Uchoa de Lima', cpf: undefined },
      ]);
      expect(res.matriculasRepetidas).toBe(1);
    });
  });

  describe('CSV', () => {
    it('le contrato e nome com cabecalho e separador', () => {
      const res = parser.extrairDeTexto(
        ['Contrato;Nome', '18;Jose Uchoa de Lima', '20;Ana Claudia de Queiroz Lopes'].join('\n'),
      );

      expect(res.funcionarios.map((f) => [f.matricula, f.nome])).toEqual([
        ['18', 'Jose Uchoa de Lima'],
        ['20', 'Ana Claudia de Queiroz Lopes'],
      ]);
    });

    it('continua lendo o formato antigo com CPF e matricula', () => {
      const res = parser.extrairDeTexto('Ana Souza;123.456.789-09;D100');

      expect(res.funcionarios).toEqual([
        { matricula: 'D100', nome: 'Ana Souza', cpf: '12345678909' },
      ]);
    });
  });

  describe('Excel', () => {
    async function planilha(linhas: (string | number)[][]) {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Lista');
      linhas.forEach((l) => ws.addRow(l));
      return Buffer.from(await wb.xlsx.writeBuffer());
    }

    it('acha as colunas pelo cabecalho "Contrato" e "Nome"', async () => {
      const buffer = await planilha([
        ['Relação de funcionários'],
        ['Contrato', 'Nome'],
        [18, 'Jose Uchoa de Lima'],
        [20, 'Ana Claudia de Queiroz Lopes'],
      ]);

      const res = await parser.parseArquivo(buffer, undefined, 'lista.xlsx');

      expect(res.funcionarios).toEqual([
        { matricula: '18', nome: 'Jose Uchoa de Lima', cpf: undefined },
        { matricula: '20', nome: 'Ana Claudia de Queiroz Lopes', cpf: undefined },
      ]);
    });

    it('usa a coluna de CPF quando existe', async () => {
      const buffer = await planilha([
        ['Matrícula', 'Nome', 'CPF'],
        ['D100', 'Ana Souza', '123.456.789-09'],
      ]);

      const res = await parser.parseArquivo(buffer, undefined, 'lista.xlsx');

      expect(res.funcionarios).toEqual([
        { matricula: 'D100', nome: 'Ana Souza', cpf: '12345678909' },
      ]);
    });
  });

  it('PDF que e so imagem recebe um aviso claro', async () => {
    const pdfModule = require('pdf-parse');
    const original = pdfModule.PDFParse;
    pdfModule.PDFParse = jest.fn().mockImplementation(() => ({
      getText: async () => ({ text: '\n\n-- 1 of 26 --\n\n\n-- 2 of 26 --\n' }),
      destroy: async () => undefined,
    }));

    try {
      const erro = await parser
        .parseArquivo(Buffer.from('%PDF'), 'application/pdf', 'lista.pdf')
        .catch((e) => e);
      expect(erro).toBeInstanceOf(BadRequestException);
      expect(erro.message).toMatch(/imagem/);
    } finally {
      pdfModule.PDFParse = original;
    }
  });
});
