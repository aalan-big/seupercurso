<script setup lang="ts">
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{
  evento?: EventoOrganizador | null
  carregando?: boolean
  modoEdicao?: boolean
}>()

const emit = defineEmits<{ submit: [payload: Record<string, unknown>] }>()

const estadosBr = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
]

const statusOpcoes = computed(() => {
  const opcoes = [{ valor: 'RASCUNHO', label: 'Rascunho' }]

  if (props.evento?.status === 'PUBLICADO') {
    opcoes.push({ valor: 'PUBLICADO', label: 'Publicado' })
  } else {
    opcoes.push({ valor: 'AGUARDANDO_APROVACAO', label: 'Enviar pra revisão' })
  }

  opcoes.push(
    { valor: 'INSCRICOES_ENCERRADAS', label: 'Inscrições encerradas' },
    { valor: 'CANCELADO', label: 'Cancelado' }
  )
  return opcoes
})

const tipoEsporteSelecionado = ref('CORRIDA')

const form = reactive({
  nome: props.evento?.nome ?? '',
  descricao: props.evento?.descricao ?? '',
  local: props.evento?.local ?? '',
  cidade: props.evento?.cidade ?? '',
  estado: props.evento?.estado ?? '',
  dataInicio: props.evento?.dataInicio?.slice(0, 10) ?? '',
  dataFim: props.evento?.dataFim?.slice(0, 10) ?? '',
  capacidade: props.evento?.capacidade ?? (undefined as number | undefined),
  regulamentoUrl: props.evento?.regulamentoUrl?.startsWith('/uploads/') ? '' : (props.evento?.regulamentoUrl ?? ''),
  termoResponsabilidade: props.evento?.termoResponsabilidade ?? '',
  retiradaKitLocal: props.evento?.retiradaKitLocal ?? '',
  retiradaKitInicio: props.evento?.retiradaKitInicio?.slice(0, 16) ?? '',
  retiradaKitFim: props.evento?.retiradaKitFim?.slice(0, 16) ?? '',
  taxaRepassadaAtleta: props.evento?.taxaRepassadaAtleta ?? true,
  aceitaPix: props.evento?.aceitaPix ?? true,
  aceitaCartao: props.evento?.aceitaCartao ?? true,
  status: props.evento?.status ?? 'RASCUNHO'
})

// Mesmos campos exigidos pelo CreateEventoDto/UpdateEventoDto no backend.
const camposObrigatorios = ['nome', 'local', 'cidade', 'estado', 'dataInicio', 'dataFim'] as const

const tentouEnviar = ref(false)
const erroValidacao = ref('')

function invalido(campo: (typeof camposObrigatorios)[number]) {
  return tentouEnviar.value && !form[campo]
}

function classeCampo(campo: (typeof camposObrigatorios)[number]) {
  return invalido(campo)
    ? 'w-full rounded-xl border border-red-400 px-4 py-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200'
    : 'w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'
}

const regAtual = computed(() =>
  props.evento?.regulamentoUrl?.startsWith('/uploads/') ? '' : (props.evento?.regulamentoUrl ?? '')
)

const temAlteracoes = computed(() => {
  if (!props.evento) return true
  return (
    form.nome !== (props.evento.nome ?? '') ||
    form.descricao !== (props.evento.descricao ?? '') ||
    form.local !== (props.evento.local ?? '') ||
    form.cidade !== (props.evento.cidade ?? '') ||
    form.estado !== (props.evento.estado ?? '') ||
    form.dataInicio !== (props.evento.dataInicio?.slice(0, 10) ?? '') ||
    form.dataFim !== (props.evento.dataFim?.slice(0, 10) ?? '') ||
    form.capacidade !== (props.evento.capacidade ?? undefined) ||
    form.regulamentoUrl !== regAtual.value ||
    form.termoResponsabilidade !== (props.evento.termoResponsabilidade ?? '') ||
    form.retiradaKitLocal !== (props.evento.retiradaKitLocal ?? '') ||
    form.retiradaKitInicio !== (props.evento.retiradaKitInicio?.slice(0, 16) ?? '') ||
    form.retiradaKitFim !== (props.evento.retiradaKitFim?.slice(0, 16) ?? '') ||
    form.taxaRepassadaAtleta !== (props.evento.taxaRepassadaAtleta ?? true) ||
    form.aceitaPix !== (props.evento.aceitaPix ?? true) ||
    form.aceitaCartao !== (props.evento.aceitaCartao ?? true) ||
    form.status !== (props.evento.status ?? 'RASCUNHO')
  )
})

watch(
  () => props.evento,
  (ev) => {
    if (ev) {
      form.nome = ev.nome ?? ''
      form.descricao = ev.descricao ?? ''
      form.local = ev.local ?? ''
      form.cidade = ev.cidade ?? ''
      form.estado = ev.estado ?? ''
      form.dataInicio = ev.dataInicio?.slice(0, 10) ?? ''
      form.dataFim = ev.dataFim?.slice(0, 10) ?? ''
      form.capacidade = ev.capacidade ?? undefined
      form.regulamentoUrl = ev.regulamentoUrl?.startsWith('/uploads/') ? '' : (ev.regulamentoUrl ?? '')
      form.termoResponsabilidade = ev.termoResponsabilidade ?? ''
      form.retiradaKitLocal = ev.retiradaKitLocal ?? ''
      form.retiradaKitInicio = ev.retiradaKitInicio?.slice(0, 16) ?? ''
      form.retiradaKitFim = ev.retiradaKitFim?.slice(0, 16) ?? ''
      form.taxaRepassadaAtleta = ev.taxaRepassadaAtleta ?? true
      form.aceitaPix = ev.aceitaPix ?? true
      form.aceitaCartao = ev.aceitaCartao ?? true
      form.status = ev.status ?? 'RASCUNHO'
    }
  },
  { deep: true }
)

function onSubmit() {
  tentouEnviar.value = true
  erroValidacao.value = ''

  const faltando = camposObrigatorios.some((campo) => !form[campo])
  if (faltando) {
    erroValidacao.value = 'Preencha os campos destacados em vermelho antes de continuar.'
    return
  }

  if (!form.aceitaPix && !form.aceitaCartao) {
    erroValidacao.value = 'Selecione pelo menos 1 forma de pagamento (PIX ou Cartão de Crédito).'
    return
  }

  const payload: Record<string, unknown> = {
    nome: form.nome,
    descricao: form.descricao || undefined,
    local: form.local,
    cidade: form.cidade,
    estado: form.estado,
    dataInicio: form.dataInicio,
    dataFim: form.dataFim,
    capacidade: form.capacidade || undefined,
    regulamentoUrl: form.regulamentoUrl || undefined,
    termoResponsabilidade: form.termoResponsabilidade || undefined,
    retiradaKitLocal: form.retiradaKitLocal || undefined,
    retiradaKitInicio: form.retiradaKitInicio || undefined,
    retiradaKitFim: form.retiradaKitFim || undefined,
    taxaRepassadaAtleta: form.taxaRepassadaAtleta,
    aceitaPix: form.aceitaPix,
    aceitaCartao: form.aceitaCartao
  }
  if (props.modoEdicao) payload.status = form.status
  emit('submit', payload)
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <div v-if="erroValidacao" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
      ⚠️ {{ erroValidacao }}
    </div>

    <!-- Seção: Formas de Pagamento Aceitas -->
    <div class="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
      <label class="block text-sm font-extrabold text-amber-950 flex items-center gap-2">
        <span>💸</span> Formas de Pagamento Aceitas no Evento
      </label>
      <p class="text-xs text-slate-600">
        Selecione quais opções estarão disponíveis para o atleta no checkout de inscrição:
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <label
          class="flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition bg-white shadow-2xs"
          :class="form.aceitaPix ? 'border-amber-500 ring-2 ring-amber-500/20 font-bold' : 'border-slate-200 opacity-60'"
        >
          <input
            v-model="form.aceitaPix"
            type="checkbox"
            class="h-4 w-4 rounded text-amber-500 accent-amber-500"
          />
          <div class="text-xs">
            <p class="font-extrabold text-slate-900">📱 PIX (Instantâneo)</p>
            <p class="text-[11px] text-slate-500 font-normal">Gera QR Code e Código Copia e Cola imediato.</p>
          </div>
        </label>

        <label
          class="flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition bg-white shadow-2xs"
          :class="form.aceitaCartao ? 'border-amber-500 ring-2 ring-amber-500/20 font-bold' : 'border-slate-200 opacity-60'"
        >
          <input
            v-model="form.aceitaCartao"
            type="checkbox"
            class="h-4 w-4 rounded text-amber-500 accent-amber-500"
          />
          <div class="text-xs">
            <p class="font-extrabold text-slate-900">💳 Cartão de Crédito</p>
            <p class="text-[11px] text-slate-500 font-normal">Permite pagamento parcelado via cartão.</p>
          </div>
        </label>
      </div>
    </div>

    <p v-if="props.evento?.motivoRejeicao" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span class="font-semibold">Revisão pendente de ajuste:</span> {{ props.evento.motivoRejeicao }}
    </p>

    <!-- Tipo do Esporte / Evento (Padrão do Site) -->
    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Tipo do evento / Esporte</label>
      <select
        v-model="tipoEsporteSelecionado"
        class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        <option value="CORRIDA">🏃 Corrida de Rua / Trail Run</option>
        <option value="CICLISMO">🚴 Ciclismo / Mountain Bike (MTB)</option>
        <option value="MOTOCROSS">🏍️ Motocross / Enduro / Motor</option>
        <option value="CAMINHADA">🚶 Caminhada / Passeio</option>
        <option value="TRIATHLON">🏊 Natação / Aquatlon / Triathlon</option>
        <option value="FITNESS">🏋️ Crossfit / Functional Fitness</option>
        <option value="OUTROS">🏆 Outros Esportes</option>
      </select>
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Nome do evento *</label>
      <input v-model="form.nome" type="text" minlength="3" placeholder="Ex.: 1º Desafio de Ciclismo MTB" :class="classeCampo('nome')" />
      <p v-if="invalido('nome')" class="mt-1 text-xs text-red-600">Campo obrigatório.</p>
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Descrição (opcional)</label>
      <textarea
        v-model="form.descricao"
        rows="3"
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      ></textarea>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Data de início *</label>
        <input v-model="form.dataInicio" type="date" :class="classeCampo('dataInicio')" />
        <p v-if="invalido('dataInicio')" class="mt-1 text-xs text-red-600">Campo obrigatório.</p>
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Data de fim *</label>
        <input v-model="form.dataFim" type="date" :class="classeCampo('dataFim')" />
        <p v-if="invalido('dataFim')" class="mt-1 text-xs text-red-600">Campo obrigatório.</p>
      </div>
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Local *</label>
      <input
        v-model="form.local"
        type="text"
        placeholder="Nome do parque, arena, largada..."
        :class="classeCampo('local')"
      />
      <p v-if="invalido('local')" class="mt-1 text-xs text-red-600">Campo obrigatório.</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Cidade *</label>
        <input v-model="form.cidade" type="text" :class="classeCampo('cidade')" />
        <p v-if="invalido('cidade')" class="mt-1 text-xs text-red-600">Campo obrigatório.</p>
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Estado *</label>
        <select v-model="form.estado" :class="classeCampo('estado')">
          <option value="" disabled>Selecione</option>
          <option v-for="uf in estadosBr" :key="uf.sigla" :value="uf.sigla">{{ uf.sigla }} - {{ uf.nome }}</option>
        </select>
        <p v-if="invalido('estado')" class="mt-1 text-xs text-red-600">Campo obrigatório.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Capacidade (opcional)</label>
        <input
          v-model.number="form.capacidade"
          type="number"
          min="1"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div v-if="props.modoEdicao">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Status</label>
        <select
          v-model="form.status"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option v-for="opcao in statusOpcoes" :key="opcao.valor" :value="opcao.valor">{{ opcao.label }}</option>
        </select>
      </div>
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Regulamento (URL opcional)</label>
      <input
        v-model="form.regulamentoUrl"
        type="text"
        placeholder="https://..."
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Termo de responsabilidade (opcional)</label>
      <textarea
        v-model="form.termoResponsabilidade"
        rows="4"
        placeholder="Texto que o atleta precisa aceitar ao se inscrever (isenção de responsabilidade médica, regras da prova...)"
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      ></textarea>
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Local de retirada do kit (opcional)</label>
      <input
        v-model="form.retiradaKitLocal"
        type="text"
        placeholder="Endereço ou nome do local"
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Retirada do kit — início (opcional)</label>
        <input
          v-model="form.retiradaKitInicio"
          type="datetime-local"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Retirada do kit — fim (opcional)</label>
        <input
          v-model="form.retiradaKitFim"
          type="datetime-local"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>
    </div>

    <div class="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <label class="block text-sm font-extrabold text-blue-950 flex items-center gap-2">
        <span>💳</span> Taxa de Conveniência da Plataforma
      </label>
      <p class="text-xs text-slate-600">
        A taxa fixa da plataforma é calculada sempre em cima do valor cheio do lote/evento (ex: 10% de R$ 70,00 = R$ 7,00). Escolha como a taxa será tratada:
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <label
          class="flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition"
          :class="!form.taxaRepassadaAtleta ? 'border-primary bg-white shadow-xs font-bold text-primary' : 'border-slate-200 bg-white text-slate-600'"
        >
          <input
            v-model="form.taxaRepassadaAtleta"
            type="radio"
            :value="false"
            class="h-4 w-4 text-primary accent-primary"
          />
          <div class="text-xs">
            <p class="font-bold">Absorver taxa (Padrão)</p>
            <p class="text-[11px] text-slate-500 font-normal">O valor da corrida para o atleta é o preço do lote.</p>
          </div>
        </label>

        <label
          class="flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition"
          :class="form.taxaRepassadaAtleta ? 'border-primary bg-white shadow-xs font-bold text-primary' : 'border-slate-200 bg-white text-slate-600'"
        >
          <input
            v-model="form.taxaRepassadaAtleta"
            type="radio"
            :value="true"
            class="h-4 w-4 text-primary accent-primary"
          />
          <div class="text-xs">
            <p class="font-bold">Repassar taxa ao atleta</p>
            <p class="text-[11px] text-slate-500 font-normal">Adiciona a taxa fixa da plataforma no total pago pelo atleta.</p>
          </div>
        </label>
      </div>
    </div>

    <button
      type="submit"
      :disabled="props.carregando"
      class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
    >
      {{ props.carregando ? 'Salvando...' : props.modoEdicao ? 'Salvar alterações' : 'Criar evento' }}
    </button>
  </form>
</template>
