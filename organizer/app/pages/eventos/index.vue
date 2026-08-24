<script setup lang="ts">
const { eventos, fetchMeusEventos } = useEventoOrganizador()

const carregando = ref(true)
const erro = ref('')

onMounted(async () => {
  try {
    await fetchMeusEventos()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

const config = useRuntimeConfig()

function bannerUrlFormatted(url?: string | null) {
  return urlFoto(url, config.public.apiBase as string) || ''
}


function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const statusInfo: Record<string, { texto: string; classe: string }> = {
  RASCUNHO: { texto: 'Rascunho', classe: 'bg-slate-100 text-slate-500 font-bold' },
  AGUARDANDO_APROVACAO: { texto: 'Em revisão', classe: 'bg-amber-100 text-amber-800 font-bold' },
  PUBLICADO: { texto: 'Aberto', classe: 'bg-emerald-100 text-emerald-800 font-bold' },
  INSCRICOES_ENCERRADAS: { texto: 'Inscrições encerradas', classe: 'bg-amber-100 text-amber-900 font-bold' },
  CANCELADO: { texto: 'Cancelado', classe: 'bg-red-100 text-red-800 font-bold' },
  FINALIZADO: { texto: 'Finalizado', classe: 'bg-blue-100 text-blue-800 font-bold' }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho Principal -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-primary">Meus Eventos Esportivos</h1>
        <p class="mt-1 text-xs text-slate-500">Gerencie, edite banners, modalidades e inscrições das suas provas.</p>
      </div>
      <NuxtLink
        to="/eventos/novo"
        class="inline-flex items-center gap-2 rounded-xl bg-warning px-5 py-3 text-xs font-black uppercase tracking-wider text-primary shadow hover:brightness-95 transition"
      >
        <span>➕ Criar Novo Evento</span>
      </NuxtLink>
    </div>

    <p v-if="carregando" class="text-xs text-slate-400 py-8 text-center">Carregando seus eventos...</p>

    <p v-else-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
      ⚠️ {{ erro }}
    </p>

    <div v-else-if="eventos.length === 0" class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
      <span class="text-4xl block">🏁</span>
      <p class="font-bold text-sm text-slate-700">Você ainda não criou nenhum evento esportivo.</p>
      <NuxtLink
        to="/eventos/novo"
        class="inline-block rounded-xl bg-warning px-6 py-3 text-xs font-black uppercase tracking-wider text-primary shadow hover:brightness-95 transition"
      >
        Criar meu primeiro evento
      </NuxtLink>
    </div>

    <!-- Grid de Eventos -->
    <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="evento in eventos"
        :key="evento.id"
        class="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs transition hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between"
      >
        <!-- Banner Header (Com Imagem Real ou Gradiente Fallback) -->
        <div class="relative h-40 w-full overflow-hidden bg-slate-900">
          <img
            v-if="evento.bannerUrl"
            :src="bannerUrlFormatted(evento.bannerUrl)"
            :alt="evento.nome"
            class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div
            v-else
            :class="['h-full w-full flex items-center justify-center bg-gradient-to-br text-4xl', gradientePorId(evento.id)]"
          >
            🏃
          </div>

          <!-- Status Badge Flutuante -->
          <div class="absolute top-3 right-3 z-10">
            <span
              class="whitespace-nowrap rounded-full px-3 py-1 text-[10px] uppercase shadow-md backdrop-blur-md"
              :class="statusInfo[evento.status]?.classe || 'bg-slate-100 text-slate-500'"
            >
              {{ statusInfo[evento.status]?.texto || evento.status }}
            </span>
          </div>

          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
        </div>

        <!-- Conteúdo do Card -->
        <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <h3 class="font-black text-base text-slate-900 group-hover:text-primary transition line-clamp-1">
              {{ evento.nome }}
            </h3>
            <p class="mt-1 text-xs text-slate-500 flex items-center gap-1">
              <span>📍</span> {{ evento.cidade }}/{{ evento.estado }} · {{ evento.local }}
            </p>
          </div>

          <div class="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
            <div class="flex justify-between">
              <span class="font-bold text-slate-400">Data da Prova:</span>
              <span class="font-bold text-slate-800">{{ formatarData(evento.dataInicio) }}</span>
            </div>
            <div v-if="evento.modalidades && evento.modalidades.length > 0" class="flex justify-between">
              <span class="font-bold text-slate-400">Modalidades:</span>
              <span class="font-bold text-emerald-700">{{ evento.modalidades.map(m => m.nome).join(', ') }}</span>
            </div>
          </div>

          <!-- Botões de Ação Rápida -->
          <div class="pt-2 flex items-center gap-2 border-t border-slate-100">
            <NuxtLink
              :to="`/eventos/${evento.id}/editar`"
              class="flex-1 text-center rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-primary transition"
            >
              ✏️ Editar Evento
            </NuxtLink>
            <NuxtLink
              to="/inscritos"
              class="rounded-xl bg-slate-100 p-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              title="Ver inscritos"
            >
              👥
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
