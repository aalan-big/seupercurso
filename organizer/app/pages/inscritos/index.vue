<script setup lang="ts">
import { BarChart2, AlertTriangle, Footprints, X, CheckCircle, Hash, Shirt, CreditCard, Save, ListTree, FileText } from 'lucide-vue-next'

const { inscritos, fetchInscritos, exportarCsv, atualizarInscricao } = useInscritosOrganizador()
const { eventos, fetchMeusEventos, fetchEvento } = useEventoOrganizador()

const carregando = ref(true)
const exportando = ref(false)
const salvandoModal = ref(false)
const carregandoCategorias = ref(false)
const erro = ref('')
const sucessoModal = ref('')

const filtroEvento = ref('')
const filtroStatus = ref('')
const filtroBusca = ref('')

// Modal 360° State
const modalAberto = ref(false)
const atletaSelecionado = ref<(typeof inscritos.value)[number] | null>(null)
const categoriasDisponiveis = ref<{ id: string; nomeFormatado: string }[]>([])
const formInscrito = ref({
  numeroPeito: '',
  tamanhoCamisa: '',
  categoriaId: '',
  status: 'CONFIRMADA'
})

const statusOpcoes = [
  { valor: '', label: 'Inscrições Ativas (Exclui canceladas)' },
  { valor: 'CONFIRMADA', label: 'Confirmada' },
  { valor: 'PENDENTE_PAGAMENTO', label: 'Pagamento pendente' },
  { valor: 'CANCELADA', label: 'Cancelada' },
  { valor: 'EXPIRADA', label: 'Expirada' }
]

const modalCategoriasAberto = ref(false)
const abaCategoriaAtiva = ref('')

const inscritosPorCategoria = computed(() => {
  const grupos = new Map<string, { id: string; titulo: string; itens: typeof inscritos.value }>()

  for (const inscrito of inscritos.value) {
    const chave = inscrito.categoria.id
    const titulo = `${inscrito.categoria.modalidade.nome} · ${inscrito.categoria.nome}`
    if (!grupos.has(chave)) {
      grupos.set(chave, { id: chave, titulo, itens: [] })
    }
    grupos.get(chave)!.itens.push(inscrito)
  }

  return Array.from(grupos.values())
    .map((grupo) => ({
      ...grupo,
      // Mantém a numeração de peito exatamente como já foi gerada — aqui só
      // ordena a exibição por ela dentro de cada categoria, sem recalcular nada.
      itens: [...grupo.itens].sort((a, b) => {
        const pa = a.numeroPeito ? Number(a.numeroPeito) : Infinity
        const pb = b.numeroPeito ? Number(b.numeroPeito) : Infinity
        return pa - pb
      })
    }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
})

const grupoCategoriaAtivo = computed(() => {
  return inscritosPorCategoria.value.find((g) => g.id === abaCategoriaAtiva.value) || inscritosPorCategoria.value[0] || null
})

function abrirModalCategorias() {
  abaCategoriaAtiva.value = inscritosPorCategoria.value[0]?.id || ''
  modalCategoriasAberto.value = true
}

const statusInfo: Record<string, { texto: string; classe: string }> = {
  PENDENTE_PAGAMENTO: { texto: 'Pagamento pendente', classe: 'bg-amber-100 text-amber-800 font-bold' },
  CONFIRMADA: { texto: 'Confirmada', classe: 'bg-emerald-100 text-emerald-800 font-bold' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-red-100 text-red-800 font-bold' },
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
    // segue mesmo se a lista de eventos falhar
  }
  await carregar()
})

async function onExportar(formato: 'xlsx' | 'pdf' = 'xlsx') {
  erro.value = ''
  exportando.value = true
  try {
    await exportarCsv(
      {
        eventoId: filtroEvento.value || undefined,
        status: filtroStatus.value || undefined,
        busca: filtroBusca.value || undefined
      },
      formato
    )
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    exportando.value = false
  }
}

async function abrirModal360(inscrito: (typeof inscritos.value)[number]) {
  atletaSelecionado.value = inscrito
  formInscrito.value = {
    numeroPeito: inscrito.numeroPeito || '',
    tamanhoCamisa: inscrito.tamanhoCamisa || 'M',
    categoriaId: (inscrito.categoria as any).id || '',
    status: inscrito.status
  }
  sucessoModal.value = ''
  modalAberto.value = true
  carregandoCategorias.value = true

  try {
    const eventoCompleto = await fetchEvento(inscrito.categoria.modalidade.evento.id)
    const lista: { id: string; nomeFormatado: string }[] = []
    eventoCompleto.modalidades?.forEach((mod) => {
      mod.categorias?.forEach((cat) => {
        lista.push({
          id: cat.id,
          nomeFormatado: `${mod.nome} — ${cat.nome}`
        })
      })
    })
    categoriasDisponiveis.value = lista
  } catch {
    categoriasDisponiveis.value = []
  } finally {
    carregandoCategorias.value = false
  }
}

async function salvarEdicao360() {
  if (!atletaSelecionado.value) return
  salvandoModal.value = true
  sucessoModal.value = ''
  try {
    await atualizarInscricao(atletaSelecionado.value.id, {
      numeroPeito: formInscrito.value.numeroPeito.trim() || undefined,
      tamanhoCamisa: formInscrito.value.tamanhoCamisa,
      categoriaId: formInscrito.value.categoriaId || undefined,
      status: formInscrito.value.status
    })
    sucessoModal.value = 'Dados da inscrição atualizados com sucesso!'
    await carregar()
    setTimeout(() => {
      modalAberto.value = false
    }, 1200)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvandoModal.value = false
  }
}

function nomeCliente(inscrito: any) {
  if (inscrito.dependente?.nomeCompleto) return inscrito.dependente.nomeCompleto
  if (inscrito.atletaNome) return inscrito.atletaNome
  return inscrito.cliente?.pf?.nomeCompleto || inscrito.cliente?.pj?.razaoSocial || inscrito.cliente?.usuario?.email || 'Atleta'
}

function documentoCliente(inscrito: any) {
  if (inscrito.dependente?.cpf) return inscrito.dependente.cpf
  if (inscrito.atletaCpf) return inscrito.atletaCpf
  return inscrito.cliente?.pf?.cpf || inscrito.cliente?.pj?.cnpj || ''
}

function compradorTitular(inscrito: any) {
  const nomeTitular = inscrito.cliente?.pf?.nomeCompleto || inscrito.cliente?.usuario?.email
  const nomeAtletaAtual = nomeCliente(inscrito)
  if (nomeTitular && nomeTitular !== nomeAtletaAtual) {
    return `Comprado por ${nomeTitular}`
  }
  return null
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho Principal -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-primary">Inscritos</h1>
        <p class="mt-1 text-xs text-slate-500">
          Veja os participantes dos seus eventos. Clique em qualquer linha para visualizar e editar dados do atleta.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :disabled="inscritos.length === 0"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 transition disabled:opacity-40"
          @click="abrirModalCategorias"
        >
          <ListTree :size="16" /> Ver por Categoria
        </button>
        <button
          type="button"
          :disabled="exportando"
          class="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition disabled:opacity-40"
          @click="onExportar('xlsx')"
        >
          <BarChart2 :size="16" /> Exportar em Excel
        </button>
        <button
          type="button"
          :disabled="exportando"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 transition disabled:opacity-40"
          @click="onExportar('pdf')"
        >
          <FileText :size="16" /> Exportar em PDF (A4)
        </button>
      </div>
    </div>

    <!-- Filtros Rápido -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <select
        v-model="filtroEvento"
        class="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        @change="carregar"
      >
        <option value="">Todos os eventos</option>
        <option v-for="ev in eventos" :key="ev.id" :value="ev.id">
          {{ ev.nome }}
        </option>
      </select>

      <select
        v-model="filtroStatus"
        class="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        @change="carregar"
      >
        <option v-for="st in statusOpcoes" :key="st.valor" :value="st.valor">
          {{ st.label }}
        </option>
      </select>

      <input
        v-model="filtroBusca"
        type="text"
        placeholder="Buscar por nome, CPF ou nº do peito..."
        class="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-800 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        @keyup.enter="carregar"
      />
    </div>

    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
      <AlertTriangle :size="16" class="text-red-600" /> {{ erro }}
    </p>

    <div v-if="carregando" class="py-12 text-center text-xs text-slate-400">
      Carregando inscritos...
    </div>

    <div v-else-if="inscritos.length === 0" class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-xs text-slate-500">
      Nenhum inscrito encontrado com esses filtros.
    </div>

    <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-3.5 text-center">Nº Peito</th>
            <th class="px-4 py-3.5">Nome do Atleta</th>
            <th class="px-4 py-3.5">CPF</th>
            <th class="px-4 py-3.5">Evento</th>
            <th class="px-4 py-3.5">Modalidade / Categoria</th>
            <th class="px-4 py-3.5 text-center">Camisa</th>
            <th class="px-4 py-3.5 text-center">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="inscrito in inscritos"
            :key="inscrito.id"
            class="cursor-pointer hover:bg-blue-50/60 transition group"
            title="Clique para visualizar e editar os dados do atleta"
            @click="abrirModal360(inscrito)"
          >
            <!-- Coluna Número do Peito -->
            <td class="px-4 py-3.5 text-center font-mono font-black text-slate-900">
              <span v-if="inscrito.numeroPeito" class="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-xs shadow-2xs">
                #{{ inscrito.numeroPeito }}
              </span>
              <span v-else class="text-slate-400 font-normal">—</span>
            </td>

            <td class="px-4 py-3.5 group-hover:text-blue-600 transition">
              <div class="font-bold text-slate-900">{{ nomeCliente(inscrito) }}</div>
              <span v-if="compradorTitular(inscrito)" class="text-[10px] font-semibold text-slate-400 block">
                {{ compradorTitular(inscrito) }}
              </span>
            </td>
            <td class="px-4 py-3.5 text-slate-600 font-mono">{{ documentoCliente(inscrito) }}</td>
            <td class="px-4 py-3.5 font-semibold text-slate-700">{{ inscrito.categoria.modalidade.evento.nome }}</td>
            <td class="px-4 py-3.5 text-slate-600">{{ inscrito.categoria.modalidade.nome }} · {{ inscrito.categoria.nome }}</td>
            <td class="px-4 py-3.5 text-center font-bold text-slate-700">{{ inscrito.tamanhoCamisa || '—' }}</td>
            <td class="px-4 py-3.5 text-center">
              <span
                class="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] uppercase"
                :class="statusInfo[inscrito.status]?.classe || 'bg-slate-100 text-slate-500'"
              >
                {{ statusInfo[inscrito.status]?.texto || inscrito.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL DO ATLETA / INSCRIÇÃO -->
    <Teleport to="body">
      <div v-if="modalAberto && atletaSelecionado" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="modalAberto = false"></div>

        <div class="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl z-[301] p-6 space-y-5">
          <!-- Cabeçalho do Modal -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center text-lg">
                <Footprints :size="20" />
              </div>
              <div>
                <h3 class="font-black text-base text-slate-900">{{ nomeCliente(atletaSelecionado) }}</h3>
                <p class="text-xs text-slate-500">
                  CPF: {{ documentoCliente(atletaSelecionado) }} · {{ atletaSelecionado.cliente.usuario.email }}
                  <span v-if="compradorTitular(atletaSelecionado)" class="block text-orange-600 font-bold mt-0.5">
                    📌 {{ compradorTitular(atletaSelecionado) }}
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-xl bg-slate-100 p-2 text-xs font-bold text-slate-500 hover:bg-slate-200 transition inline-flex items-center gap-1"
              @click="modalAberto = false"
            >
              <X :size="13" /> Fechar
            </button>
          </div>

          <!-- Alerta de Sucesso -->
          <p v-if="sucessoModal" class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle :size="14" class="text-emerald-600" /> {{ sucessoModal }}
          </p>

          <!-- Dados do Evento e Edição -->
          <div class="space-y-4 text-xs">
            <div class="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2">
              <div class="flex justify-between">
                <span class="font-bold text-slate-500">Evento:</span>
                <span class="font-black text-slate-900">{{ atletaSelecionado.categoria.modalidade.evento.nome }}</span>
              </div>
              <div class="flex justify-between">
                <span class="font-bold text-slate-500">Data da Inscrição:</span>
                <span class="text-slate-700">{{ formatarData(atletaSelecionado.dataInscricao) }}</span>
              </div>
            </div>

            <!-- Formulário de Edição Completo -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <!-- Alterar Modalidade & Categoria -->
              <div class="sm:col-span-2">
                <label class="font-black text-slate-700 mb-1 flex items-center gap-1"><Footprints :size="14" /> Alterar Modalidade & Categoria</label>
                <div v-if="carregandoCategorias" class="text-slate-400 text-xs">Carregando modalidades do evento...</div>
                <select
                  v-else
                  v-model="formInscrito.categoriaId"
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                >
                  <option v-for="cat in categoriasDisponiveis" :key="cat.id" :value="cat.id">
                    {{ cat.nomeFormatado }}
                  </option>
                </select>
              </div>

              <!-- Editar Número do Peito -->
              <div>
                <label class="font-black text-slate-700 mb-1 flex items-center gap-1"><Hash :size="14" /> Número do Peito</label>
                <input
                  v-model="formInscrito.numeroPeito"
                  type="text"
                  placeholder="ex: 105"
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                />
              </div>

              <!-- Editar Tamanho da Camisa -->
              <div>
                <label class="font-black text-slate-700 mb-1 flex items-center gap-1"><Shirt :size="14" /> Tamanho da Camisa</label>
                <select
                  v-model="formInscrito.tamanhoCamisa"
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                >
                  <option value="PP">PP</option>
                  <option value="P">P</option>
                  <option value="M">M</option>
                  <option value="G">G</option>
                  <option value="GG">GG</option>
                  <option value="XGG">XGG</option>
                  <option value="Não informado">Não informado</option>
                </select>
              </div>

              <!-- Editar Status da Inscrição -->
              <div class="sm:col-span-2">
                <label class="font-black text-slate-700 mb-1 flex items-center gap-1"><CreditCard :size="14" /> Status da Inscrição</label>
                <select
                  v-model="formInscrito.status"
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                >
                  <option value="CONFIRMADA">🟢 Confirmada (Kit Liberado)</option>
                  <option value="PENDENTE_PAGAMENTO">🟡 Pagamento Pendente</option>
                  <option value="CANCELADA">🔴 Cancelada</option>
                  <option value="EXPIRADA">⚪ Expirada</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Rodapé de Ações do Modal -->
          <div class="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              @click="modalAberto = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              :disabled="salvandoModal"
              class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:brightness-95 transition disabled:opacity-40"
              @click="salvarEdicao360"
            >
              <Save :size="14" /> {{ salvandoModal ? 'Salvando...' : 'Salvar Alterações' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- MODAL: INSCRITOS AGRUPADOS POR CATEGORIA -->
    <Teleport to="body">
      <div v-if="modalCategoriasAberto" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="modalCategoriasAberto = false"></div>

        <div class="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl z-[301] max-h-[85vh]">
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h3 class="font-black text-base text-slate-900 flex items-center gap-2">
                <ListTree :size="18" class="text-primary" /> Inscritos por Categoria
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Mesma numeração de peito de sempre — só agrupada pra facilitar a visualização.
              </p>
            </div>
            <button
              type="button"
              class="rounded-xl bg-slate-100 p-2 text-xs font-bold text-slate-500 hover:bg-slate-200 transition inline-flex items-center gap-1"
              @click="modalCategoriasAberto = false"
            >
              <X :size="13" /> Fechar
            </button>
          </div>

          <div v-if="inscritosPorCategoria.length === 0" class="px-6 py-12 text-center text-xs text-slate-400">
            Nenhum inscrito pra agrupar com os filtros atuais.
          </div>

          <template v-else>
            <!-- Abas por categoria -->
            <div class="flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 pt-3">
              <button
                v-for="grupo in inscritosPorCategoria"
                :key="grupo.id"
                type="button"
                class="flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-3.5 py-2 text-xs font-bold transition"
                :class="
                  grupoCategoriaAtivo?.id === grupo.id
                    ? 'border-slate-200 bg-white text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                "
                @click="abaCategoriaAtiva = grupo.id"
              >
                {{ grupo.titulo }}
                <span
                  class="rounded-full px-1.5 py-0.5 text-[10px]"
                  :class="grupoCategoriaAtivo?.id === grupo.id ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'"
                >
                  {{ grupo.itens.length }}
                </span>
              </button>
            </div>

            <!-- Conteúdo da aba ativa -->
            <div class="overflow-y-auto px-6 py-4">
              <div v-if="grupoCategoriaAtivo" class="overflow-x-auto rounded-2xl border border-slate-200">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th class="px-3 py-2 text-center">Nº Peito</th>
                      <th class="px-3 py-2">Nome do Atleta</th>
                      <th class="px-3 py-2">CPF</th>
                      <th class="px-3 py-2 text-center">Camisa</th>
                      <th class="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="inscrito in grupoCategoriaAtivo.itens"
                      :key="inscrito.id"
                      class="cursor-pointer hover:bg-blue-50/60 transition"
                      title="Clique para visualizar e editar os dados do atleta"
                      @click="modalCategoriasAberto = false; abrirModal360(inscrito)"
                    >
                      <td class="px-3 py-2.5 text-center font-mono font-black text-slate-900">
                        <span v-if="inscrito.numeroPeito" class="rounded-lg bg-slate-900 text-white px-2 py-1 text-[11px] shadow-2xs">
                          #{{ inscrito.numeroPeito }}
                        </span>
                        <span v-else class="text-slate-400 font-normal">—</span>
                      </td>
                      <td class="px-3 py-2.5">
                        <div class="font-bold text-slate-900">{{ nomeCliente(inscrito) }}</div>
                        <span v-if="compradorTitular(inscrito)" class="text-[10px] font-semibold text-slate-400 block">
                          {{ compradorTitular(inscrito) }}
                        </span>
                      </td>
                      <td class="px-3 py-2.5 text-slate-600 font-mono">{{ documentoCliente(inscrito) }}</td>
                      <td class="px-3 py-2.5 text-center font-bold text-slate-700">{{ inscrito.tamanhoCamisa || '—' }}</td>
                      <td class="px-3 py-2.5 text-center">
                        <span
                          class="whitespace-nowrap rounded-full px-2 py-1 text-[10px] uppercase"
                          :class="statusInfo[inscrito.status]?.classe || 'bg-slate-100 text-slate-500'"
                        >
                          {{ statusInfo[inscrito.status]?.texto || inscrito.status }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
