<script setup lang="ts">
import { BarChart2, AlertTriangle, Footprints, X, CheckCircle, Hash, Shirt, CreditCard, Save, ListTree, FileText } from 'lucide-vue-next'
import { urlFoto } from '../../utils/foto'

const { inscritos, fetchInscritos, exportarCsv, atualizarInscricao, conferirDocumentoIdoso } = useInscritosOrganizador()
const { eventos, fetchMeusEventos, fetchEvento } = useEventoOrganizador()
const config = useRuntimeConfig()

const carregando = ref(true)
const exportando = ref(false)
const salvandoModal = ref(false)
const carregandoCategorias = ref(false)
const erro = ref('')
const sucessoModal = ref('')

const filtroEvento = ref('')
const filtroStatus = ref('')
const filtroDocumentoIdoso = ref('')
const filtroBusca = ref('')

// Modal 360° State
const modalAberto = ref(false)
const atletaSelecionado = ref<(typeof inscritos.value)[number] | null>(null)
const categoriasDisponiveis = ref<{ id: string; nomeFormatado: string }[]>([])
const formInscrito = ref({
  numeroPeito: '',
  tamanhoCamisa: '',
  modeloCamisaId: '',
  categoriaId: '',
  status: 'CONFIRMADA'
})
const modelosDisponiveis = ref<{ id: string; nome: string; descricao?: string | null; fotoFrenteUrl?: string | null; fotoVersoUrl?: string | null }[]>([])
const fotoModalAmpliada = ref<string | null>(null)

const modeloSelecionadoNoModal = computed(() => {
  if (!formInscrito.value.modeloCamisaId) {
    if (atletaSelecionado.value?.modeloCamisa) return atletaSelecionado.value.modeloCamisa as any
    return null
  }
  return modelosDisponiveis.value.find((m) => m.id === formInscrito.value.modeloCamisaId) || atletaSelecionado.value?.modeloCamisa || null
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

// Eventos sem camisa nao tem tamanho pra mostrar nem editar. A lista pode
// misturar varios eventos, entao a coluna so some quando nenhum deles usa camisa.
function eventoPossuiCamisa(inscrito: any) {
  const evInscrito = inscrito.categoria?.modalidade?.evento
  const evento = eventos.value.find((e) => e.id === evInscrito?.id) || evInscrito
  return evento?.possuiCamisa !== false
}

function formatarCamisa(inscrito: any) {
  const evInscrito = inscrito.categoria?.modalidade?.evento
  const evento = eventos.value.find((e) => e.id === evInscrito?.id) || evInscrito
  if (evento?.possuiCamisa === false) return 'Sem camisa'
  if (evento?.camisaOpcional && inscrito.incluiCamisa === false) return 'Sem camisa'
  if (!inscrito.tamanhoCamisa) return '—'
  if (inscrito.modeloCamisa?.nome) {
    return `${inscrito.modeloCamisa.nome} (${inscrito.tamanhoCamisa})`
  }
  return inscrito.tamanhoCamisa
}

const mostrarColunaCamisa = computed(() => inscritos.value.some((i) => eventoPossuiCamisa(i)))

const atletaSelecionadoPossuiCamisa = computed(() => {
  if (!atletaSelecionado.value) return true
  const evInscrito = atletaSelecionado.value.categoria?.modalidade?.evento as any
  const evento = eventos.value.find((e) => e.id === evInscrito?.id) || evInscrito
  if (evento?.possuiCamisa === false) return false
  if (evento?.camisaOpcional && atletaSelecionado.value.incluiCamisa === false) return false
  return true
})

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
      busca: filtroBusca.value || undefined,
      documentoIdoso: filtroDocumentoIdoso.value || undefined
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
        busca: filtroBusca.value || undefined,
        documentoIdoso: filtroDocumentoIdoso.value || undefined
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
    modeloCamisaId: inscrito.modeloCamisa?.id || (inscrito as any).modeloCamisaId || '',
    categoriaId: (inscrito.categoria as any).id || '',
    status: inscrito.status
  }
  sucessoModal.value = ''
  mostrarRecusaIdoso.value = false
  motivoRecusaIdoso.value = ''
  fotoModalAmpliada.value = null
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
    modelosDisponiveis.value = (eventoCompleto.modelosCamisa as any) || []
  } catch {
    categoriasDisponiveis.value = []
    modelosDisponiveis.value = []
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
      tamanhoCamisa: atletaSelecionadoPossuiCamisa.value
        ? formInscrito.value.tamanhoCamisa
        : undefined,
      modeloCamisaId: atletaSelecionadoPossuiCamisa.value
        ? formInscrito.value.modeloCamisaId || undefined
        : undefined,
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

// Quem levou o desconto do idoso mandou documento com foto na inscricao; o
// organizador confere e registra aqui. Recusar nao cancela nada — so avisa o
// comprador por e-mail; a decisao final e do organizador.
function documentoIdosoUrl(inscrito: any): string | null {
  return urlFoto(inscrito.documentoIdosoUrl, config.public.apiBase as string)
}

const documentoIdosoInfo: Record<string, { texto: string; classe: string }> = {
  PENDENTE: { texto: 'Idoso · conferir documento', classe: 'bg-amber-100 text-amber-800' },
  APROVADO: { texto: 'Idade confirmada', classe: 'bg-emerald-100 text-emerald-800' },
  REJEITADO: { texto: 'Idade não confirmada', classe: 'bg-red-100 text-red-800' }
}

const conferindoDocumento = ref(false)
const motivoRecusaIdoso = ref('')
const mostrarRecusaIdoso = ref(false)

async function onConferirDocumentoIdoso(decisao: 'APROVADO' | 'REJEITADO') {
  if (!atletaSelecionado.value) return
  if (decisao === 'REJEITADO' && !motivoRecusaIdoso.value.trim()) {
    erro.value = 'Informe o motivo da recusa: ele vai no e-mail para o atleta.'
    return
  }
  erro.value = ''
  conferindoDocumento.value = true
  try {
    const atualizado = await conferirDocumentoIdoso(
      atletaSelecionado.value.id,
      decisao,
      decisao === 'REJEITADO' ? motivoRecusaIdoso.value.trim() : undefined
    )
    atletaSelecionado.value = { ...atletaSelecionado.value, ...atualizado }
    mostrarRecusaIdoso.value = false
    motivoRecusaIdoso.value = ''
    sucessoModal.value =
      decisao === 'APROVADO'
        ? 'Idade confirmada.'
        : 'Documento recusado. O comprador recebeu um e-mail com o motivo e seu contato.'
    await carregar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    conferindoDocumento.value = false
  }
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
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
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

      <select
        v-model="filtroDocumentoIdoso"
        class="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        @change="carregar"
      >
        <option value="">Desconto idoso: todos</option>
        <option value="PENDENTE">Documentos a conferir</option>
        <option value="APROVADO">Idade confirmada</option>
        <option value="REJEITADO">Idade não confirmada</option>
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
            <th v-if="mostrarColunaCamisa" class="px-4 py-3.5 text-center">Camisa</th>
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
              <span
                v-if="inscrito.documentoIdosoUrl"
                class="mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase"
                :class="documentoIdosoInfo[inscrito.documentoIdosoStatus || 'PENDENTE']?.classe"
                title="Levou desconto do idoso — abra a inscrição para conferir o documento"
              >
                {{ documentoIdosoInfo[inscrito.documentoIdosoStatus || 'PENDENTE']?.texto }}
              </span>
            </td>
            <td class="px-4 py-3.5 text-slate-600 font-mono">{{ documentoCliente(inscrito) }}</td>
            <td class="px-4 py-3.5 font-semibold text-slate-700">{{ inscrito.categoria.modalidade.evento.nome }}</td>
            <td class="px-4 py-3.5 text-slate-600">{{ inscrito.categoria.modalidade.nome }} · {{ inscrito.categoria.nome }}</td>
            <td v-if="mostrarColunaCamisa" class="px-4 py-3.5 text-center font-bold text-slate-700">
              {{ formatarCamisa(inscrito) }}
            </td>
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
      <div
        v-if="modalAberto && atletaSelecionado"
        class="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
        @keydown.window.escape="modalAberto = false"
      >
        <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="modalAberto = false"></div>

        <div class="relative flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl z-[301]">
          <!-- Cabeçalho do Modal (Fixo no topo) -->
          <div class="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6 shrink-0 bg-white">
            <div class="flex items-center gap-3 min-w-0">
              <div class="h-10 w-10 shrink-0 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center text-lg">
                <Footprints :size="20" />
              </div>
              <div class="min-w-0">
                <h3 class="font-black text-base text-slate-900 truncate">{{ nomeCliente(atletaSelecionado) }}</h3>
                <p class="text-xs text-slate-500 truncate">
                  CPF: {{ documentoCliente(atletaSelecionado) }} · {{ atletaSelecionado.cliente.usuario.email }}
                </p>
                <span v-if="compradorTitular(atletaSelecionado)" class="block text-orange-600 font-bold text-xs mt-0.5 truncate">
                  📌 {{ compradorTitular(atletaSelecionado) }}
                </span>
              </div>
            </div>
            <button
              type="button"
              class="rounded-xl bg-slate-100 p-2 text-xs font-bold text-slate-500 hover:bg-slate-200 transition inline-flex items-center gap-1 shrink-0 ml-2"
              @click="modalAberto = false"
            >
              <X :size="13" /> Fechar
            </button>
          </div>

          <!-- Conteúdo Rolável -->
          <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            <!-- Alerta de Sucesso -->
            <p v-if="sucessoModal" class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle :size="14" class="text-emerald-600 shrink-0" /> {{ sucessoModal }}
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

            <!-- Desconto do idoso: conferencia do documento -->
            <div
              v-if="atletaSelecionado.documentoIdosoUrl"
              class="rounded-2xl border p-4 space-y-3"
              :class="{
                'border-amber-200 bg-amber-50': (atletaSelecionado.documentoIdosoStatus || 'PENDENTE') === 'PENDENTE',
                'border-emerald-200 bg-emerald-50': atletaSelecionado.documentoIdosoStatus === 'APROVADO',
                'border-red-200 bg-red-50': atletaSelecionado.documentoIdosoStatus === 'REJEITADO'
              }"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="font-black text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle :size="14" /> Desconto do idoso
                </p>
                <span
                  class="rounded-md px-2 py-0.5 text-[10px] font-black uppercase"
                  :class="documentoIdosoInfo[atletaSelecionado.documentoIdosoStatus || 'PENDENTE']?.classe"
                >
                  {{ documentoIdosoInfo[atletaSelecionado.documentoIdosoStatus || 'PENDENTE']?.texto }}
                </span>
              </div>

              <p v-if="(atletaSelecionado.documentoIdosoStatus || 'PENDENTE') === 'PENDENTE'" class="text-slate-700">
                O atleta enviou um documento com foto pra comprovar 60+ anos. Abra o documento e confira se a data de nascimento bate.
              </p>
              <p v-else-if="atletaSelecionado.documentoIdosoStatus === 'REJEITADO'" class="text-red-800">
                <strong>Motivo da recusa:</strong> {{ atletaSelecionado.documentoIdosoMotivo }}<br />
                O comprador recebeu um e-mail com esse motivo e seu contato. Cobrar a diferença ou cancelar a inscrição fica a seu critério.
              </p>
              <p v-else class="text-emerald-800">Idade conferida e confirmada.</p>

              <div class="flex flex-wrap items-center gap-2">
                <a
                  :href="documentoIdosoUrl(atletaSelecionado) || '#'"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 px-3 py-1.5 font-bold text-slate-800 hover:bg-slate-100"
                >
                  <FileText :size="14" /> Ver documento
                </a>
                <template v-if="atletaSelecionado.documentoIdosoStatus !== 'APROVADO'">
                  <button
                    type="button"
                    :disabled="conferindoDocumento"
                    class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    @click="onConferirDocumentoIdoso('APROVADO')"
                  >
                    <CheckCircle :size="14" /> Confirmar idade
                  </button>
                  <button
                    v-if="atletaSelecionado.documentoIdosoStatus !== 'REJEITADO'"
                    type="button"
                    :disabled="conferindoDocumento"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    @click="mostrarRecusaIdoso = !mostrarRecusaIdoso"
                  >
                    <X :size="14" /> Recusar
                  </button>
                </template>
              </div>

              <div v-if="mostrarRecusaIdoso && atletaSelecionado.documentoIdosoStatus !== 'APROVADO'" class="space-y-2">
                <label class="font-black text-slate-700">Motivo da recusa (vai no e-mail pro atleta)</label>
                <textarea
                  v-model="motivoRecusaIdoso"
                  rows="3"
                  placeholder="Ex.: A data de nascimento do documento não confere com a informada na inscrição."
                  class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                ></textarea>
                <button
                  type="button"
                  :disabled="conferindoDocumento || !motivoRecusaIdoso.trim()"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white hover:bg-red-700 disabled:opacity-50"
                  @click="onConferirDocumentoIdoso('REJEITADO')"
                >
                  {{ conferindoDocumento ? 'Enviando...' : 'Recusar e avisar o atleta por e-mail' }}
                </button>
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
              <div v-if="atletaSelecionadoPossuiCamisa">
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

              <!-- Modelo da Camisa Escolhido -->
              <div v-if="atletaSelecionadoPossuiCamisa" class="sm:col-span-2 space-y-2">
                <label class="font-black text-slate-700 flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <Shirt :size="14" class="text-orange-500" /> Modelo da Camiseta Escolhido
                  </span>
                  <span v-if="modeloSelecionadoNoModal" class="text-[11px] font-black text-orange-600">
                    {{ modeloSelecionadoNoModal.nome }}
                  </span>
                </label>

                <!-- Se o evento tiver modelos cadastrados, permite visualizar e alterar -->
                <div v-if="modelosDisponiveis.length > 0" class="space-y-2.5">
                  <select
                    v-model="formInscrito.modeloCamisaId"
                    class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                  >
                    <option value="">Selecione o modelo...</option>
                    <option v-for="mod in modelosDisponiveis" :key="mod.id" :value="mod.id">
                      {{ mod.nome }}
                    </option>
                  </select>

                  <!-- Preview do Modelo Selecionado (com Foto, Nome e Descrição) -->
                  <div
                    v-if="modeloSelecionadoNoModal"
                    class="p-3 rounded-xl border border-orange-200 bg-orange-50/50 flex items-center gap-3"
                  >
                    <div
                      v-if="modeloSelecionadoNoModal.fotoFrenteUrl || modeloSelecionadoNoModal.fotoVersoUrl"
                      class="w-14 h-14 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5 cursor-pointer shadow-2xs hover:scale-105 transition"
                      title="Clique para ampliar"
                      @click="fotoModalAmpliada = urlFoto(modeloSelecionadoNoModal.fotoFrenteUrl || modeloSelecionadoNoModal.fotoVersoUrl, config.public.apiBase as string)"
                    >
                      <img
                        :src="urlFoto(modeloSelecionadoNoModal.fotoFrenteUrl || modeloSelecionadoNoModal.fotoVersoUrl, config.public.apiBase as string)!"
                        :alt="modeloSelecionadoNoModal.nome"
                        class="w-full h-full object-contain"
                      />
                    </div>
                    <div
                      v-else
                      class="w-14 h-14 rounded-lg bg-orange-100/60 border border-orange-200 text-orange-600 shrink-0 flex items-center justify-center"
                    >
                      <Shirt :size="24" />
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-xs font-black text-slate-900">{{ modeloSelecionadoNoModal.nome }}</span>
                        <span class="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">Modelo Selecionado</span>
                      </div>
                      <p v-if="modeloSelecionadoNoModal.descricao" class="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {{ modeloSelecionadoNoModal.descricao }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Caso o evento tenha modelo único gravado ou padrão -->
                <div v-else class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Shirt :size="16" class="text-slate-500" />
                    <span class="font-bold text-slate-800">{{ atletaSelecionado.modeloCamisa?.nome || 'Modelo Único / Padrão' }}</span>
                  </div>
                  <span class="text-[11px] text-slate-400">Modelo padrão do evento</span>
                </div>
              </div>

              <!-- Se a prova tem camisa opcional e o atleta escolheu NÃO incluir camisa -->
              <div v-else class="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 flex items-center gap-2">
                <Shirt :size="16" class="text-slate-400 shrink-0" />
                <span>Inscrição realizada <strong>sem camiseta oficial</strong> (opção sem camisa ou evento sem camisa).</span>
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
        </div>

          <!-- Rodapé de Ações do Modal (Fixo na base) -->
          <div class="flex items-center justify-end gap-3 border-t border-slate-100 p-4 sm:px-6 shrink-0 bg-slate-50">
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
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
                      <th v-if="mostrarColunaCamisa" class="px-3 py-2 text-center">Camisa</th>
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
                      <td v-if="mostrarColunaCamisa" class="px-3 py-2.5 text-center font-bold text-slate-700">
                        {{ formatarCamisa(inscrito) }}
                      </td>
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

    <!-- MODAL FOTO AMPLIADA -->
    <Teleport to="body">
      <div
        v-if="fotoModalAmpliada"
        class="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
        @click="fotoModalAmpliada = null"
      >
        <div class="relative max-w-lg w-full bg-white rounded-3xl p-4 shadow-2xl space-y-3" @click.stop>
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <span class="text-xs font-bold text-slate-700">Foto do Modelo</span>
            <button
              type="button"
              class="rounded-xl bg-slate-100 p-1.5 text-xs text-slate-500 hover:bg-slate-200 transition"
              @click="fotoModalAmpliada = null"
            >
              <X :size="14" />
            </button>
          </div>
          <div class="h-80 w-full rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center">
            <img :src="fotoModalAmpliada" alt="Foto Ampliada" class="max-h-full max-w-full object-contain" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
