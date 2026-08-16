export function calcularIdade(nascimento: Date, referencia: Date): number {
  let idade = referencia.getFullYear() - nascimento.getFullYear();
  const aniversarioEsteAno = new Date(
    referencia.getFullYear(),
    nascimento.getMonth(),
    nascimento.getDate(),
  );
  if (referencia < aniversarioEsteAno) idade -= 1;
  return idade;
}
