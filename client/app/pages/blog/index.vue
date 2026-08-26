<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-16 text-white sm:py-20">
      <div class="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 -rotate-12 rounded-[3rem] bg-warning/10"></div>
      <div class="relative mx-auto max-w-4xl px-4 text-center">
        <h1 class="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl">Blog SeuPercurso</h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-200">
          Dicas de treino, histórias de atletas e novidades sobre os próximos eventos.
        </p>
      </div>
    </section>

    <section class="mx-auto max-w-3xl px-4 py-20 text-center">
      <FileText :size="48" class="mx-auto mb-4 text-slate-400" />
      <h2 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Em breve</h2>
      <p class="mx-auto mt-3 max-w-md text-slate-500">
        Estamos preparando conteúdos para ajudar você a treinar melhor e escolher seu próximo desafio. Volte em
        breve!
      </p>
      <NuxtLink
        to="/#eventos"
        class="mt-8 inline-block rounded-xl bg-secondary px-8 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-secondary-hover"
      >
        Ver eventos disponíveis
      </NuxtLink>
    </section>
  </div>
</template>
