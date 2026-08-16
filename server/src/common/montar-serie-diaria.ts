export function montarSerieDiaria(
  datas: Date[],
  dias: number,
): { data: string; quantidade: number }[] {
  const contagem = new Map<string, number>();
  for (const data of datas) {
    const chave = data.toISOString().slice(0, 10);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  const serie: { data: string; quantidade: number }[] = [];
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);

  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(hoje);
    dia.setUTCDate(dia.getUTCDate() - i);
    const chave = dia.toISOString().slice(0, 10);
    serie.push({ data: chave, quantidade: contagem.get(chave) ?? 0 });
  }

  return serie;
}
