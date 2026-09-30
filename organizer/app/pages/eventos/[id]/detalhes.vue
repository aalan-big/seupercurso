<script setup lang="ts">
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type TooltipItem
} from 'chart.js'
import { Doughnut, Bar } from 'vue-chartjs'
import { ArrowLeft, Pencil, Users, MapPin, CalendarDays, Info } from 'lucide-vue-next'
import type { EstatisticasEvento } from '../../../composables/useEstatisticasEvento'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const route = useRoute()
const id = route.params.id as string

const { buscar } = useEstatisticasEvento()

const dados = ref<EstatisticasEvento | null>(null)
const carregando = ref(true)
const atualizando = ref(false)
const erro = ref('')

const modalidadeId = ref('')
const incluirPendentes = ref(false)

async function carregar() {
  erro.value = ''
  try {
    dados.value = await buscar(id, {
      incluirPendentes: incluirPendentes.value,
      modalidadeId: modalidadeId.value || undefined
    })
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

onMounted(async () => {
  await carregar()
  carregando.value = false
})

watch([modalidadeId, incluirPendentes], async () => {
  atualizando.value = true
  await carregar()
  atualizando.value = false
})

const CORES_GENERO = {
  MASCULINO: '#2563EB',
  FEMININO: '#EC4899',
  OUTRO: '#8B5CF6',
  NAO_INFORMADO: '#CBD5E1'
} as const
const ROTULOS_GENERO = {
  MASCULINO: 'Homens',
  FEMININO: 'Mulheres',
  OUTRO: 'Outro',
  NAO_INFORMADO: 'Não informado'
} as const
const GENEROS = ['MASCULINO', 'FEMININO', 'OUTRO', 'NAO_INFORMADO'] as const
const PALETA = ['#ff7202', '#0F172A', '#10B981', '#2563EB', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#64748B']

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function porcentagem(parte: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((parte / total) * 100)}%`
}

const totalContado = computed(() => dados.value?.total ?? 0)

const cards = computed(() => {
  if (!dados.value) return []
  const { resumo, evento } = dados.value
  const lista = [
    {
      label: incluirPendentes.value ? 'Inscritos (com pendentes)' : 'Inscritos confirmados',
      valor: String(totalContado.value),
      detalhe: evento.capacidade ? `de ${evento.capacidade} vagas` : 'sem limite de vagas',
      cor: 'text-slate-900'
    },
    {
      label: 'Vagas ocupadas',
      valor: evento.capacidade ? porcentagem(totalContado.value, evento.capacidade) : '—',
      detalhe: evento.capacidade
        ? `${Math.max(evento.capacidade - totalContado.value, 0)} vagas livres`
        : 'evento sem capacidade definida',
      cor: 'text-emerald-600'
    },
    {
      label: 'Aguardando pagamento',
      valor: String(resumo.pendentes),
      detalhe: 'PIX ou cartão ainda não pagos',
      cor: 'text-amber-500'
    },
    {
      label: 'Kits entregues',
      valor: String(resumo.kitsEntregues),
      detalhe: `de ${resumo.confirmadas} confirmados`,
      cor: 'text-blue-600'
    },
    {
      label: 'Canceladas / expiradas',
      valor: String(resumo.canceladas),
      detalhe: 'não entram nos números abaixo',
      cor: 'text-red-500'
    }
  ]
  return lista
})

// Rosca com a porcentagem no tooltip: "Mulheres: 42 (38%)".
const opcoesRosca = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    legend: { position: 'bottom' as const, labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
    tooltip: {
      callbacks: {
        label: (ctx: TooltipItem<'doughnut'>) => {
          const valores = ctx.dataset.data as number[]
          const total = valores.reduce((a, b) => a + b, 0)
          return ` ${ctx.label}: ${ctx.parsed} (${porcentagem(ctx.parsed, total)})`
        }
      }
    }
  }
}

const dadosGenero = computed(() => {
  if (!dados.value || totalContado.value === 0) return null
  const generos = GENEROS.filter((g) => dados.value!.genero[g] > 0)
  return {
    labels: generos.map((g) => ROTULOS_GENERO[g]),
    datasets: [
      {
        data: generos.map((g) => dados.value!.genero[g]),
        backgroundColor: generos.map((g) => CORES_GENERO[g]),
        borderWidth: 0
      }
    ]
  }
})

const dadosModalidades = computed(() => {
  if (!dados.value || dados.value.modalidades.length === 0) return null
  const lista = dados.value.modalidades
  return {
    labels: lista.map((m) => m.nome),
    datasets: [
      {
        data: lista.map((m) => m.total),
        backgroundColor: lista.map((_, i) => PALETA[i % PALETA.length]),
        borderWidth: 0
      }
    ]
  }
})

const dadosPublico = computed(() => {
  if (!dados.value || totalContado.value === 0) return null
  const { idosos } = dados.value.publicos
  const { semIdade } = dados.value.idade
  const adultos = totalContado.value - idosos - semIdade
  const fatias = [
    { label: 'Menos de 60 anos', valor: adultos, cor: '#0F172A' },
    { label: '60 anos ou mais', valor: idosos, cor: '#ff7202' },
    { label: 'Sem data de nascimento', valor: semIdade, cor: '#CBD5E1' }
  ].filter((f) => f.valor > 0)
  return {
    labels: fatias.map((f) => f.label),
    datasets: [{ data: fatias.map((f) => f.valor), backgroundColor: fatias.map((f) => f.cor), borderWidth: 0 }]
  }
})

const dadosEstados = computed(() => {
  if (!dados.value || dados.value.origem.estados.length === 0) return null
  const lista = dados.value.origem.estados
  return {
    labels: lista.map((e) => e.estado),
    datasets: [
      {
        data: lista.map((e) => e.total),
        backgroundColor: lista.map((_, i) => PALETA[i % PALETA.length]),
        borderWidth: 0
      }
    ]
  }
})

// Barras empilhadas: cada faixa de idade dividida em homens e mulheres.
const dadosFaixas = computed(() => {
  if (!dados.value || totalContado.value === 0) return null
  const faixas = dados.value.idade.faixas
  const generos = GENEROS.filter((g) => faixas.some((f) => f[g] > 0))
  return {
    labels: faixas.map((f) => f.faixa),
    datasets: generos.map((g) => ({
      label: ROTULOS_GENERO[g],
      data: faixas.map((f) => f[g]),
      backgroundColor: CORES_GENERO[g],
      borderRadius: 6,
      maxBarThickness: 48
    }))
  }
})

const opcoesFaixas = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { boxWidth: 12, padding: 14, font: { size: 12 } } }
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { color: '#64748B', font: { size: 11 } } },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: { color: '#E2E8F0' },
      ticks: { color: '#94A3B8', font: { size: 11 }, precision: 0 }
    }
  }
}

const publicos = computed(() => {
  if (!dados.value) return []
  const p = dados.value.publicos
  return [
    { label: 'Idosos (60+ na data da prova)', valor: p.idosos },
    { label: 'Com desconto de idoso', valor: p.descontoIdoso },
    { label: 'Pessoas com deficiência (PCD)', valor: p.pcd },
    { label: 'Com desconto PCD', valor: p.descontoPcd },
    { label: 'Servidores públicos', valor: p.servidorPublico },
    { label: 'Funcionários da empresa', valor: p.funcionario },
    { label: 'Usaram cupom', valor: p.cupom }
  ]
})

const maiorCidade = computed(() => dados.value?.origem.cidades[0]?.total ?? 0)
</script>

<template>
  <div>
    <NuxtLink to="/eventos" class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary">
      <ArrowLeft :size="14" /> Meus eventos
    </NuxtLink>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <template v-if="!carregando && dados">
      <!-- Cabeçalho -->
      <div class="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">{{ dados.evento.nome }}</h1>
          <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span class="inline-flex items-center gap-1"><CalendarDays :size="14" /> {{ formatarData(dados.evento.dataInicio) }}</span>
            <span class="inline-flex items-center gap-1"><MapPin :size="14" /> {{ dados.evento.cidade }}/{{ dados.evento.estado }}</span>
          </p>
        </div>
        <div class="flex gap-2">
          <NuxtLink
            :to="`/eventos/${id}/editar`"
            class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-primary"
          >
            <Pencil :size="14" /> Editar evento
          </NuxtLink>
          <NuxtLink
            to="/inscritos"
            class="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
          >
            <Users :size="14" /> Lista de inscritos
          </NuxtLink>
        </div>
      </div>

      <!-- Filtros -->
      <div class="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <label class="flex items-center gap-2 text-sm">
          <span class="font-bold text-slate-500">Modalidade:</span>
          <select v-model="modalidadeId" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todas</option>
            <option v-for="m in dados.modalidadesDisponiveis" :key="m.id" :value="m.id">{{ m.nome }}</option>
          </select>
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600 sm:ml-4">
          <input v-model="incluirPendentes" type="checkbox" class="h-4 w-4 accent-orange-500">
          Incluir quem ainda não pagou
        </label>
        <span v-if="atualizando" class="text-xs text-slate-400 sm:ml-auto">Atualizando...</span>
      </div>

      <div :class="{ 'opacity-60 transition-opacity': atualizando }">
        <!-- Resumo -->
        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div v-for="card in cards" :key="card.label" class="flex flex-col justify-between space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p class="text-3xl font-black tracking-tight" :class="card.cor">{{ card.valor }}</p>
            <div>
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
              <p class="mt-0.5 text-xs text-slate-400">{{ card.detalhe }}</p>
            </div>
          </div>
        </div>

        <div v-if="totalContado === 0" class="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          Nenhuma inscrição {{ incluirPendentes ? '' : 'confirmada ' }}ainda. Os gráficos aparecem assim que as inscrições chegarem.
        </div>

        <template v-else>
          <!-- Roscas: gênero, modalidade, idosos -->
          <div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Homens e mulheres</h2>
              <div class="mx-auto mt-4 h-64 max-w-xs">
                <Doughnut v-if="dadosGenero" :data="dadosGenero" :options="opcoesRosca" />
              </div>
              <div class="mt-4 grid grid-cols-2 gap-2 text-center">
                <div class="rounded-xl bg-blue-50 p-2">
                  <p class="text-xl font-black text-blue-600">{{ dados.genero.MASCULINO }}</p>
                  <p class="text-[11px] font-bold uppercase text-blue-400">Homens · {{ porcentagem(dados.genero.MASCULINO, totalContado) }}</p>
                </div>
                <div class="rounded-xl bg-pink-50 p-2">
                  <p class="text-xl font-black text-pink-600">{{ dados.genero.FEMININO }}</p>
                  <p class="text-[11px] font-bold uppercase text-pink-400">Mulheres · {{ porcentagem(dados.genero.FEMININO, totalContado) }}</p>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Por modalidade</h2>
              <div class="mx-auto mt-4 h-64 max-w-xs">
                <Doughnut v-if="dadosModalidades" :data="dadosModalidades" :options="opcoesRosca" />
              </div>
              <ul class="mt-4 space-y-1.5 text-sm">
                <li v-for="m in dados.modalidades" :key="m.id" class="flex items-center justify-between gap-2">
                  <span class="truncate font-semibold text-slate-700">{{ m.nome }}</span>
                  <span class="shrink-0 text-xs text-slate-500">
                    <b class="text-slate-800">{{ m.total }}</b>
                    · <span class="text-blue-600">{{ m.MASCULINO }} H</span>
                    · <span class="text-pink-600">{{ m.FEMININO }} M</span>
                  </span>
                </li>
              </ul>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-1">
              <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Idosos</h2>
              <div class="mx-auto mt-4 h-64 max-w-xs">
                <Doughnut v-if="dadosPublico" :data="dadosPublico" :options="opcoesRosca" />
              </div>
              <div class="mt-4 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-xl bg-slate-50 p-2">
                  <p class="text-xl font-black text-slate-800">{{ dados.idade.media ?? '—' }}</p>
                  <p class="text-[11px] font-bold uppercase text-slate-400">Idade média</p>
                </div>
                <div class="rounded-xl bg-slate-50 p-2">
                  <p class="text-xl font-black text-slate-800">{{ dados.idade.maisNovo ?? '—' }}</p>
                  <p class="text-[11px] font-bold uppercase text-slate-400">Mais novo</p>
                </div>
                <div class="rounded-xl bg-slate-50 p-2">
                  <p class="text-xl font-black text-slate-800">{{ dados.idade.maisVelho ?? '—' }}</p>
                  <p class="text-[11px] font-bold uppercase text-slate-400">Mais velho</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Faixa etária -->
          <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Faixa etária (idade no dia da prova)</h2>
            <div class="mt-4 h-72">
              <Bar v-if="dadosFaixas" :data="dadosFaixas" :options="opcoesFaixas" />
            </div>
          </div>

          <!-- Públicos -->
          <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Públicos e descontos</h2>
            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              <div v-for="p in publicos" :key="p.label" class="rounded-xl bg-slate-50 p-3">
                <p class="text-2xl font-black text-slate-800">{{ p.valor }}</p>
                <p class="mt-0.5 text-[11px] font-bold uppercase leading-tight text-slate-500">{{ p.label }}</p>
                <p class="mt-1 text-[11px] text-slate-400">{{ porcentagem(p.valor, totalContado) }} do total</p>
              </div>
            </div>
          </div>

          <!-- Origem -->
          <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">
                De onde vêm · {{ dados.origem.totalCidades }} {{ dados.origem.totalCidades === 1 ? 'cidade' : 'cidades' }}
              </h2>
              <ul class="mt-4 space-y-2.5">
                <li v-for="c in dados.origem.cidades" :key="`${c.cidade}-${c.estado}`">
                  <div class="flex justify-between text-sm">
                    <span class="font-semibold text-slate-700">{{ c.cidade }}/{{ c.estado }}</span>
                    <span class="text-slate-500"><b class="text-slate-800">{{ c.total }}</b> · {{ porcentagem(c.total, totalContado) }}</span>
                  </div>
                  <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-warning" :style="{ width: `${(c.total / maiorCidade) * 100}%` }" />
                  </div>
                </li>
                <li v-if="dados.origem.outrasCidades > 0" class="flex justify-between pt-1 text-sm text-slate-500">
                  <span>Outras cidades</span>
                  <b class="text-slate-700">{{ dados.origem.outrasCidades }}</b>
                </li>
                <li v-if="dados.origem.semEndereco > 0" class="flex justify-between text-sm text-slate-400">
                  <span>Sem endereço cadastrado</span>
                  <span>{{ dados.origem.semEndereco }}</span>
                </li>
              </ul>
              <p class="mt-4 flex items-start gap-1.5 text-xs text-slate-400">
                <Info :size="14" class="mt-px shrink-0" />
                A cidade é a do endereço da conta que fez a inscrição. Quem inscreveu familiares conta todos na própria cidade.
              </p>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Por estado</h2>
              <div class="mx-auto mt-4 h-64 max-w-xs">
                <Doughnut v-if="dadosEstados" :data="dadosEstados" :options="opcoesRosca" />
                <p v-else class="pt-16 text-center text-sm text-slate-400">Sem endereços cadastrados.</p>
              </div>
            </div>
          </div>

          <!-- Ritmo -->
          <div class="mt-6">
            <TendenciaChart titulo="Inscrições por dia — últimos 30 dias" :serie="dados.inscricoesPorDia" />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
