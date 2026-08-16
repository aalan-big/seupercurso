<script setup lang="ts">
const { eventos, fetchMeusEventos } = useEventoOrganizador()
const { kits, fetchKits } = useKitsOrganizador()

const eventoSelecionadoId = ref('')
const carregandoEventos = ref(true)
const carregandoKits = ref(false)
const erro = ref('')

const ORDEM_TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'Não informado']

function ordenarTamanhos(tamanhos: Record<string, number>) {
  return Object.entries(tamanhos).sort(([a], [b]) => {
    const posA = ORDEM_TAMANHOS.indexOf(a)
    const posB = ORDEM_TAMANHOS.indexOf(b)
    if (posA === -1 && posB === -1) return a.localeCompare(b)
    if (posA === -1) return 1
    if (posB === -1) return -1
    return posA - posB
  })
}

const tamanhosOrdenados = computed(() => (kits.value ? ordenarTamanhos(kits.value.totalPorTamanho) : []))

onMounted(async () => {
  try {
    await fetchMeusEventos()
    if (eventos.value.length > 0) {
      eventoSelecionadoId.value = eventos.value[0].id
      await carregarKits()
    }
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoEventos.value = false
  }
})

async function carregarKits() {
  if (!eventoSelecionadoId.value) return
  erro.value = ''
  carregandoKits.value = true
  try {
    await fetchKits(eventoSelecionadoId.value)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoKits.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Kits e estoque</h1>
    <p class="mt-1 text-sm text-slate-500">Veja quantas camisetas de cada tamanho você precisa encomendar.</p>

    <p v-if="carregandoEventos" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="eventos.length === 0">
      <div class="mt-10 text-center">
        <div class="text-4xl">👕</div>
        <p class="mt-3 text-slate-500">Você ainda não criou nenhum evento.</p>
      </div>
    </template>

    <template v-else>
      <select
        v-model="eventoSelecionadoId"
        class="mt-6 w-full max-w-sm rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        @change="carregarKits"
      >
        <option v-for="evento in eventos" :key="evento.id" :value="evento.id">{{ evento.nome }}</option>
      </select>

      <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ erro }}
      </p>

      <p v-if="carregandoKits" class="mt-8 text-sm text-slate-500">Carregando...</p>

      <template v-else-if="kits">
        <p v-if="kits.total === 0" class="mt-10 text-center text-sm text-slate-500">
          Nenhuma inscrição confirmada ou pendente ainda pra esse evento.
        </p>

        <template v-else>
          <div class="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-5 py-3">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Total geral — {{ kits.total }} inscritos</p>
            </div>
            <div class="grid grid-cols-3 gap-4 p-5 sm:grid-cols-6">
              <div v-for="[tamanho, quantidade] in tamanhosOrdenados" :key="tamanho" class="text-center">
                <p class="text-2xl font-extrabold text-primary">{{ quantidade }}</p>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ tamanho }}</p>
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-4">
            <div
              v-for="grupo in kits.porModalidade"
              :key="grupo.modalidadeId"
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p class="font-bold text-slate-800">{{ grupo.modalidade }}</p>
              <div class="mt-3 flex flex-wrap gap-4">
                <div v-for="[tamanho, quantidade] in ordenarTamanhos(grupo.tamanhos)" :key="tamanho" class="text-center">
                  <p class="text-lg font-bold text-primary">{{ quantidade }}</p>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ tamanho }}</p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>
