<script setup lang="ts">
import { Mail, MapPin } from 'lucide-vue-next'
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-16 text-white sm:py-20">
      <div class="pointer-events-none absolute -right-20 -top-20 hidden h-72 w-72 rotate-12 rounded-[3rem] bg-accent/20 sm:block"></div>
      <div class="relative mx-auto max-w-4xl px-4 text-center">
        <h1 class="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl">Fale conosco</h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-200">
          Dúvidas sobre inscrições, eventos ou parcerias? Estamos por aqui.
        </p>
      </div>
    </section>

    <section class="mx-auto max-w-3xl px-4 py-14">
      <div class="grid gap-6 sm:grid-cols-2">
        <a
          href="mailto:contato@seupercurso.com.br"
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
        >
          <Mail :size="32" class="text-primary" />
          <h3 class="mt-3 font-bold text-slate-800">E-mail</h3>
          <p class="mt-1 text-sm text-secondary">contato@seupercurso.com.br</p>
        </a>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <MapPin :size="32" class="text-primary" />
          <h3 class="mt-3 font-bold text-slate-800">Organizadores</h3>
          <p class="mt-1 text-sm text-slate-500">
            Quer cadastrar um evento? Envie um e-mail contando os detalhes e retornamos em breve.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
