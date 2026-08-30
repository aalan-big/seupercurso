<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string

const { eventoSelecionado, fetchEvento, atualizarEvento } = useEventoOrganizador()

const carregandoPagina = ref(true)
const carregando = ref(false)
const erro = ref('')
const sucesso = ref(false)

const abaAtiva = ref<'dados' | 'modalidades' | 'lotes' | 'descontos' | 'cronometragem'>('dados')

onMounted(async () => {
  try {
    await fetchEvento(id)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoPagina.value = false
  }
})

async function onSubmit(payload: Record<string, unknown>, _arquivoRegulamento: File | null) {
  erro.value = ''
  sucesso.value = false
  carregando.value = true
  try {
    await atualizarEvento(id, payload as Parameters<typeof atualizarEvento>[1])
    sucesso.value = true
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <NuxtLink to="/eventos" class="text-sm font-semibold text-secondary hover:underline">← Meus eventos</NuxtLink>

    <h1 class="mt-2 text-2xl font-extrabold uppercase tracking-tight text-primary">Editar evento</h1>

    <p v-if="carregandoPagina" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="eventoSelecionado">
      <div class="mt-6 flex gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm font-bold uppercase tracking-wide">
        <button
          type="button"
          class="shrink-0 whitespace-nowrap rounded-lg px-4 py-2 transition"
          :class="abaAtiva === 'dados' ? 'bg-white text-primary shadow' : 'text-slate-500'"
          @click="abaAtiva = 'dados'"
        >
          Dados gerais
        </button>
        <button
          type="button"
          class="shrink-0 whitespace-nowrap rounded-lg px-4 py-2 transition"
          :class="abaAtiva === 'modalidades' ? 'bg-white text-primary shadow' : 'text-slate-500'"
          @click="abaAtiva = 'modalidades'"
        >
          Percursos & Categorias
        </button>
        <button
          type="button"
          class="shrink-0 whitespace-nowrap rounded-lg px-4 py-2 transition"
          :class="abaAtiva === 'lotes' ? 'bg-white text-primary shadow' : 'text-slate-500'"
          @click="abaAtiva = 'lotes'"
        >
          Lotes e preços
        </button>
        <button
          type="button"
          class="shrink-0 whitespace-nowrap rounded-lg px-4 py-2 transition flex items-center gap-1.5"
          :class="abaAtiva === 'descontos' ? 'bg-white text-primary shadow' : 'text-slate-500'"
          @click="abaAtiva = 'descontos'"
        >
          Descontos
        </button>
        <button
          type="button"
          class="shrink-0 whitespace-nowrap rounded-lg px-4 py-2 transition flex items-center gap-1.5"
          :class="abaAtiva === 'cronometragem' ? 'bg-white text-primary shadow' : 'text-slate-500'"
          @click="abaAtiva = 'cronometragem'"
        >
          ⏱️ Cronometragem
        </button>
      </div>

      <div class="mt-6 max-w-2xl">
        <template v-if="abaAtiva === 'dados'">
          <p v-if="erro" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ erro }}
          </p>
          <p v-if="sucesso" class="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            Alterações salvas.
          </p>

          <EventoForm :evento="eventoSelecionado" modo-edicao :carregando="carregando" @submit="onSubmit" />

          <div class="mt-8 border-t border-slate-200 pt-6">
            <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Mídia do evento</h2>
            <div class="mt-4">
              <EventoMidia :evento="eventoSelecionado" />
            </div>
          </div>
        </template>
      </div>

      <div v-if="abaAtiva === 'modalidades'" class="mt-6">
        <ModalidadesManager
          :evento-id="id"
          :cidade="eventoSelecionado.cidade"
          :estado="eventoSelecionado.estado"
          :modalidades="eventoSelecionado.modalidades || []"
        />
      </div>

      <div v-if="abaAtiva === 'lotes'" class="mt-6">
        <LotesManager :evento-id="id" :lotes="eventoSelecionado.lotes || []" :modalidades="eventoSelecionado.modalidades || []" />
      </div>

      <div v-if="abaAtiva === 'descontos'" class="mt-6 max-w-2xl">
        <CuponsManager :evento-id="id" :evento="eventoSelecionado" />
      </div>

      <div v-if="abaAtiva === 'cronometragem'" class="mt-6">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>⏱️</span> Cronometragem deste Evento
              </h2>
              <p class="text-xs text-slate-500 mt-1">
                Gere a chave de API de integração ao vivo ou importe planilhas CSV para {{ eventoSelecionado.nome }}.
              </p>
            </div>
            <NuxtLink
              to="/cronometragem"
              class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-95 transition"
            >
              Abrir Painel Completo de Cronometragem →
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>

    <p v-else class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro || 'Evento não encontrado.' }}
    </p>
  </div>
</template>
