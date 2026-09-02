import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  DATABASE_URL: Joi.string().uri().required(),
  DIRECT_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  PORT: Joi.number().default(3000),

  // Gateway de pagamento. Sem essas variaveis a aplicacao subia e caia em modo
  // mock silencioso, gerando cobrancas que nunca eram pagas de verdade.
  ASAAS_API_KEY: Joi.string().required(),
  ASAAS_WEBHOOK_SECRET: Joi.string().min(16).required(),
  ASAAS_ENV: Joi.string().valid('sandbox', 'production').default('sandbox'),

  // Origens liberadas no CORS.
  CLIENT_URL: Joi.string().uri().required(),
  ORGANIZER_URL: Joi.string().uri().required(),
  ADMIN_URL: Joi.string().uri().required(),
  API_URL: Joi.string().uri().optional(),
}).unknown(true);
