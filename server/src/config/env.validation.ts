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

  // Gateway de pagamento (Mercado Pago). Sem essas variaveis a aplicacao subiria
  // sem conseguir cobrar nada, e o erro so apareceria no checkout do atleta.
  MP_ACCESS_TOKEN: Joi.string().required(),
  MP_CLIENT_ID: Joi.string().required(),
  MP_CLIENT_SECRET: Joi.string().required(),
  MP_REDIRECT_URI: Joi.string().uri().required(),
  MP_WEBHOOK_SECRET: Joi.string().min(16).required(),

  // Cifra as credenciais dos organizadores guardadas no banco.
  CREDENTIALS_SECRET: Joi.string().min(32).optional(),

  // Origens liberadas no CORS.
  CLIENT_URL: Joi.string().uri().required(),
  ORGANIZER_URL: Joi.string().uri().required(),
  ADMIN_URL: Joi.string().uri().required(),
  API_URL: Joi.string().uri().optional(),
}).unknown(true);
