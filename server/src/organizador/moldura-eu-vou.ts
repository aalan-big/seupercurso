import { BadRequestException } from '@nestjs/common';

/** Proporção do feed do Instagram (1080×1350): a arte do atleta sai nesse formato. */
const PROPORCAO = 4 / 5;
const TOLERANCIA_PROPORCAO = 0.02;
const LARGURA_MINIMA = 800;
const LARGURA_MAXIMA = 4000;

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Confere a moldura "Eu vou" pelo cabeçalho do PNG, sem decodificar a imagem: tipo,
 * proporção 4:5 e se o arquivo guarda transparência (canal alfa ou chunk tRNS).
 * Se a janela da foto existe de fato, o painel do organizador confere antes de enviar.
 */
export function validarMolduraEuVou(arquivo: Buffer): { largura: number; altura: number } {
  if (arquivo.length < 33 || !arquivo.subarray(0, 8).equals(ASSINATURA_PNG)) {
    throw new BadRequestException(
      'A moldura precisa ser um arquivo PNG (com a janela da foto transparente).',
    );
  }
  // O primeiro chunk de todo PNG é o IHDR: largura, altura, profundidade e tipo de cor.
  if (arquivo.toString('ascii', 12, 16) !== 'IHDR') {
    throw new BadRequestException('Arquivo PNG inválido.');
  }
  const largura = arquivo.readUInt32BE(16);
  const altura = arquivo.readUInt32BE(20);
  const tipoCor = arquivo.readUInt8(25);

  if (!largura || !altura || Math.abs(largura / altura - PROPORCAO) > TOLERANCIA_PROPORCAO) {
    throw new BadRequestException(
      `A moldura precisa estar na proporção 4:5 (vertical), por exemplo 1080×1350px. O arquivo enviado tem ${largura}×${altura}px.`,
    );
  }
  if (largura < LARGURA_MINIMA || largura > LARGURA_MAXIMA) {
    throw new BadRequestException(
      `A moldura precisa ter entre ${LARGURA_MINIMA} e ${LARGURA_MAXIMA}px de largura (recomendado 1080×1350px). O arquivo enviado tem ${largura}×${altura}px.`,
    );
  }

  // Tipos 4 (cinza + alfa) e 6 (RGBA) têm canal alfa; os outros só com chunk tRNS.
  const temAlfa = tipoCor === 4 || tipoCor === 6 || temChunkTrns(arquivo);
  if (!temAlfa) {
    throw new BadRequestException(
      'A moldura não tem transparência. Exporte o PNG com a janela da foto transparente (fundo transparente).',
    );
  }
  return { largura, altura };
}

function temChunkTrns(arquivo: Buffer): boolean {
  let pos = 8;
  while (pos + 8 <= arquivo.length) {
    const tamanho = arquivo.readUInt32BE(pos);
    const tipo = arquivo.toString('ascii', pos + 4, pos + 8);
    if (tipo === 'tRNS') return true;
    // tRNS vem antes dos dados da imagem: passou do IDAT, não tem.
    if (tipo === 'IDAT' || tipo === 'IEND') return false;
    pos += 12 + tamanho;
  }
  return false;
}
