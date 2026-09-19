<script setup lang="ts">
useHead({ title: 'Termos de Uso — Seu Percurso' })

const atualizadoEm = '19 de setembro de 2026'
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 sm:py-14">
    <p class="text-xs font-bold uppercase tracking-wider text-warning">Seu Percurso</p>
    <h1 class="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">Termos de Uso</h1>
    <p class="mt-2 text-sm text-slate-500">Última atualização: {{ atualizadoEm }}</p>

    <div class="prose-sp mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
      <section>
        <h2>1. O que é o Seu Percurso</h2>
        <p>
          O Seu Percurso é uma plataforma que intermedia inscrições em eventos esportivos. Os eventos são criados e
          realizados por <strong>organizadores independentes</strong>, que definem regulamento, preços, lotes,
          categorias, entrega de kits e tudo que diz respeito à prova. Ao usar o site, você concorda com estes termos.
        </p>
      </section>

      <section>
        <h2>2. Sua conta</h2>
        <ul>
          <li>Você precisa ter 18 anos ou mais para criar uma conta. Menores participam como dependentes de um responsável.</li>
          <li>Os dados informados devem ser verdadeiros e atualizados. Dados falsos podem levar ao cancelamento da inscrição sem reembolso.</li>
          <li>Você é responsável por manter sua senha em sigilo e por tudo que for feito com sua conta.</li>
          <li>Ao inscrever outra pessoa (dependente ou convidado), você declara ter autorização dela e responde pelos dados informados.</li>
        </ul>
      </section>

      <section>
        <h2>3. Inscrições e pagamentos</h2>
        <ul>
          <li>A inscrição só é confirmada após a aprovação do pagamento.</li>
          <li>Os valores, lotes e prazos são definidos pelo organizador e podem mudar até o momento do pagamento.</li>
          <li>O valor pago pode incluir uma taxa de serviço da plataforma, informada antes da conclusão do pagamento.</li>
          <li>Pagamentos são processados pelo Mercado Pago, sujeito aos termos dele.</li>
        </ul>
      </section>

      <section>
        <h2>4. Descontos e elegibilidade</h2>
        <p>
          Categorias por idade, gênero ou PCD e descontos (como o desconto para pessoas com 60 anos ou mais) dependem
          dos dados que você informa. Quando exigido, você deve enviar documento comprobatório. O organizador pode
          conferir esse documento e, se a informação não for confirmada, pode exigir a diferença do valor, alterar a
          categoria ou cancelar a inscrição, conforme o regulamento do evento.
        </p>
      </section>

      <section>
        <h2>5. Cancelamento, transferência e reembolso</h2>
        <p>
          As regras de cancelamento, troca de categoria, transferência de inscrição e reembolso são definidas pelo
          <strong>organizador de cada evento</strong> e constam no regulamento. Quando permitido, as opções ficam
          disponíveis em "Minhas inscrições". Em caso de cancelamento ou adiamento do evento, a responsabilidade pelo
          reembolso é do organizador.
        </p>
      </section>

      <section>
        <h2>6. Responsabilidades</h2>
        <ul>
          <li>O organizador é responsável pela realização do evento, segurança, estrutura, cronometragem, kits e premiação.</li>
          <li>O Seu Percurso é responsável pelo funcionamento da plataforma, pelo processo de inscrição e pelo repasse dos valores ao organizador.</li>
          <li>Ao se inscrever, você declara estar em condições de saúde para participar da prova, conforme o regulamento do evento.</li>
        </ul>
      </section>

      <section>
        <h2>7. Uso aceitável</h2>
        <p>
          É proibido usar o site para fraudar inscrições, informar dados de terceiros sem autorização, tentar acessar
          contas ou áreas restritas, ou prejudicar o funcionamento da plataforma. Contas que violarem estes termos
          podem ser suspensas.
        </p>
      </section>

      <section>
        <h2>8. Privacidade</h2>
        <p>
          O tratamento dos seus dados está descrito na
          <NuxtLink to="/privacidade">Política de Privacidade</NuxtLink>, que faz parte destes termos.
        </p>
      </section>

      <section>
        <h2>9. Alterações e contato</h2>
        <p>
          Podemos atualizar estes termos; a data no topo indica a versão vigente. Dúvidas:
          <a href="mailto:contato@seupercurso.com.br">contato@seupercurso.com.br</a>.
        </p>
      </section>
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
