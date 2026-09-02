import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Valor mínimo de uma cobrança. Abaixo disso o gateway recusa, e o atleta só
 * descobriria na hora de pagar.
 */
export const VALOR_MINIMO_COBRANCA = 5;

/**
 * Um preço é cobrável quando é gratuito (0) ou atinge o mínimo do gateway.
 * A faixa entre os dois só é descoberta na hora do pagamento, quando o atleta
 * já preencheu tudo e recebe um erro cru do gateway.
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
