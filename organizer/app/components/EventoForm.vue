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

const statusOpcoes = [
  { valor: 'RASCUNHO', label: 'Rascunho' },
  { valor: 'PUBLICADO', label: 'Aberto (publicado)' },
  { valor: 'INSCRICOES_ENCERRADAS', label: 'Inscrições encerradas' },
  { valor: 'CANCELADO', label: 'Cancelado' }
]

const form = reactive({
  nome: props.evento?.nome ?? '',
  descricao: props.evento?.descricao ?? '',
  local: props.evento?.local ?? '',
  cidade: props.evento?.cidade ?? '',
  estado: props.evento?.estado ?? '',
  dataInicio: props.evento?.dataInicio.slice(0, 10) ?? '',
  dataFim: props.evento?.dataFim.slice(0, 10) ?? '',
  capacidade: props.evento?.capacidade ?? undefined as number | undefined,
  regulamentoUrl: props.evento?.regulamentoUrl?.startsWith('/uploads/') ? '' : (props.evento?.regulamentoUrl ?? ''),
  termoResponsabilidade: props.evento?.termoResponsabilidade ?? '',
  retiradaKitLocal: props.evento?.retiradaKitLocal ?? '',
  retiradaKitInicio: props.evento?.retiradaKitInicio?.slice(0, 16) ?? '',
  retiradaKitFim: props.evento?.retiradaKitFim?.slice(0, 16) ?? '',
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

function onSubmit() {
  tentouEnviar.value = true
  erroValidacao.value = ''

  const faltando = camposObrigatorios.some((campo) => !form[campo])
  if (faltando) {
    erroValidacao.value = 'Preencha os campos destacados em vermelho antes de continuar.'
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
    retiradaKitFim: form.retiradaKitFim || undefined
  }
  if (props.modoEdicao) payload.status = form.status
  emit('submit', payload)
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <p v-if="erroValidacao" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erroValidacao }}
    </p>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Nome do evento *</label>
      <input v-model="form.nome" type="text" minlength="3" :class="classeCampo('nome')" />
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

    <button
      type="submit"
      :disabled="props.carregando"
      class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
    >
      {{ props.carregando ? 'Salvando...' : props.modoEdicao ? 'Salvar alterações' : 'Criar evento' }}
    </button>
  </form>
</template>
