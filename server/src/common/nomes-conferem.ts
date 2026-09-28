// Particulas que o RH e o atleta escrevem de jeitos diferentes.
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function palavrasDoNome(nome: string): string[] {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !PARTICULAS.has(p));
}

/**
 * Confere o nome do cadastro com o nome da lista da empresa sem exigir que
 * sejam identicos: a lista do RH vem sem acento e as vezes sem um sobrenome
 * ("Jose Uchoa de Lima" x "José Uchôa Lima Filho"). Exige o mesmo primeiro
 * nome e, quando os dois tem sobrenome, ao menos um sobrenome em comum.
 */
export function nomesConferem(nomeLista: string, nomeCadastro: string): boolean {
  const lista = palavrasDoNome(nomeLista);
  const cadastro = palavrasDoNome(nomeCadastro);
  if (lista.length === 0 || cadastro.length === 0) return false;
  if (lista[0] !== cadastro[0]) return false;

  const sobrenomesLista = lista.slice(1);
  const sobrenomesCadastro = new Set(cadastro.slice(1));
  if (sobrenomesLista.length === 0 || sobrenomesCadastro.size === 0) return true;

  return sobrenomesLista.some((p) => sobrenomesCadastro.has(p));
}
