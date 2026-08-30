<script setup lang="ts">
import { FileText, Dumbbell, Apple, Users, CalendarClock, ArrowRight, Mail } from 'lucide-vue-next'

const categorias = [
  {
    icone: Dumbbell,
    titulo: 'Treino',
    texto: 'Planilhas, dicas de preparação e como treinar pra cada tipo de prova.'
  },
  {
    icone: Apple,
    titulo: 'Nutrição',
    texto: 'Alimentação antes, durante e depois do evento pra render melhor.'
  },
  {
    icone: Users,
    titulo: 'Histórias de atletas',
    texto: 'Relatos de quem já cruzou a linha de chegada em eventos parceiros.'
  },
  {
    icone: CalendarClock,
    titulo: 'Novidades',
    texto: 'Lançamento de eventos, novidades da plataforma e datas importantes.'
  }
]
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-16 text-white sm:py-24">
      <div class="pointer-events-none absolute -bottom-24 -left-16 hidden h-72 w-72 -rotate-12 rounded-[3rem] bg-warning/10 sm:block"></div>
      <div class="pointer-events-none absolute -right-20 -top-20 hidden h-72 w-72 rotate-12 rounded-[3rem] bg-warning/20 sm:block"></div>
      <div class="relative mx-auto max-w-4xl px-4 text-center">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-warning backdrop-blur">
          <FileText :size="14" /> Em preparação
        </span>
        <h1 class="mt-5 text-3xl font-extrabold uppercase leading-tight tracking-tight sm:text-5xl">Blog SeuPercurso</h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-200">
          Dicas de treino, histórias de atletas e novidades sobre os próximos eventos.
        </p>
      </div>
    </section>

    <section class="mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
      <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 text-warning">
        <FileText :size="28" />
      </span>
      <h2 class="mt-5 text-2xl font-extrabold uppercase tracking-tight text-primary">Conteúdo a caminho</h2>
      <p class="mx-auto mt-3 max-w-md text-slate-500">
        Estamos preparando conteúdos pra ajudar você a treinar melhor e escolher seu próximo desafio.
        Enquanto isso, dá uma olhada nos eventos com inscrições abertas.
      </p>
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <NuxtLink
          to="/#eventos"
          class="inline-flex items-center gap-2 rounded-xl bg-warning px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition hover:brightness-95"
        >
          Ver eventos disponíveis <ArrowRight :size="16" />
        </NuxtLink>
        <NuxtLink
          to="/contato"
          class="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-slate-600 transition hover:border-warning hover:text-warning"
        >
          <Mail :size="16" /> Sugerir um tema
        </NuxtLink>
      </div>
    </section>

    <section class="bg-slate-50 py-16 sm:py-20">
      <div class="mx-auto max-w-6xl px-4">
        <div class="mx-auto max-w-2xl text-center">
          <span class="text-xs font-bold uppercase tracking-widest text-warning">O que vem por aí</span>
          <h2 class="mt-2 text-2xl font-extrabold uppercase tracking-tight text-primary sm:text-3xl">
            Assuntos que vamos cobrir
          </h2>
        </div>

        <div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="categoria in categorias"
            :key="categoria.titulo"
            class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
              <component :is="categoria.icone" :size="24" />
            </span>
            <h3 class="mt-4 font-bold text-slate-800">{{ categoria.titulo }}</h3>
            <p class="mt-1 text-sm text-slate-500">{{ categoria.texto }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
