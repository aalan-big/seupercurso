import { registerDecorator, ValidationOptions } from 'class-validator';

function calcularDigito(digitos: string, pesos: number[]): number {
  const soma = digitos
    .split('')
    .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjEhValido(valor: string): boolean {
  const cnpj = valor.replace(/\D/g, '');

  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const digito1 = calcularDigito(cnpj.slice(0, 12), pesos1);
  const digito2 = calcularDigito(cnpj.slice(0, 12) + digito1, pesos2);

  return digito1 === Number(cnpj[12]) && digito2 === Number(cnpj[13]);
}

export function IsCNPJ(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCNPJ',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && cnpjEhValido(value);
        },
        defaultMessage() {
          return 'CNPJ inválido.';
        },
      },
    });
  };
}
