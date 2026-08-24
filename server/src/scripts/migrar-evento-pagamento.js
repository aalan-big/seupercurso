require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await pool.query(`
      ALTER TABLE "Evento" 
      ADD COLUMN IF NOT EXISTS "aceitaPix" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "aceitaCartao" BOOLEAN NOT NULL DEFAULT true;
    `);
    console.log('✅ Colunas aceitaPix e aceitaCartao adicionadas à tabela Evento com SUCESSO!');
  } catch (e) {
    console.error('❌ Erro na migração:', e);
  } finally {
    await pool.end();
  }
}

main();
