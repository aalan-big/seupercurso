<script setup lang="ts">
const { eventos, fetchEventos } = useEvento()
const busca = ref('')
const carregando = ref(false)
const erro = ref('')

const eventosFiltrados = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  if (!termo) return eventos.value
  return eventos.value.filter(
    (evento) => evento.nome.toLowerCase().includes(termo) || evento.cidade.toLowerCase().includes(termo)
  )
})

onMounted(async () => {
  carregando.value = true
  try {
    await fetchEventos()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-[url('/tela_inicio.jpg')] bg-cover bg-center py-20 text-white sm:py-28">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-secondary/70"></div>
      <svg
        class="pointer-events-none absolute inset-x-0 top-1/2 hidden w-full max-w-none -translate-y-1/2 sm:block"
        viewBox="0 0 1200 200"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M-20,140 C 220,40 380,240 600,110 S 1000,10 1220,90"
          stroke="#10B981"
          stroke-width="3"
          stroke-dasharray="2 16"
          stroke-linecap="round"
          opacity="0.6"
        />
      </svg>

      <div class="relative mx-auto max-w-6xl px-4 text-center">
        <div class="mb-6 flex items-center justify-center gap-5 text-2xl sm:text-3xl" aria-hidden="true">
          <span>🏃</span><span>🚴</span><span>🏊</span><span>🥾</span>
        </div>
        <h1 class="text-4xl font-extrabold uppercase leading-tight tracking-tight sm:text-6xl">
          Sua próxima conquista<br class="hidden sm:block" /> começa aqui
        </h1>
        <p class="mx-auto mt-4 max-w-xl text-lg text-slate-200">
          Encontre e se inscreva nos melhores eventos esportivos do país.
        </p>
        <NuxtLink
          to="#eventos"
          class="mt-8 inline-block rounded-xl bg-warning px-8 py-4 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition hover:brightness-95"
        >
          Encontrar meu próximo evento
        </NuxtLink>
      </div>
    </section>

    <div class="relative z-10 mx-auto -mt-8 max-w-3xl px-4">
      <div class="relative rounded-2xl bg-white shadow-xl">
        <span class="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          v-model="busca"
          type="text"
          placeholder="Pesquise pelo nome do evento ou cidade..."
          class="w-full rounded-2xl border-0 py-4 pl-12 pr-5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
    </div>

    <section id="eventos" class="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
      <h2 class="mb-6 text-2xl font-extrabold uppercase tracking-tight text-primary sm:text-3xl">Inscrições abertas</h2>

      <p v-if="erro" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ erro }}
      </p>
      <p v-else-if="!carregando && eventosFiltrados.length === 0" class="text-slate-500">Nenhum evento encontrado.</p>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <EventoCard v-for="evento in eventosFiltrados" :key="evento.id" :evento="evento" />
      </div>
    </section>
  </div>
</template>
