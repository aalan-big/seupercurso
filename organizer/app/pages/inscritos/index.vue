<script setup lang="ts">
const { inscritos, fetchInscritos, exportarCsv } = useInscritosOrganizador()
const { eventos, fetchMeusEventos } = useEventoOrganizador()

const carregando = ref(true)
const exportando = ref(false)
const erro = ref('')

const filtroEvento = ref('')
const filtroStatus = ref('')
const filtroBusca = ref('')

const statusOpcoes = [
  { valor: '', label: 'Todos os status' },
  { valor: 'PENDENTE_PAGAMENTO', label: 'Pagamento pendente' },
  { valor: 'CONFIRMADA', label: 'Confirmada' },
  { valor: 'CANCELADA', label: 'Cancelada' },
  { valor: 'EXPIRADA', label: 'Expirada' }
]

const statusInfo: Record<string, { texto: string; classe: string }> = {
  PENDENTE_PAGAMENTO: { texto: 'Pagamento pendente', classe: 'bg-warning/10 text-warning' },
  CONFIRMADA: { texto: 'Confirmada', classe: 'bg-accent/10 text-accent' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-red-50 text-red-600' },
  EXPIRADA: { texto: 'Expirada', classe: 'bg-slate-100 text-slate-500' }
}

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    await fetchInscritos({
      eventoId: filtroEvento.value || undefined,
      status: filtroStatus.value || undefined,
      busca: filtroBusca.value || undefined
    })
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(async () => {
  try {
    await fetchMeusEventos()
  } catch {
    // segue mesmo se a lista de eventos falhar — filtro por evento só fica vazio
  }
  await carregar()
})

async function onExportar() {
  erro.value = ''
  exportando.value = true
  try {
    await exportarCsv({
      eventoId: filtroEvento.value || undefined,
      status: filtroStatus.value || undefined,
      busca: filtroBusca.value || undefined
    })
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    exportando.value = false
  }
}

function nomeCliente(inscrito: (typeof inscritos.value)[number]) {
  return inscrito.cliente.pf?.nomeCompleto || inscrito.cliente.pj?.razaoSocial || inscrito.cliente.usuario.email
}

function documentoCliente(inscrito: (typeof inscritos.value)[number]) {
  return inscrito.cliente.pf?.cpf || inscrito.cliente.pj?.cnpj || ''
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Inscritos</h1>
        <p class="mt-1 text-sm text-slate-500">Veja e exporte os inscritos dos seus eventos.</p>
      </div>
      <button
        type="button"
        :disabled="exportando"
        class="rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95 disabled:opacity-50"
        @click="onExportar"
      >
        {{ exportando ? 'Exportando...' : 'Exportar CSV' }}
      </button>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <select
        v-model="filtroEvento"
        class="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        @change="carregar"
      >
        <option value="">Todos os eventos</option>
        <option v-for="evento in eventos" :key="evento.id" :value="evento.id">{{ evento.nome }}</option>
      </select>
      <select
        v-model="filtroStatus"
        class="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        @change="carregar"
      >
        <option v-for="opcao in statusOpcoes" :key="opcao.valor" :value="opcao.valor">{{ opcao.label }}</option>
      </select>
      <input
        v-model="filtroBusca"
        type="text"
        placeholder="Buscar por nome ou CPF..."
        class="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        @keyup.enter="carregar"
      />
    </div>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <div v-else-if="inscritos.length === 0" class="mt-10 text-center">
      <div class="text-4xl">🧾</div>
      <p class="mt-3 text-slate-500">Nenhum inscrito encontrado com esses filtros.</p>
    </div>

    <div v-else class="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Nome</th>
            <th class="px-4 py-3">CPF</th>
            <th class="px-4 py-3">Evento</th>
            <th class="px-4 py-3">Modalidade / Categoria</th>
            <th class="px-4 py-3">Camisa</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Inscrito em</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inscrito in inscritos" :key="inscrito.id" class="border-b border-slate-100 last:border-0">
            <td class="px-4 py-3 font-medium text-slate-800">{{ nomeCliente(inscrito) }}</td>
            <td class="px-4 py-3 text-slate-500">{{ documentoCliente(inscrito) }}</td>
            <td class="px-4 py-3 text-slate-500">{{ inscrito.categoria.modalidade.evento.nome }}</td>
            <td class="px-4 py-3 text-slate-500">{{ inscrito.categoria.modalidade.nome }} · {{ inscrito.categoria.nome }}</td>
            <td class="px-4 py-3 text-slate-500">{{ inscrito.tamanhoCamisa || '—' }}</td>
            <td class="px-4 py-3">
              <span
                class="whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                :class="statusInfo[inscrito.status]?.classe || 'bg-slate-100 text-slate-500'"
              >
                {{ statusInfo[inscrito.status]?.texto || inscrito.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-500">{{ formatarData(inscrito.dataInscricao) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
