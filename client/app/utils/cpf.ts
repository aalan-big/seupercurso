function calcularDigito(digitos: string, pesos: number[]): number {
  const soma = digitos
    .split('')
    .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function cpfEhValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, '')

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }

  const digito1 = calcularDigito(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const digito2 = calcularDigito(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])

  return digito1 === Number(cpf[9]) && digito2 === Number(cpf[10])
}
