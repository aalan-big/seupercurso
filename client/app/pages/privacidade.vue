<script setup lang="ts">
useHead({ title: 'Política de Privacidade — Seu Percurso' })

const atualizadoEm = '19 de setembro de 2026'
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 sm:py-14">
    <p class="text-xs font-bold uppercase tracking-wider text-warning">Seu Percurso</p>
    <h1 class="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">Política de Privacidade</h1>
    <p class="mt-2 text-sm text-slate-500">Última atualização: {{ atualizadoEm }}</p>

    <div class="prose-sp mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
      <section>
        <h2>1. Quem somos</h2>
        <p>
          O Seu Percurso é uma plataforma de inscrições para corridas de rua, trail run e outros eventos esportivos.
          Conectamos atletas a organizadores de eventos e processamos as inscrições e os pagamentos.
          Esta política explica quais dados coletamos, por que coletamos e como você pode exercer seus direitos,
          conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).
        </p>
      </section>

      <section>
        <h2>2. Quais dados coletamos</h2>
        <p><strong>Ao criar sua conta:</strong> e-mail e senha (guardada de forma criptografada).</p>
        <p><strong>No seu perfil de atleta:</strong> nome completo, CPF, data de nascimento, gênero, celular, endereço,
          se você é pessoa com deficiência (PCD) e, nesse caso, o laudo enviado; foto de perfil, se você quiser.</p>
        <p><strong>Dependentes e convidados:</strong> quando você inscreve outra pessoa, coletamos nome, CPF, data de
          nascimento e gênero dela. Ao fazer isso, você declara ter autorização dessa pessoa para informar os dados.</p>
        <p><strong>Na inscrição:</strong> evento, modalidade, categoria, tamanho de camisa e número de peito. Quando o
          evento oferece desconto para pessoas com 60 anos ou mais, pedimos uma foto de documento com foto (RG ou CNH)
          para comprovar a idade.</p>
        <p><strong>No pagamento:</strong> o pagamento é processado pelo Mercado Pago. Não armazenamos o número completo
          do seu cartão. Guardamos apenas o valor, o método, o status e o identificador da transação.</p>
        <p><strong>Uso do site:</strong> cookie de login e dados temporários do carrinho de inscrição no seu navegador.
          Não usamos ferramentas de rastreamento para publicidade.</p>
      </section>

      <section>
        <h2>3. Para que usamos os dados</h2>
        <ul>
          <li>Criar e manter sua conta e permitir o login.</li>
          <li>Realizar a inscrição e emitir a confirmação, o número de peito e o certificado.</li>
          <li>Processar o pagamento e emitir o repasse ao organizador.</li>
          <li>Validar a elegibilidade em categorias (faixa etária, gênero, PCD) e descontos (idoso).</li>
          <li>Enviar e-mails sobre sua inscrição, pagamento e eventos em que você se inscreveu.</li>
          <li>Cumprir obrigações legais e prevenir fraudes.</li>
        </ul>
      </section>

      <section>
        <h2>4. Com quem compartilhamos</h2>
        <p><strong>Organizador do evento:</strong> recebe os dados necessários para realizar a prova — nome, CPF, data
          de nascimento, gênero, contato, tamanho de camisa, categoria e, quando aplicável, o documento de comprovação
          de idade ou o laudo PCD. O organizador é responsável por usar esses dados apenas para o evento.</p>
        <p><strong>Mercado Pago:</strong> processa o pagamento e recebe os dados exigidos para isso.</p>
        <p><strong>Serviços de e-mail e hospedagem:</strong> usados apenas para operar a plataforma.</p>
        <p>Não vendemos seus dados nem os compartilhamos para publicidade.</p>
      </section>

      <section>
        <h2>5. Cookies</h2>
        <p>Usamos apenas cookies e armazenamento <strong>essenciais</strong>: um cookie para manter você logado e dados
          temporários do carrinho de inscrição, que ficam só no seu navegador. Sem eles o site não funciona, por isso
          não pedimos consentimento para esses itens. Se um dia passarmos a usar cookies de análise ou publicidade,
          esta política será atualizada e você poderá aceitar ou recusar.</p>
      </section>

      <section>
        <h2>6. Por quanto tempo guardamos</h2>
        <p>Mantemos os dados da conta enquanto ela existir. Dados de inscrições e pagamentos são mantidos pelo prazo
          exigido por obrigações fiscais e legais. Documentos de comprovação de idade e laudos PCD são mantidos
          enquanto forem necessários para o evento e a conferência pelo organizador.</p>
      </section>

      <section>
        <h2>7. Seus direitos</h2>
        <p>Você pode, a qualquer momento: acessar e corrigir seus dados pelo seu perfil; pedir a exclusão da sua
          conta; pedir informações sobre o uso dos seus dados; e revogar consentimentos. Para isso, fale conosco pelo
          e-mail <a href="mailto:contato@seupercurso.com.br">contato@seupercurso.com.br</a> ou pela página de
          <NuxtLink to="/contato">contato</NuxtLink>.</p>
        <p>Alguns dados podem precisar ser mantidos mesmo após o pedido de exclusão, quando houver obrigação legal
          (por exemplo, registros de pagamento).</p>
      </section>

      <section>
        <h2>8. Segurança</h2>
        <p>Usamos conexão criptografada (HTTPS), senhas armazenadas com hash e controle de acesso aos dados. Nenhum
          sistema é 100% seguro; se identificarmos um incidente que afete seus dados, avisaremos você e as autoridades
          conforme a lei.</p>
      </section>

      <section>
        <h2>9. Alterações</h2>
        <p>Podemos atualizar esta política. A data no topo indica a versão vigente. Mudanças relevantes serão avisadas
          no site ou por e-mail.</p>
      </section>

      <p class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        Dúvidas sobre privacidade: <a href="mailto:contato@seupercurso.com.br" class="font-bold text-warning">contato@seupercurso.com.br</a>.
        Veja também os <NuxtLink to="/termos" class="font-bold text-warning">Termos de Uso</NuxtLink>.
      </p>
    </div>
  </div>
</template>

<style scoped>
.prose-sp h2 {
  font-size: 1.125rem;
  font-weight: 900;
  color: #0f172a;
  margin-bottom: 0.5rem;
}
.prose-sp p + p {
  margin-top: 0.5rem;
}
.prose-sp ul {
  list-style: disc;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.prose-sp a {
  color: #f97316;
  font-weight: 700;
}
</style>
