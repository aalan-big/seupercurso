require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('DELETE FROM "Pagamento"');
    await client.query('DELETE FROM "Certificado"');
    await client.query('DELETE FROM "Resultado"');
    
    const resInsc = await client.query('DELETE FROM "Inscricao"');
    console.log(`Foram apagadas ${resInsc.rowCount} inscrições de teste.`);

    const resCupom = await client.query('UPDATE "Cupom" SET "usosAtuais" = 0');
    console.log(`Foram resetados ${resCupom.rowCount} cupons para 0 usos.`);

    await client.query('COMMIT');
    console.log('Limpeza no BD realizada com SUCESSO!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Erro na limpeza:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
