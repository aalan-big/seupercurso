<script setup lang="ts">
import { AlertTriangle, Banknote, Smartphone, CreditCard, Shirt, ArrowLeftRight, CalendarDays, FileText } from 'lucide-vue-next'
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{
  evento?: EventoOrganizador | null
  carregando?: boolean
  modoEdicao?: boolean
}>()

const emit = defineEmits<{ submit: [payload: Record<string, unknown>, arquivoRegulamento: File | null] }>()

const arquivoRegulamento = ref<File | null>(null)

function onArquivoRegulamento(e: Event) {
  const input = e.target as HTMLInputElement
  arquivoRegulamento.value = input.files?.[0] ?? null
}

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

  if (props.evento?.status === 'PUBLICADO' || props.evento?.status === 'INSCRICOES_ENCERRADAS') {
    opcoes.push({ valor: 'PUBLICADO', label: 'Publicado (Inscrições Abertas)' })
    opcoes.push({ valor: 'INSCRICOES_ENCERRADAS', label: 'Inscrições encerradas / Esgotadas' })
  } else {
    opcoes.push({ valor: 'AGUARDANDO_APROVACAO', label: 'Enviar pra revisão' })
    opcoes.push({ valor: 'INSCRICOES_ENCERRADAS', label: 'Inscrições encerradas' })
  }

  opcoes.push({ valor: 'CANCELADO', label: 'Cancelado' })
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
  limiteTrocaCamisaAté: props.evento?.limiteTrocaCamisaAté?.slice(0, 16) ?? '',
  camisasBloqueadas: props.evento?.camisasBloqueadas ?? false,
  permiteTransferencia: props.evento?.permiteTransferencia ?? true,
  taxaRepassadaAtleta: props.evento?.taxaRepassadaAtleta ?? true,
  aceitaPix: props.evento?.aceitaPix ?? true,
  aceitaCartao: props.evento?.aceitaCartao ?? true,
  comissaoPagaPeloAtleta: props.evento?.comissaoPagaPeloAtleta ?? false,
  status: props.evento?.status ?? 'RASCUNHO'
})

function converterIsoParaDisplay(iso: string) {
  if (!iso) return ''
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return ''
  return `${dia}/${mes}/${ano}`
}

const dataInicioDisplay = ref(converterIsoParaDisplay(form.dataInicio))
const dataFimDisplay = ref(converterIsoParaDisplay(form.dataFim))

function formatarDataInicio(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 8)
  v = v.replace(/(\d{2})(\d)/, '$1/$2')
  v = v.replace(/(\d{2})(\d)/, '$1/$2')
  dataInicioDisplay.value = v
  form.dataInicio = v.length === 10 ? `${v.slice(6, 10)}-${v.slice(3, 5)}-${v.slice(0, 2)}` : ''
}

function onSelecionarDataInicio(e: Event) {
  const input = e.target as HTMLInputElement
  form.dataInicio = input.value
  dataInicioDisplay.value = converterIsoParaDisplay(input.value)
}

function formatarDataFim(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 8)
  v = v.replace(/(\d{2})(\d)/, '$1/$2')
  v = v.replace(/(\d{2})(\d)/, '$1/$2')
  dataFimDisplay.value = v
  form.dataFim = v.length === 10 ? `${v.slice(6, 10)}-${v.slice(3, 5)}-${v.slice(0, 2)}` : ''
}

function onSelecionarDataFim(e: Event) {
  const input = e.target as HTMLInputElement
  form.dataFim = input.value
  dataFimDisplay.value = converterIsoParaDisplay(input.value)
}

function converterIsoDatetimeParaDisplay(iso: string) {
  if (!iso) return ''
  const [data, hora] = iso.split('T')
  const [ano, mes, dia] = (data ?? '').split('-')
  if (!ano || !mes || !dia) return ''
  return hora ? `${dia}/${mes}/${ano} ${hora.slice(0, 5)}` : `${dia}/${mes}/${ano}`
}

function mascararDataHora(v: string) {
  const digitos = v.replace(/\D/g, '').slice(0, 12)
  let out = digitos
  if (digitos.length > 2) out = `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  if (digitos.length > 4) out = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
  if (digitos.length > 8) out = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4, 8)} ${digitos.slice(8)}`
  if (digitos.length > 10) out = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4, 8)} ${digitos.slice(8, 10)}:${digitos.slice(10)}`
  return out
}

function converterDisplayParaIsoDatetime(display: string) {
  const digitos = display.replace(/\D/g, '')
  if (digitos.length !== 12) return ''
  const dia = digitos.slice(0, 2)
  const mes = digitos.slice(2, 4)
  const ano = digitos.slice(4, 8)
  const hora = digitos.slice(8, 10)
  const min = digitos.slice(10, 12)
  return `${ano}-${mes}-${dia}T${hora}:${min}`
}

const retiradaKitInicioDisplay = ref(converterIsoDatetimeParaDisplay(form.retiradaKitInicio))
const retiradaKitFimDisplay = ref(converterIsoDatetimeParaDisplay(form.retiradaKitFim))
const limiteTrocaCamisaDisplay = ref(converterIsoDatetimeParaDisplay(form.limiteTrocaCamisaAté))

function formatarRetiradaKitInicio(e: Event) {
  const v = mascararDataHora((e.target as HTMLInputElement).value)
  retiradaKitInicioDisplay.value = v
  form.retiradaKitInicio = converterDisplayParaIsoDatetime(v)
}

function onSelecionarRetiradaKitInicio(e: Event) {
  const input = e.target as HTMLInputElement
  form.retiradaKitInicio = input.value
  retiradaKitInicioDisplay.value = converterIsoDatetimeParaDisplay(input.value)
}

function formatarRetiradaKitFim(e: Event) {
  const v = mascararDataHora((e.target as HTMLInputElement).value)
  retiradaKitFimDisplay.value = v
  form.retiradaKitFim = converterDisplayParaIsoDatetime(v)
}

function onSelecionarRetiradaKitFim(e: Event) {
  const input = e.target as HTMLInputElement
  form.retiradaKitFim = input.value
  retiradaKitFimDisplay.value = converterIsoDatetimeParaDisplay(input.value)
}

function formatarLimiteTrocaCamisa(e: Event) {
  const v = mascararDataHora((e.target as HTMLInputElement).value)
  limiteTrocaCamisaDisplay.value = v
  form.limiteTrocaCamisaAté = converterDisplayParaIsoDatetime(v)
}

function onSelecionarLimiteTrocaCamisa(e: Event) {
  const input = e.target as HTMLInputElement
  form.limiteTrocaCamisaAté = input.value
  limiteTrocaCamisaDisplay.value = converterIsoDatetimeParaDisplay(input.value)
}

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
    : 'w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30'
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
    form.limiteTrocaCamisaAté !== (props.evento.limiteTrocaCamisaAté?.slice(0, 16) ?? '') ||
    form.camisasBloqueadas !== (props.evento.camisasBloqueadas ?? false) ||
    form.permiteTransferencia !== (props.evento.permiteTransferencia ?? true) ||
    form.taxaRepassadaAtleta !== (props.evento.taxaRepassadaAtleta ?? true) ||
    form.aceitaPix !== (props.evento.aceitaPix ?? true) ||
    form.aceitaCartao !== (props.evento.aceitaCartao ?? true) ||
    form.comissaoPagaPeloAtleta !== (props.evento.comissaoPagaPeloAtleta ?? false) ||
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
      dataInicioDisplay.value = converterIsoParaDisplay(form.dataInicio)
      dataFimDisplay.value = converterIsoParaDisplay(form.dataFim)
      form.capacidade = ev.capacidade ?? undefined
      form.regulamentoUrl = ev.regulamentoUrl?.startsWith('/uploads/') ? '' : (ev.regulamentoUrl ?? '')
      form.termoResponsabilidade = ev.termoResponsabilidade ?? ''
      form.retiradaKitLocal = ev.retiradaKitLocal ?? ''
      form.retiradaKitInicio = ev.retiradaKitInicio?.slice(0, 16) ?? ''
      form.retiradaKitFim = ev.retiradaKitFim?.slice(0, 16) ?? ''
      form.limiteTrocaCamisaAté = ev.limiteTrocaCamisaAté?.slice(0, 16) ?? ''
      retiradaKitInicioDisplay.value = converterIsoDatetimeParaDisplay(form.retiradaKitInicio)
      retiradaKitFimDisplay.value = converterIsoDatetimeParaDisplay(form.retiradaKitFim)
      limiteTrocaCamisaDisplay.value = converterIsoDatetimeParaDisplay(form.limiteTrocaCamisaAté)
      form.camisasBloqueadas = ev.camisasBloqueadas ?? false
      form.permiteTransferencia = ev.permiteTransferencia ?? true
      form.taxaRepassadaAtleta = ev.taxaRepassadaAtleta ?? true
      form.aceitaPix = ev.aceitaPix ?? true
      form.aceitaCartao = ev.aceitaCartao ?? true
      form.comissaoPagaPeloAtleta = ev.comissaoPagaPeloAtleta ?? false
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
    limiteTrocaCamisaAté: form.limiteTrocaCamisaAté || undefined,
    camisasBloqueadas: form.camisasBloqueadas,
    permiteTransferencia: form.permiteTransferencia,
    taxaRepassadaAtleta: form.taxaRepassadaAtleta,
    aceitaPix: form.aceitaPix,
    aceitaCartao: form.aceitaCartao,
    comissaoPagaPeloAtleta: form.comissaoPagaPeloAtleta
  }
  if (props.modoEdicao) payload.status = form.status
  emit('submit', payload, arquivoRegulamento.value)
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <div v-if="erroValidacao" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
      <AlertTriangle :size="16" class="text-red-600" /> {{ erroValidacao }}
    </div>

    <!-- Seção: Formas de Pagamento Aceitas -->
    <div class="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
      <label class="text-sm font-extrabold text-amber-950 flex items-center gap-2">
        <Banknote :size="18" class="text-amber-700" /> Formas de Pagamento Aceitas no Evento
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
            <p class="font-extrabold text-slate-900 flex items-center gap-1.5"><Smartphone :size="15" class="text-amber-700" /> PIX (Instantâneo)</p>
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
            <p class="font-extrabold text-slate-900 flex items-center gap-1.5"><CreditCard :size="15" class="text-amber-700" /> Cartão de Crédito</p>
            <p class="text-[11px] text-slate-500 font-normal">Permite pagamento parcelado via cartão.</p>
          </div>
        </label>
      </div>

      <!-- Quem paga a comissão da plataforma -->
      <div class="pt-4 mt-4 border-t border-slate-200 space-y-3">
        <p class="text-xs font-bold text-slate-800">Taxa da plataforma</p>
        <p class="text-xs text-slate-600">
          Escolha quem paga a comissão do SeuPercurso sobre este evento:
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            class="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition bg-white shadow-2xs"
            :class="!form.comissaoPagaPeloAtleta ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 opacity-60'"
          >
            <input
              v-model="form.comissaoPagaPeloAtleta"
              type="radio"
              :value="false"
              class="mt-0.5 h-4 w-4 text-amber-500 accent-amber-500"
            />
            <div class="text-xs">
              <p class="font-extrabold text-slate-900">Eu absorvo</p>
              <p class="text-[11px] text-slate-500 font-normal">
                O atleta paga o preço da inscrição e a comissão sai do seu repasse.
                Numa inscrição de R$ 100, você recebe R$ 90.
              </p>
            </div>
          </label>

          <label
            class="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition bg-white shadow-2xs"
            :class="form.comissaoPagaPeloAtleta ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 opacity-60'"
          >
            <input
              v-model="form.comissaoPagaPeloAtleta"
              type="radio"
              :value="true"
              class="mt-0.5 h-4 w-4 text-amber-500 accent-amber-500"
            />
            <div class="text-xs">
              <p class="font-extrabold text-slate-900">O atleta paga</p>
              <p class="text-[11px] text-slate-500 font-normal">
                A comissão aparece como taxa de serviço no checkout e você recebe o preço
                cheio. Numa inscrição de R$ 100, o atleta paga R$ 110 e você recebe R$ 100.
              </p>
            </div>
          </label>
        </div>

        <p class="text-[11px] text-slate-500">
          Em qualquer uma das opções, a tarifa do meio de pagamento é sempre somada ao
          valor do atleta.
        </p>
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
        class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
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
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
      ></textarea>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="min-w-0">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Data de início *</label>
        <div class="relative">
          <input
            :value="dataInicioDisplay"
            @input="formatarDataInicio"
            type="text"
            inputmode="numeric"
            placeholder="DD/MM/AAAA"
            maxlength="10"
            :class="[classeCampo('dataInicio'), 'pr-11']"
          />
          <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <CalendarDays :size="18" />
          </div>
          <input
            :value="form.dataInicio"
            @change="onSelecionarDataInicio"
            type="date"
            aria-label="Selecionar data no calendário"
            class="absolute inset-y-0 right-0 cursor-pointer opacity-0"
            style="width: 2.75rem; min-width: 0; max-width: none; min-height: 0; padding: 0;"
          />
        </div>
        <p v-if="invalido('dataInicio')" class="mt-1 text-xs text-red-600">Campo obrigatório.</p>
      </div>
      <div class="min-w-0">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Data de fim *</label>
        <div class="relative">
          <input
            :value="dataFimDisplay"
            @input="formatarDataFim"
            type="text"
            inputmode="numeric"
            placeholder="DD/MM/AAAA"
            maxlength="10"
            :class="[classeCampo('dataFim'), 'pr-11']"
          />
          <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <CalendarDays :size="18" />
          </div>
          <input
            :value="form.dataFim"
            @change="onSelecionarDataFim"
            type="date"
            aria-label="Selecionar data no calendário"
            class="absolute inset-y-0 right-0 cursor-pointer opacity-0"
            style="width: 2.75rem; min-width: 0; max-width: none; min-height: 0; padding: 0;"
          />
        </div>
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
        <label class="mb-1 block text-sm font-semibold text-slate-700">Capacidade total do evento (opcional)</label>
        <input
          v-model.number="form.capacidade"
          type="number"
          min="1"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        />
        <p class="mt-1 text-xs text-slate-400">
          Limite máximo de inscrições somando todas as modalidades e categorias. Deixe em branco pra não limitar.
        </p>
      </div>
      <div v-if="props.modoEdicao">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Status</label>
        <select
          v-model="form.status"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        >
          <option v-for="opcao in statusOpcoes" :key="opcao.valor" :value="opcao.valor">{{ opcao.label }}</option>
        </select>
      </div>
    </div>

    <div v-if="!props.modoEdicao" class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <label class="text-sm font-bold text-slate-700 flex items-center gap-2">
        <FileText :size="16" class="text-slate-500" /> Regulamento em PDF (opcional)
      </label>
      <input
        type="file"
        accept="application/pdf"
        class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-300"
        @change="onArquivoRegulamento"
      />
      <p v-if="arquivoRegulamento" class="text-xs font-semibold text-emerald-700">{{ arquivoRegulamento.name }} selecionado — enviado ao salvar o evento.</p>
      <p class="text-xs text-slate-400">Ou informe uma URL de regulamento manualmente:</p>
      <input
        v-model="form.regulamentoUrl"
        type="text"
        placeholder="https://..."
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
      />
    </div>

    <div v-else>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Regulamento (URL opcional)</label>
      <input
        v-model="form.regulamentoUrl"
        type="text"
        placeholder="https://..."
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
      />
      <p class="mt-1 text-xs text-slate-400">Pra anexar um PDF, use o campo "Regulamento em PDF" na seção Mídia do evento abaixo.</p>
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Termo de responsabilidade (opcional)</label>
      <textarea
        v-model="form.termoResponsabilidade"
        rows="4"
        placeholder="Texto que o atleta precisa aceitar ao se inscrever (isenção de responsabilidade médica, regras da prova...)"
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
      ></textarea>
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Local de retirada do kit (opcional)</label>
      <input
        v-model="form.retiradaKitLocal"
        type="text"
        placeholder="Endereço ou nome do local"
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
      />
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="min-w-0">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Retirada do kit — início (opcional)</label>
        <div class="relative">
          <input
            :value="retiradaKitInicioDisplay"
            @input="formatarRetiradaKitInicio"
            type="text"
            inputmode="numeric"
            placeholder="DD/MM/AAAA HH:mm"
            maxlength="16"
            class="w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
          />
          <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <CalendarDays :size="18" />
          </div>
          <input
            :value="form.retiradaKitInicio"
            @change="onSelecionarRetiradaKitInicio"
            type="datetime-local"
            aria-label="Selecionar data e hora no calendário"
            class="absolute inset-y-0 right-0 cursor-pointer opacity-0"
            style="width: 2.75rem; min-width: 0; max-width: none; min-height: 0; padding: 0;"
          />
        </div>
      </div>
      <div class="min-w-0">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Retirada do kit — fim (opcional)</label>
        <div class="relative">
          <input
            :value="retiradaKitFimDisplay"
            @input="formatarRetiradaKitFim"
            type="text"
            inputmode="numeric"
            placeholder="DD/MM/AAAA HH:mm"
            maxlength="16"
            class="w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
          />
          <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <CalendarDays :size="18" />
          </div>
          <input
            :value="form.retiradaKitFim"
            @change="onSelecionarRetiradaKitFim"
            type="datetime-local"
            aria-label="Selecionar data e hora no calendário"
            class="absolute inset-y-0 right-0 cursor-pointer opacity-0"
            style="width: 2.75rem; min-width: 0; max-width: none; min-height: 0; padding: 0;"
          />
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 space-y-3">
      <label class="text-sm font-extrabold text-orange-950 flex items-center gap-2">
        <Shirt :size="18" class="text-orange-700" /> Prazo de Produção dos Kits
      </label>
      <p class="text-xs text-slate-600">
        Data em que você fecha o pedido com a gráfica. É diferente da retirada do kit — normalmente é bem antes. A partir dela, ninguém troca tamanho de camiseta, modalidade/categoria ou transfere a inscrição.
      </p>

      <div class="min-w-0">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Bloquear alterações de kit a partir de (opcional)</label>
        <div class="relative">
          <input
            :value="limiteTrocaCamisaDisplay"
            @input="formatarLimiteTrocaCamisa"
            type="text"
            inputmode="numeric"
            placeholder="DD/MM/AAAA HH:mm"
            maxlength="16"
            class="w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
          />
          <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <CalendarDays :size="18" />
          </div>
          <input
            :value="form.limiteTrocaCamisaAté"
            @change="onSelecionarLimiteTrocaCamisa"
            type="datetime-local"
            aria-label="Selecionar data e hora no calendário"
            class="absolute inset-y-0 right-0 cursor-pointer opacity-0"
            style="width: 2.75rem; min-width: 0; max-width: none; min-height: 0; padding: 0;"
          />
        </div>
      </div>

      <label class="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
        <input v-model="form.camisasBloqueadas" type="checkbox" class="h-4 w-4 text-primary accent-primary" />
        <div class="text-xs">
          <p class="font-bold text-slate-700">Bloquear agora, independente da data</p>
          <p class="text-[11px] text-slate-500 font-normal">Use se os kits já foram enviados pra produção antes da data programada.</p>
        </div>
      </label>

      <label class="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
        <input v-model="form.permiteTransferencia" type="checkbox" class="h-4 w-4 text-primary accent-primary" />
        <div class="text-xs">
          <p class="font-bold text-slate-700 flex items-center gap-1.5"><ArrowLeftRight :size="13" /> Permitir transferência de titularidade</p>
          <p class="text-[11px] text-slate-500 font-normal">Se desligar, nenhum atleta pode repassar a inscrição pra outra pessoa neste evento.</p>
        </div>
      </label>
    </div>

    <div class="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <label class="text-sm font-extrabold text-blue-950 flex items-center gap-2">
        <CreditCard :size="18" class="text-blue-700" /> Taxa de Conveniência da Plataforma
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
