<script setup lang="ts">
import { AlertTriangle, ListTree, X } from 'lucide-vue-next'
import type { InscritoOrganizador } from '../composables/useInscritosOrganizador'
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

// Só leitura: busca os próprios dados, sem mexer na lista nem nos filtros da página.
const props = defineProps<{
  eventos: { id: string; nome: string }[]
  eventoInicial: string
  statusInfo: Record<string, { texto: string; classe: string }>
  nomeCliente: (inscrito: any) => string
  documentoCliente: (inscrito: any) => string
  compradorTitular: (inscrito: any) => string | null
  formatarCamisa: (inscrito: any) => string
  eventoPossuiCamisa: (inscrito: any) => boolean
}>()

const emit = defineEmits<{
  fechar: []
  selecionar: [inscrito: InscritoOrganizador]
}>()

const { buscarInscritos } = useInscritosOrganizador()
const { fetchEvento } = useEventoOrganizador()

type InscritoComIds = InscritoOrganizador & {
  categoria: { id: string; modalidade: { id: string; distanciaKm?: string | null } }
}

interface GrupoCategoria {
  id: string
  nome: string
  itens: InscritoComIds[]
  confirmados: number
  pendentes: number
}

interface GrupoModalidade {
  id: string
  nome: string
  distanciaKm: number
  categorias: GrupoCategoria[]
  confirmados: number
  pendentes: number
}

const eventoId = ref(props.eventoInicial)
const modalidadeId = ref('')
const categoriaId = ref('')
const status = ref<'' | 'CONFIRMADA' | 'PENDENTE_PAGAMENTO'>('CONFIRMADA')

const carregando = ref(false)
const erro = ref('')
const inscritos = shallowRef<InscritoComIds[]>([])
const evento = shallowRef<EventoOrganizador | null>(null)

// Trocar de evento rápido pode fazer a resposta antiga chegar por último.
let ultimaBusca = 0

async function carregar() {
  const busca = ++ultimaBusca
  const id = eventoId.value
  erro.value = ''
  inscritos.value = []
  evento.value = null
  modalidadeId.value = ''
  categoriaId.value = ''
  if (!id) {
    carregando.value = false
    return
  }

  carregando.value = true
  try {
    const [lista, detalhe] = await Promise.all([
      buscarInscritos({ eventoId: id, status: 'ATIVAS' }),
      // Serve só pra mostrar as categorias vazias: sem ele a lista ainda funciona.
      fetchEvento(id).catch(() => null)
    ])
    if (busca !== ultimaBusca) return
    inscritos.value = lista as InscritoComIds[]
    evento.value = detalhe
  } catch (e) {
    if (busca === ultimaBusca) erro.value = extrairErro(e)
  } finally {
    if (busca === ultimaBusca) carregando.value = false
  }
}

function paraKm(valor: string | number | null | undefined) {
  return valor == null || Number.isNaN(Number(valor)) ? Infinity : Number(valor)
}

function numeroPeito(inscrito: InscritoOrganizador) {
  const numero = Number(inscrito.numeroPeito)
  return inscrito.numeroPeito && !Number.isNaN(numero) ? numero : Number.MAX_SAFE_INTEGER
}

const modalidades = computed<GrupoModalidade[]>(() => {
  const grupos = new Map<string, GrupoModalidade>()

  function obterModalidade(m: { id: string; nome: string; distanciaKm?: string | null }) {
    let grupo = grupos.get(m.id)
    if (!grupo) {
      grupo = { id: m.id, nome: m.nome, distanciaKm: paraKm(m.distanciaKm), categorias: [], confirmados: 0, pendentes: 0 }
      grupos.set(m.id, grupo)
    }
    return grupo
  }

  function obterCategoria(grupo: GrupoModalidade, c: { id: string; nome: string }) {
    let categoria = grupo.categorias.find((x) => x.id === c.id)
    if (!categoria) {
      categoria = { id: c.id, nome: c.nome, itens: [], confirmados: 0, pendentes: 0 }
      grupo.categorias.push(categoria)
    }
    return categoria
  }

  for (const m of evento.value?.modalidades ?? []) {
    const grupo = obterModalidade(m)
    for (const c of m.categorias ?? []) obterCategoria(grupo, c)
  }

  for (const inscrito of inscritos.value) {
    const grupo = obterModalidade(inscrito.categoria.modalidade)
    const categoria = obterCategoria(grupo, inscrito.categoria)
    categoria.itens.push(inscrito)
    if (inscrito.status === 'CONFIRMADA') {
      categoria.confirmados++
      grupo.confirmados++
    } else if (inscrito.status === 'PENDENTE_PAGAMENTO') {
      categoria.pendentes++
      grupo.pendentes++
    }
  }

  const lista = [...grupos.values()]
  for (const grupo of lista) {
    grupo.categorias.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
  }
  return lista.sort((a, b) => {
    if (a.distanciaKm !== b.distanciaKm) return a.distanciaKm < b.distanciaKm ? -1 : 1
    return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })
  })
})

const totalConfirmados = computed(() => modalidades.value.reduce((s, m) => s + m.confirmados, 0))
const totalPendentes = computed(() => modalidades.value.reduce((s, m) => s + m.pendentes, 0))

const modalidadeAtiva = computed(
  () => modalidades.value.find((m) => m.id === modalidadeId.value) ?? modalidades.value[0] ?? null
)

const opcoesCategoria = computed(() => {
  const m = modalidadeAtiva.value
  if (!m) return []
  return [{ id: '', nome: 'Todas', confirmados: m.confirmados, pendentes: m.pendentes }, ...m.categorias]
})

const atletas = computed(() => {
  const categorias = modalidadeAtiva.value?.categorias ?? []
  return categorias
    .filter((c) => !categoriaId.value || c.id === categoriaId.value)
    .flatMap((c) => c.itens)
    .filter((i) => !status.value || i.status === status.value)
    .sort((a, b) => numeroPeito(a) - numeroPeito(b))
})

const mostrarCamisa = computed(() => inscritos.value.some((i) => props.eventoPossuiCamisa(i)))

const filtrosStatus = [
  { valor: 'CONFIRMADA', texto: 'Confirmados' },
  { valor: 'PENDENTE_PAGAMENTO', texto: 'Pendentes' },
  { valor: '', texto: 'Todos' }
] as const

function selecionarModalidade(id: string) {
  modalidadeId.value = id
  categoriaId.value = ''
}

function aoTeclar(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('fechar')
}

onMounted(() => {
  window.addEventListener('keydown', aoTeclar)
  carregar()
})

onBeforeUnmount(() => {
  ultimaBusca++
  window.removeEventListener('keydown', aoTeclar)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4">
      <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="emit('fechar')"></div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Inscritos por Categoria"
        class="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl z-[301] max-h-[90vh]"
      >
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <h3 class="font-black text-base text-slate-900 flex items-center gap-2">
              <ListTree :size="18" class="text-primary" /> Inscritos por Categoria
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Canceladas e expiradas não entram na conta.</p>
          </div>
          <button
            type="button"
            class="rounded-xl bg-slate-100 p-2 text-xs font-bold text-slate-500 hover:bg-slate-200 transition inline-flex items-center gap-1"
            @click="emit('fechar')"
          >
            <X :size="13" /> Fechar
          </button>
        </div>

        <div class="overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          <select
            v-model="eventoId"
            aria-label="Evento"
            class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            @change="carregar"
          >
            <option value="" disabled>Escolha o evento</option>
            <option v-for="ev in eventos" :key="ev.id" :value="ev.id">{{ ev.nome }}</option>
          </select>

          <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle :size="16" class="shrink-0 text-red-600" /> {{ erro }}
            <button type="button" class="ml-auto shrink-0 underline" @click="carregar">Tentar de novo</button>
          </p>
          <div v-else-if="carregando" class="py-12 text-center text-xs text-slate-400">Carregando inscritos...</div>
          <div v-else-if="!eventoId" class="py-12 text-center text-xs text-slate-400">
            Escolha um evento para ver os inscritos.
          </div>
          <div v-else-if="!modalidadeAtiva" class="py-12 text-center text-xs text-slate-400">
            Este evento ainda não tem modalidades nem inscritos.
          </div>

          <template v-else>
            <!-- Total por distância -->
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p class="text-[11px] font-bold uppercase text-slate-500">Total do evento</p>
                <p class="text-xl font-black text-slate-900">{{ totalConfirmados }}</p>
                <p class="text-[11px] text-slate-500">
                  confirmados<span v-if="totalPendentes" class="font-bold text-amber-700"> · {{ totalPendentes }} pend.</span>
                </p>
              </div>
              <button
                v-for="m in modalidades"
                :key="m.id"
                type="button"
                :aria-pressed="modalidadeAtiva.id === m.id"
                class="rounded-2xl border p-3 text-left transition"
                :class="modalidadeAtiva.id === m.id ? 'border-primary bg-primary/10' : 'border-slate-200 bg-white hover:bg-slate-50'"
                @click="selecionarModalidade(m.id)"
              >
                <p class="truncate text-[11px] font-bold uppercase text-slate-500" :title="m.nome">{{ m.nome }}</p>
                <p class="text-xl font-black text-primary">{{ m.confirmados }}</p>
                <p class="text-[11px] text-slate-500">
                  confirmados<span v-if="m.pendentes" class="font-bold text-amber-700"> · {{ m.pendentes }} pend.</span>
                </p>
              </button>
            </div>

            <!-- Categorias da distância escolhida -->
            <div>
              <p class="mb-2 text-[11px] font-bold uppercase text-slate-500">Categorias de {{ modalidadeAtiva.nome }}</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="c in opcoesCategoria"
                  :key="c.id"
                  type="button"
                  :aria-pressed="categoriaId === c.id"
                  class="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition"
                  :class="categoriaId === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
                  @click="categoriaId = c.id"
                >
                  {{ c.nome }}
                  <span class="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">{{ c.confirmados }}</span>
                  <span v-if="c.pendentes" class="shrink-0 text-[10px] text-amber-700">+{{ c.pendentes }} pend.</span>
                </button>
              </div>
            </div>

            <!-- Atletas -->
            <div>
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div class="flex gap-1.5">
                  <button
                    v-for="f in filtrosStatus"
                    :key="f.valor"
                    type="button"
                    :aria-pressed="status === f.valor"
                    class="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition"
                    :class="status === f.valor ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                    @click="status = f.valor"
                  >
                    {{ f.texto }}
                  </button>
                </div>
                <span class="text-[11px] font-bold text-slate-500">
                  {{ atletas.length }} {{ atletas.length === 1 ? 'atleta' : 'atletas' }}
                </span>
              </div>

              <div v-if="atletas.length === 0" class="rounded-2xl border border-slate-200 py-10 text-center text-xs text-slate-400">
                Nenhum inscrito aqui.
              </div>
              <div v-else class="overflow-x-auto rounded-2xl border border-slate-200">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th class="px-3 py-2 text-center">Nº Peito</th>
                      <th class="px-3 py-2">Nome do Atleta</th>
                      <th v-if="!categoriaId" class="px-3 py-2">Categoria</th>
                      <th class="px-3 py-2">CPF</th>
                      <th v-if="mostrarCamisa" class="px-3 py-2 text-center">Camisa</th>
                      <th class="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="inscrito in atletas"
                      :key="inscrito.id"
                      class="cursor-pointer hover:bg-blue-50/60 transition"
                      title="Clique para visualizar e editar os dados do atleta"
                      @click="emit('selecionar', inscrito)"
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
                      <td v-if="!categoriaId" class="px-3 py-2.5 text-slate-600">{{ inscrito.categoria.nome }}</td>
                      <td class="px-3 py-2.5 text-slate-600 font-mono">{{ documentoCliente(inscrito) }}</td>
                      <td v-if="mostrarCamisa" class="px-3 py-2.5 text-center font-bold text-slate-700">
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
    </div>
  </Teleport>
</template>
