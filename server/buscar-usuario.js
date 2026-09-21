require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const termo = process.argv[2] || 'noeme';
  console.log(`\n🔎 Buscando por: "${termo}"...\n`);

  const res = await client.query(
    `SELECT u.id, u.email, u."emailVerificado", u."createdAt", 
            pf."nomeCompleto", pf.cpf, pf.celular
     FROM "Usuario" u
     LEFT JOIN "Cliente" cl ON cl."usuarioId" = u.id
     LEFT JOIN "ClientePf" pf ON pf."clienteId" = cl.id
     WHERE u.email ILIKE $1 OR pf."nomeCompleto" ILIKE $1`,
    [`%${termo}%`]
  );

  if (res.rows.length === 0) {
    console.log(`❌ Nenhum usuário encontrado com o termo "${termo}".`);
  } else {
    console.log(`✅ Encontrado(s) ${res.rows.length} usuário(s):\n`);
    for (const user of res.rows) {
      console.log(`---------------------------------------------`);
      console.log(`Nome:             ${user.nomeCompleto || 'Não informado'}`);
      console.log(`E-mail:           ${user.email}`);
      console.log(`E-mail Verificado: ${user.emailVerificado ? 'SIM ✅' : 'NÃO ❌ (Bloqueado)'}`);
      console.log(`CPF:              ${user.cpf || 'Não informado'}`);
      console.log(`Celular:          ${user.celular || 'Não informado'}`);
      console.log(`Criado em:        ${user.createdAt}`);
      
      const inscricoes = await client.query(
        `SELECT i.id, i.status, i."numeroPeito", e.nome as evento, c.nome as categoria
         FROM "Inscricao" i
         JOIN "Cliente" cl ON cl.id = i."clienteId"
         JOIN "Categoria" c ON c.id = i."categoriaId"
         JOIN "Modalidade" m ON m.id = c."modalidadeId"
         JOIN "Evento" e ON e.id = m."eventoId"
         WHERE cl."usuarioId" = $1`,
        [user.id]
      );
      if (inscricoes.rows.length > 0) {
        console.log(`Inscrições (${inscricoes.rows.length}):`);
        inscricoes.rows.forEach(i => console.log(`  - [${i.status}] Evento: ${i.evento} | Cat: ${i.categoria}`));
      } else {
        console.log(`Inscrições:       Nenhuma inscrição encontrada.`);
      }
      console.log(`---------------------------------------------\n`);
    }
  }

  await client.end();
}

run().catch(e => console.error('Erro na consulta:', e.message));
