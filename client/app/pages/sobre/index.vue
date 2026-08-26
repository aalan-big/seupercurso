<script setup lang="ts">
import { Target, Zap, Trophy } from 'lucide-vue-next'
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-16 text-white sm:py-20">
      <div class="pointer-events-none absolute -right-20 -top-20 hidden h-72 w-72 rotate-12 rounded-[3rem] bg-accent/20 sm:block"></div>
      <div class="relative mx-auto max-w-4xl px-4 text-center">
        <h1 class="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl">Sobre o SeuPercurso</h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-200">
          Conectamos atletas aos melhores eventos esportivos do país, do primeiro 5km à sua próxima maratona.
        </p>
      </div>
    </section>

    <section class="mx-auto max-w-4xl px-4 py-14">
      <p class="text-lg leading-relaxed text-slate-700">
        O SeuPercurso nasceu para simplificar a jornada entre encontrar um evento e cruzar a linha de chegada.
        Reunimos corridas, provas de ciclismo, trilhas e outros desafios esportivos em um só lugar, com inscrição
        rápida e organizada para atletas de todos os níveis.
      </p>

      <div class="mt-12 grid gap-6 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Target :size="32" class="text-primary" />
          <h3 class="mt-3 font-bold text-slate-800">Eventos verificados</h3>
          <p class="mt-1 text-sm text-slate-500">Organizadores reais, informações claras e sem surpresas na hora da inscrição.</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Zap :size="32" class="text-primary" />
          <h3 class="mt-3 font-bold text-slate-800">Inscrição simples</h3>
          <p class="mt-1 text-sm text-slate-500">Poucos passos entre encontrar o evento ideal e garantir sua vaga.</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Trophy :size="32" class="text-primary" />
          <h3 class="mt-3 font-bold text-slate-800">Comunidade ativa</h3>
          <p class="mt-1 text-sm text-slate-500">Cada percurso é uma conquista — celebramos cada atleta que cruza a linha.</p>
        </div>
      </div>

      <div class="mt-12 text-center">
        <NuxtLink
          to="/#eventos"
          class="inline-block rounded-xl bg-warning px-8 py-4 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition hover:brightness-95"
        >
          Ver eventos disponíveis
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
