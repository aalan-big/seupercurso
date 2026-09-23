<script setup lang="ts">
import {
  AlertTriangle,
  AlertCircle,
  Banknote,
  Smartphone,
  CreditCard,
  Shirt,
  ArrowLeftRight,
  CalendarDays,
  FileText,
  X,
  ArrowRight
} from 'lucide-vue-next'
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{
  evento?: EventoOrganizador | null
  carregando?: boolean
  modoEdicao?: boolean
  erroServidor?: string
}>()

const emit = defineEmits<{
  submit: [payload: Record<string, unknown>, arquivoRegulamento: File | null]
  limparErro: []
}>()

const { organizador, fetchMe } = useOrganizador()

onMounted(() => {
  if (!organizador.value) {
    fetchMe().catch(() => {})
  }
})

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

function formatarMoedaParaInput(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return ''
  const num = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'))
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function mascararMoeda(v: string): string {
  const digitos = v.replace(/\D/g, '')
  if (!digitos) return ''
  return (Number(digitos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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
  possuiCamisa: props.evento?.possuiCamisa ?? true,
  camisaOpcional: props.evento?.camisaOpcional ?? false,
  valorCamisaOpcional: formatarMoedaParaInput(props.evento?.valorCamisaOpcional),
  limiteTrocaCamisaAté: props.evento?.limiteTrocaCamisaAté?.slice(0, 16) ?? '',
  camisasBloqueadas: props.evento?.camisasBloqueadas ?? false,
  permiteTransferencia: props.evento?.permiteTransferencia ?? true,
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

/**
 * Quase toda corrida acontece num dia so, e o formulario obrigava a digitar a
 * mesma data duas vezes — convite a errar uma delas. Num evento existente, o
 * estado inicial vem do que ja esta gravado; num novo, o padrao e um dia.
 *
 * A data de fim nao e enfeite: e ela que libera resultado e certificado, um dia
 * depois. Por isso ela continua sendo gravada, so que espelhada em vez de
 * digitada.
 */
const eventoDeUmDia = ref(!form.dataFim || form.dataInicio === form.dataFim)

function espelharDataFim() {
  form.dataFim = form.dataInicio
  dataFimDisplay.value = dataInicioDisplay.value
}

watch(eventoDeUmDia, (umDia) => {
  if (umDia) espelharDataFim()
})

function formatarDataInicio(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 8)
  v = v.replace(/(\d{2})(\d)/, '$1/$2')
  v = v.replace(/(\d{2})(\d)/, '$1/$2')
  dataInicioDisplay.value = v
  form.dataInicio = v.length === 10 ? `${v.slice(6, 10)}-${v.slice(3, 5)}-${v.slice(0, 2)}` : ''
  if (eventoDeUmDia.value) espelharDataFim()
}

function onSelecionarDataInicio(e: Event) {
  const input = e.target as HTMLInputElement
  form.dataInicio = input.value
  dataInicioDisplay.value = converterIsoParaDisplay(input.value)
  if (eventoDeUmDia.value) espelharDataFim()
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

interface ItemPendente {
  campo: string
  titulo: string
  descricao: string
  idElemento: string
}

const tentouEnviar = ref(false)
const erroValidacao = ref('')
const modalPendenciasAberto = ref(false)
const itensPendentes = ref<ItemPendente[]>([])

function validarPendencias(): ItemPendente[] {
  const lista: ItemPendente[] = []

  // 1. Nome do evento
  if (!form.nome || form.nome.trim().length < 3) {
    lista.push({
      campo: 'nome',
      titulo: 'Nome do evento',
      descricao: !form.nome?.trim() ? 'Informe o nome do evento.' : 'O nome do evento deve ter no mínimo 3 caracteres.',
      idElemento: 'campo-nome'
    })
  }

  // 2. Data de Início
  if (!form.dataInicio) {
    lista.push({
      campo: 'dataInicio',
      titulo: eventoDeUmDia.value ? 'Data do evento' : 'Data de início',
      descricao: 'Informe a data em que o evento será realizado.',
      idElemento: 'campo-dataInicio'
    })
  }

  // 3. Data de Fim
  if (!eventoDeUmDia.value) {
    if (!form.dataFim) {
      lista.push({
        campo: 'dataFim',
        titulo: 'Data de término',
        descricao: 'Informe a data final do evento.',
        idElemento: 'campo-dataFim'
      })
    } else if (form.dataInicio && form.dataFim < form.dataInicio) {
      lista.push({
        campo: 'dataFim',
        titulo: 'Data de término inválida',
        descricao: 'A data de término não pode ser anterior à data de início.',
        idElemento: 'campo-dataFim'
      })
    }
  }

  // 4. Local
  if (!form.local || !form.local.trim()) {
    lista.push({
      campo: 'local',
      titulo: 'Local do evento',
      descricao: 'Informe o endereço, parque, arena ou ponto de largada.',
      idElemento: 'campo-local'
    })
  }

  // 5. Cidade
  if (!form.cidade || !form.cidade.trim()) {
    lista.push({
      campo: 'cidade',
      titulo: 'Cidade',
      descricao: 'Informe a cidade onde o evento acontecerá.',
      idElemento: 'campo-cidade'
    })
  }

  // 6. Estado
  if (!form.estado) {
    lista.push({
      campo: 'estado',
      titulo: 'Estado (UF)',
      descricao: 'Selecione o estado (UF) do evento.',
      idElemento: 'campo-estado'
    })
  }

  // 7. Formas de pagamento
  if (!form.aceitaPix && !form.aceitaCartao) {
    lista.push({
      campo: 'pagamento',
      titulo: 'Formas de pagamento',
      descricao: 'Selecione pelo menos 1 forma de pagamento aceita (PIX ou Cartão de Crédito).',
      idElemento: 'campo-formasPagamento'
    })
  }

  // 8. Valor da camisa opcional
  if (form.possuiCamisa && form.camisaOpcional) {
    const valorNumerico = Number(form.valorCamisaOpcional?.replace(/\./g, '').replace(',', '.'))
    if (!form.valorCamisaOpcional || isNaN(valorNumerico) || valorNumerico <= 0) {
      lista.push({
        campo: 'valorCamisaOpcional',
        titulo: 'Valor da camisa opcional',
        descricao: 'Você marcou camisa opcional. Informe o valor cobrado pela camiseta (ex: 40,00).',
        idElemento: 'campo-valorCamisaOpcional'
      })
    }
  }

  // 9. Mercado Pago conectado (obrigatório para enviar para aprovação)
  if (form.status === 'AGUARDANDO_APROVACAO' && !organizador.value?.mpUserId) {
    lista.push({
      campo: 'mercadopago',
      titulo: 'Conectar Mercado Pago',
      descricao: 'Você precisa conectar sua conta do Mercado Pago para receber os pagamentos antes de enviar o evento para aprovação.',
      idElemento: 'alerta-mercadopago-conexao'
    })
  }

  return lista
}

function invalido(campo: string) {
  return tentouEnviar.value && itensPendentes.value.some((item) => item.campo === campo)
}

function classeCampo(campo: string) {
  return invalido(campo)
    ? 'w-full rounded-xl border-2 border-red-400 bg-red-50/20 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200'
    : 'w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30'
}

function fecharModal() {
  modalPendenciasAberto.value = false
  emit('limparErro')
}

function focarPrimeiraPendencia(id?: string) {
  modalPendenciasAberto.value = false
  emit('limparErro')
  const targetId = id || itensPendentes.value[0]?.idElemento
  if (!targetId) return
  nextTick(() => {
    setTimeout(() => {
      const el = document.getElementById(targetId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (typeof (el as HTMLElement).focus === 'function') {
          el.focus()
        }
      }
    }, 120)
  })
}

watch(
  () => props.erroServidor,
  (val) => {
    if (val) {
      modalPendenciasAberto.value = true
    }
  }
)

watch(
  () => [
    form.nome,
    form.dataInicio,
    form.dataFim,
    form.local,
    form.cidade,
    form.estado,
    form.aceitaPix,
    form.aceitaCartao,
    form.possuiCamisa,
    form.camisaOpcional,
    form.valorCamisaOpcional,
    form.status
  ],
  () => {
    if (tentouEnviar.value) {
      itensPendentes.value = validarPendencias()
      if (itensPendentes.value.length === 0) {
        erroValidacao.value = ''
      }
    }
  }
)

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
    form.possuiCamisa !== (props.evento.possuiCamisa ?? true) ||
    form.camisaOpcional !== (props.evento.camisaOpcional ?? false) ||
    form.valorCamisaOpcional !== formatarMoedaParaInput(props.evento.valorCamisaOpcional) ||
    form.limiteTrocaCamisaAté !== (props.evento.limiteTrocaCamisaAté?.slice(0, 16) ?? '') ||
    form.camisasBloqueadas !== (props.evento.camisasBloqueadas ?? false) ||
    form.permiteTransferencia !== (props.evento.permiteTransferencia ?? true) ||
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
      eventoDeUmDia.value = !form.dataFim || form.dataInicio === form.dataFim
      form.capacidade = ev.capacidade ?? undefined
      form.regulamentoUrl = ev.regulamentoUrl?.startsWith('/uploads/') ? '' : (ev.regulamentoUrl ?? '')
      form.termoResponsabilidade = ev.termoResponsabilidade ?? ''
      form.retiradaKitLocal = ev.retiradaKitLocal ?? ''
      form.retiradaKitInicio = ev.retiradaKitInicio?.slice(0, 16) ?? ''
      form.retiradaKitFim = ev.retiradaKitFim?.slice(0, 16) ?? ''
      form.possuiCamisa = ev.possuiCamisa ?? true
      form.camisaOpcional = ev.camisaOpcional ?? false
      form.valorCamisaOpcional = formatarMoedaParaInput(ev.valorCamisaOpcional)
      form.limiteTrocaCamisaAté = ev.limiteTrocaCamisaAté?.slice(0, 16) ?? ''
      retiradaKitInicioDisplay.value = converterIsoDatetimeParaDisplay(form.retiradaKitInicio)
      retiradaKitFimDisplay.value = converterIsoDatetimeParaDisplay(form.retiradaKitFim)
      limiteTrocaCamisaDisplay.value = converterIsoDatetimeParaDisplay(form.limiteTrocaCamisaAté)
      form.camisasBloqueadas = ev.camisasBloqueadas ?? false
      form.permiteTransferencia = ev.permiteTransferencia ?? true
      form.aceitaPix = ev.aceitaPix ?? true
      form.aceitaCartao = ev.aceitaCartao ?? true
      form.comissaoPagaPeloAtleta = ev.comissaoPagaPeloAtleta ?? false
      form.status = ev.status ?? 'RASCUNHO'
    }
  },
  { immediate: true }
)

function onInputValorCamisa(e: Event) {
  const input = e.target as HTMLInputElement
  form.valorCamisaOpcional = mascararMoeda(input.value)
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    arquivoRegulamento.value = file
  }
}

function onSubmit() {
  tentouEnviar.value = true
  erroValidacao.value = ''
  itensPendentes.value = validarPendencias()

  if (itensPendentes.value.length > 0) {
    modalPendenciasAberto.value = true
    erroValidacao.value = 'Preencha as informações obrigatórias pendentes antes de salvar.'
    const primeiroId = itensPendentes.value[0]?.idElemento
    if (primeiroId) {
      nextTick(() => {
        document.getElementById(primeiroId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
    return
  }

  const payload: Record<string, any> = {
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
    possuiCamisa: form.possuiCamisa,
    camisaOpcional: form.possuiCamisa ? form.camisaOpcional : false,
    valorCamisaOpcional:
      form.possuiCamisa && form.camisaOpcional && form.valorCamisaOpcional
        ? Number(form.valorCamisaOpcional.replace(/\./g, '').replace(',', '.'))
        : undefined,
    limiteTrocaCamisaAté: form.limiteTrocaCamisaAté || undefined,
    camisasBloqueadas: form.camisasBloqueadas,
    permiteTransferencia: form.permiteTransferencia,
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
    <div
      v-if="erroValidacao || props.erroServidor"
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center justify-between gap-3 shadow-xs"
    >
      <div class="flex items-center gap-2">
        <AlertTriangle :size="16" class="text-red-600 shrink-0" />
        <span>{{ props.erroServidor || erroValidacao }}</span>
      </div>
      <button
        v-if="itensPendentes.length > 0"
        type="button"
        @click="modalPendenciasAberto = true"
        class="shrink-0 rounded-lg bg-red-100 px-2.5 py-1 text-red-800 hover:bg-red-200 transition font-extrabold text-[11px] cursor-pointer"
      >
        Ver pendências
      </button>
    </div>

    <!-- Seção: Formas de Pagamento Aceitas -->
    <div
      id="campo-formasPagamento"
      tabindex="-1"
      class="rounded-2xl border p-4 space-y-3 transition scroll-mt-20 focus:outline-none"
      :class="invalido('pagamento') ? 'border-2 border-red-400 bg-red-50/40 ring-2 ring-red-400/20' : 'border-amber-200 bg-amber-50/50'"
    >
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
        <option value="CORRIDA">🏃 Corrida de Rua</option>
        <option value="TRAIL_RUN">⛰️ Trail Run</option>
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
      <input
        id="campo-nome"
        v-model="form.nome"
        type="text"
        minlength="3"
        placeholder="Ex.: 1º Desafio de Ciclismo MTB"
        :class="classeCampo('nome')"
      />
      <p v-if="invalido('nome')" class="mt-1 text-xs text-red-600 font-semibold">
        {{ !form.nome?.trim() ? 'Campo obrigatório.' : 'Deve ter no mínimo 3 caracteres.' }}
      </p>
    </div>

    <div>
      <label class="mb-1 block text-sm font-semibold text-slate-700">Descrição (opcional)</label>
      <textarea
        v-model="form.descricao"
        rows="3"
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
      ></textarea>
    </div>

    <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <input
        v-model="eventoDeUmDia"
        type="checkbox"
        class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-warning focus:ring-warning/30"
      />
      <span class="text-sm">
        <span class="font-semibold text-slate-700">O evento acontece em um único dia</span>
        <span class="mt-0.5 block text-xs text-slate-500">
          Desmarque só se a programação se estender por mais de um dia. A data de fim
          é o que libera resultados e certificados para os atletas.
        </span>
      </span>
    </label>

    <div class="grid grid-cols-1 gap-4" :class="eventoDeUmDia ? '' : 'sm:grid-cols-2'">
      <div class="min-w-0">
        <label class="mb-1 block text-sm font-semibold text-slate-700">
          {{ eventoDeUmDia ? 'Data do evento *' : 'Data de início *' }}
        </label>
        <div class="relative">
          <input
            id="campo-dataInicio"
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
        <p v-if="invalido('dataInicio')" class="mt-1 text-xs text-red-600 font-semibold">Campo obrigatório.</p>
      </div>
      <div v-if="!eventoDeUmDia" class="min-w-0">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Data de fim *</label>
        <div class="relative">
          <input
            id="campo-dataFim"
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
        id="campo-local"
        v-model="form.local"
        type="text"
        placeholder="Nome do parque, arena, largada..."
        :class="classeCampo('local')"
      />
      <p v-if="invalido('local')" class="mt-1 text-xs text-red-600 font-semibold">Campo obrigatório.</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Cidade *</label>
        <input id="campo-cidade" v-model="form.cidade" type="text" :class="classeCampo('cidade')" />
        <p v-if="invalido('cidade')" class="mt-1 text-xs text-red-600 font-semibold">Campo obrigatório.</p>
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Estado *</label>
        <select id="campo-estado" v-model="form.estado" :class="classeCampo('estado')">
          <option value="" disabled>Selecione</option>
          <option v-for="uf in estadosBr" :key="uf.sigla" :value="uf.sigla">{{ uf.sigla }} - {{ uf.nome }}</option>
        </select>
        <p v-if="invalido('estado')" class="mt-1 text-xs text-red-600 font-semibold">Campo obrigatório.</p>
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

        <div
          v-if="!organizador?.mpUserId && props.evento?.status !== 'PUBLICADO'"
          id="alerta-mercadopago-conexao"
          tabindex="-1"
          class="mt-2 rounded-xl border p-3 text-xs transition focus:outline-none"
          :class="invalido('mercadopago') ? 'border-red-400 bg-red-50 text-red-950 ring-2 ring-red-400/20' : 'border-amber-300 bg-amber-50 text-amber-900'"
        >
          <div class="flex items-start gap-2.5">
            <AlertCircle :size="18" class="shrink-0 mt-0.5 text-amber-600" />
            <div class="space-y-1">
              <p class="font-extrabold text-[12px]">Conexão com Mercado Pago obrigatória</p>
              <p class="text-[11px] leading-relaxed text-slate-600">
                Para enviar seu evento para aprovação e começar a receber o dinheiro das inscrições, conecte a sua conta do Mercado Pago.
              </p>
              <NuxtLink
                to="/mercadopago"
                target="_blank"
                class="inline-flex items-center gap-1 font-bold text-amber-950 underline hover:text-black text-xs pt-0.5 cursor-pointer"
              >
                Conectar conta Mercado Pago agora →
              </NuxtLink>
            </div>
          </div>
        </div>
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
        <Shirt :size="18" class="text-orange-700" /> Kit e Prazo de Produção
      </label>

      <label class="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
        <input v-model="form.possuiCamisa" type="checkbox" class="h-4 w-4 text-primary accent-primary" />
        <div class="text-xs">
          <p class="font-bold text-slate-700">Este evento entrega camisa</p>
          <p class="text-[11px] text-slate-500 font-normal">
            Se desmarcar, o atleta não escolhe tamanho na inscrição e nenhuma informação de camisa aparece pra ele.
          </p>
        </div>
      </label>

      <!-- Opção de Camisa Opcional / Venda Avulsa -->
      <div v-if="form.possuiCamisa" class="space-y-3 pl-1">
        <label class="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
          <input v-model="form.camisaOpcional" type="checkbox" class="h-4 w-4 text-warning accent-warning cursor-pointer" />
          <div class="text-xs">
            <p class="font-bold text-slate-800">Camisa Opcional (acréscimo pago pelo atleta)</p>
            <p class="text-[11px] text-slate-500 font-normal">
              Ideal para eventos de desafio ou provas onde a camisa não vem inclusa no preço base. O atleta escolhe se quer adicionar a camisa.
            </p>
          </div>
        </label>

        <div v-if="form.camisaOpcional" class="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
          <label class="block text-xs font-bold text-slate-700">Valor adicional da camisa *</label>
          <div class="relative max-w-[180px]">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">R$</span>
            <input
              id="campo-valorCamisaOpcional"
              :value="form.valorCamisaOpcional"
              @input="onInputValorCamisa"
              type="text"
              inputmode="decimal"
              placeholder="0,00"
              class="w-full rounded-xl border py-2 pl-9 pr-3 text-sm font-bold text-slate-900 focus:outline-none"
              :class="invalido('valorCamisaOpcional') ? 'border-2 border-red-400 bg-red-50/20' : 'border-slate-300 focus:border-slate-400'"
            />
          </div>
          <p v-if="invalido('valorCamisaOpcional')" class="text-xs text-red-600 font-semibold">Informe um valor válido maior que zero.</p>
        </div>
      </div>

      <p class="text-xs text-slate-600">
        Data em que você fecha o pedido com a gráfica. É diferente da retirada do kit — normalmente é bem antes. A partir dela, ninguém troca
        <template v-if="form.possuiCamisa">tamanho de camiseta, </template>modalidade/categoria ou transfere a inscrição.
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

    <button
      type="button"
      @click="onSubmit"
      :disabled="props.carregando"
      class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50 cursor-pointer"
    >
      {{ props.carregando ? 'Salvando...' : props.modoEdicao ? 'Salvar alterações' : 'Criar evento' }}
    </button>
  </form>

  <!-- Modal: Informações Pendentes / Erros de Validação -->
  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="modalPendenciasAberto"
          class="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-y-auto"
        >
          <!-- Fundo escuro com clique para fechar -->
          <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="fecharModal"></div>

          <div
            class="relative z-[301] w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl transition-all border border-slate-100 my-8 text-left"
            role="dialog"
            aria-modal="true"
          >
            <!-- Botão Fechar (X) -->
            <button
              type="button"
              @click="fecharModal"
              class="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              aria-label="Fechar"
            >
              <X :size="20" />
            </button>

            <!-- Cabeçalho -->
            <div class="flex items-start gap-3.5 mb-4">
              <div class="rounded-2xl bg-amber-100 p-3 text-amber-700 shrink-0">
                <AlertTriangle :size="26" />
              </div>
              <div class="pr-6">
                <h3 class="text-lg font-extrabold text-slate-900 leading-tight">
                  {{ itensPendentes.length > 0 ? 'Faltam informações no cadastro' : 'Aviso do sistema' }}
                </h3>
                <p class="text-xs text-slate-500 mt-1">
                  {{
                    itensPendentes.length > 0
                      ? 'Preencha os campos obrigatórios abaixo para poder salvar o evento:'
                      : 'Verifique a pendência informada para prosseguir:'
                  }}
                </p>
              </div>
            </div>

            <!-- Alerta do Servidor (se houver) -->
            <div
              v-if="props.erroServidor"
              class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
            >
              <p class="font-bold flex items-center gap-1.5 text-red-900 mb-1">
                <AlertCircle :size="15" class="text-red-600" /> Detalhes do sistema:
              </p>
              <p class="leading-relaxed">{{ props.erroServidor }}</p>
            </div>

            <!-- Lista de Pendências -->
            <div
              v-if="itensPendentes.length > 0"
              class="space-y-2 mb-6 max-h-[50vh] overflow-y-auto pr-1"
            >
              <button
                v-for="(item, idx) in itensPendentes"
                :key="item.campo"
                type="button"
                @click="focarPrimeiraPendencia(item.idElemento)"
                class="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/50 p-3 text-xs hover:bg-red-100/70 hover:border-red-300 transition group cursor-pointer"
              >
                <div class="flex items-start gap-2.5 min-w-0">
                  <span
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-200 text-[11px] font-extrabold text-red-800 mt-0.5"
                  >
                    {{ idx + 1 }}
                  </span>
                  <div class="min-w-0">
                    <p class="font-bold text-red-950 truncate">{{ item.titulo }}</p>
                    <p class="text-red-700 text-[11px] mt-0.5 leading-snug">{{ item.descricao }}</p>
                  </div>
                </div>
                <span
                  class="shrink-0 flex items-center gap-1 text-[11px] font-bold text-red-700 group-hover:translate-x-0.5 transition"
                >
                  Preencher <ArrowRight :size="13" />
                </span>
              </button>
            </div>

            <!-- Botões de Ação -->
            <div class="space-y-2">
              <button
                v-if="itensPendentes.length > 0"
                type="button"
                @click="focarPrimeiraPendencia()"
                class="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 shadow-md hover:bg-amber-400 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Preencher campos pendentes</span>
                <ArrowRight :size="16" />
              </button>

              <button
                type="button"
                @click="fecharModal"
                class="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Fechar e continuar editando
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
