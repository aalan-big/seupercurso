<script setup lang="ts">
import { Mail } from 'lucide-vue-next'
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Central de ajuda</h1>
    <p class="mt-1 text-sm text-slate-500">Precisa de ajuda? Fale com a gente ou veja como usar as principais telas.</p>

    <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Fale com a gente</h2>
      <a href="mailto:suporte@seupercurso.com" class="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline">
        <Mail :size="15" /> suporte@seupercurso.com
      </a>
      <p class="mt-1 text-xs text-slate-400">Troque esse contato pelo canal de suporte real da plataforma.</p>
    </div>

    <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Como usar a plataforma</h2>
      <dl class="mt-4 flex flex-col gap-4 text-sm">
        <div>
          <dt class="font-semibold text-slate-700">Publicar um evento</dt>
          <dd class="mt-1 text-slate-500">Cadastre o evento em "Meus eventos", preencha modalidades, categorias, lotes e preços, e envie pra revisão. Nossa equipe aprova antes de ele ficar visível pro público.</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-700">Retirada de kit no dia da corrida</dt>
          <dd class="mt-1 text-slate-500">Use a tela de "Check-in" no celular pra buscar o atleta pelo nome, CPF ou número de peito e confirmar a entrega do kit.</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-700">Aprovação de conta</dt>
          <dd class="mt-1 text-slate-500">Acompanhe o status da sua verificação em "Verificação de conta" — se for rejeitada, o motivo aparece lá e você pode reenviar o documento.</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
