<script setup lang="ts">
import { Flag } from 'lucide-vue-next'

const fotos = ['/hero-corrida.jpg', '/hero-moto.jpg', '/hero-ciclismo.jpg']
const fotoAtual = ref(0)
let intervaloFotos: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  intervaloFotos = setInterval(() => {
    fotoAtual.value = (fotoAtual.value + 1) % fotos.length
  }, 4000)
})

onUnmounted(() => clearInterval(intervaloFotos))
</script>

<template>
  <div class="grid min-h-screen grid-cols-1 md:grid-cols-2">
    <div class="relative hidden overflow-hidden md:block">
      <div
        v-for="(foto, i) in fotos"
        :key="foto"
        class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
        :class="i === fotoAtual ? 'opacity-100' : 'opacity-0'"
        :style="{ backgroundImage: `url(${foto})` }"
      ></div>
      <div class="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-secondary/70"></div>
      <div class="relative flex h-full flex-col justify-center px-12">
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur">
          <Flag :size="22" class="text-white" />
        </span>
        <h2 class="mt-6 text-3xl font-extrabold uppercase leading-tight tracking-tight text-white">
          Organize eventos<br />com o SeuPercurso
        </h2>
        <p class="mt-3 max-w-sm text-slate-200">
          Publique corridas, gerencie inscrições e acompanhe seus eventos em um só lugar.
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
