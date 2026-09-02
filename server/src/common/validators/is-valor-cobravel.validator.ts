import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Valor mínimo de uma cobrança no Asaas. Abaixo disso o gateway recusa com
 * "O valor da cobrança não pode ser menor que R$ 5,00".
 */
export const VALOR_MINIMO_COBRANCA = 5;

/**
 * Um preço é cobrável quando é gratuito (0) ou atinge o mínimo do gateway.
 * A faixa entre os dois só é descoberta na hora do pagamento, quando o atleta
 * já preencheu tudo e recebe um erro cru do Asaas.
 */
export function valorEhCobravel(valor: number): boolean {
  if (!Number.isFinite(valor) || valor < 0) return false;
  return valor === 0 || valor >= VALOR_MINIMO_COBRANCA;
}

export function IsValorCobravel(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValorCobravel',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'number' && valorEhCobravel(value);
        },
        defaultMessage() {
          return `O valor deve ser 0 (gratuito) ou no mínimo R$ ${VALOR_MINIMO_COBRANCA.toFixed(2)} — o gateway de pagamento não aceita cobranças menores.`;
        },
      },
    });
  };
}
