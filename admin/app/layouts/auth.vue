<script setup lang="ts">
import { Shield } from 'lucide-vue-next'
</script>

<template>
  <div class="grid min-h-screen grid-cols-1 md:grid-cols-2">
    <div class="relative hidden overflow-hidden md:block">
      <div class="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-secondary/70"></div>
      <div class="relative flex h-full flex-col justify-center px-12">
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur">
          <Shield :size="24" class="text-white" />
        </span>
        <h2 class="mt-6 text-3xl font-extrabold uppercase leading-tight tracking-tight text-white">
          Painel administrativo<br />SeuPercurso
        </h2>
        <p class="mt-3 max-w-sm text-slate-200">
          Aprovação de organizadores e revisão de eventos antes de irem ao ar.
        </p>
      </div>
    </div>

    <div class="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
      <div class="mx-auto w-full max-w-sm">
        <slot />
      </div>
    </div>
  </div>
</template>
