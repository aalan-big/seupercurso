<script setup lang="ts">
import type { TabelaTarifas } from '../../composables/useTarifas'
import type { DadosCartaoTokenizado } from '../../composables/useMercadoPagoBrick'
import {
  Flag,
  MapPin,
  Calendar,
  PartyPopper,
  CreditCard,
  FileText,
  Home,
  Check,
  Copy,
  AlertTriangle,
  Ticket,
  Footprints,
  Cake,
  Shirt,
  CheckCircle,
  Clock,
  Users,
  Plus,
  Trash2,
  UserCheck,
  X
} from 'lucide-vue-next'

const route = useRoute()
const eventoId = route.params.id as string

const { token } = useAuth()
const { eventoSelecionado, fetchEvento } = useEvento()
const { minhasInscricoes, fetchMinhas, criarBatch, pagarInscricao } = useInscricao()
const { cliente, fetchMe: fetchClienteMe } = useCliente()
const { dependentes, fetchDependentes } = useDependente()

const titularJaInscrito = computed(() => {
  if (!cliente.value?.pf?.cpf) return false
  const cpfTitular = cliente.value.pf.cpf.replace(/\D/g, '')
  return (minhasInscricoes.value || []).some((insc) => {
    if (insc.status === 'CANCELADA' || insc.status === 'EXPIRADA') return false
    const evId = insc.categoria?.modalidade?.evento?.id
    if (evId !== eventoId) return false
    const cpfInscrito = (insc.atletaCpf || insc.dependente?.cpf || '').replace(/\D/g, '')
    return !cpfInscrito || cpfInscrito === cpfTitular
  })
})

const carregando = ref(true)
const erro = ref('')

const passos = ['Escolha dos Atletas', 'Modalidades & Categorias', 'Camisetas & Resumo', 'Pagamento']
const step = ref(1)

interface ItemCarrinho {
  uid: string
  tipo: 'EU' | 'DEPENDENTE' | 'MANUAL'
  dependenteId?: string
  nome: string
  cpf: string
  dataNascimento: string
  genero: 'MASCULINO' | 'FEMININO' | 'OUTRO'
  pcd: boolean
  modalidadeId: string | null
  categoriaId: string | null
  tamanhoCamisa: string
}

const carrinho = ref<ItemCarrinho[]>([])

// Modal de adição de atleta
const modalAdicionarAtletaAberto = ref(false)
const tipoNovoAtleta = ref<'DEPENDENTE' | 'MANUAL'>('DEPENDENTE')
const dependenteSelecionadoId = ref<string | null>(null)

const formManual = reactive({
  nomeCompleto: '',
  cpf: '',
  dataNascimento: '',
  genero: 'MASCULINO' as 'MASCULINO' | 'FEMININO' | 'OUTRO',
  pcd: false
})

function onInputCpfManual(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  formManual.cpf = v
}

const cupomCodigo = ref('')
const aceiteTermos = ref(false)

const pixCopiado = ref(false)
function copiarPixCode(code: string) {
  if (process.client && navigator && navigator.clipboard) {
    navigator.clipboard.writeText(code)
    pixCopiado.value = true
    setTimeout(() => {
      pixCopiado.value = false
    }, 3000)
  }
}

const validandoCupom = ref(false)
const cupomAplicadoInfo = ref<{ codigo: string; percentualDesconto: number } | null>(null)
const erroCupom = ref('')

async function aplicarCupom() {
  erroCupom.value = ''
  const cod = cupomCodigo.value.trim()
  if (!cod) {
    erroCupom.value = 'Digite o código do cupom.'
    return
  }
  validandoCupom.value = true
  try {
    const api = useApi()
    const res = await api<{ valido: boolean; codigo: string; percentualDesconto: number }>(
      `/eventos/${eventoId}/validar-cupom?codigo=${encodeURIComponent(cod)}`
    )
    cupomAplicadoInfo.value = { codigo: res.codigo, percentualDesconto: res.percentualDesconto }
  } catch (e: any) {
    cupomAplicadoInfo.value = null
    erroCupom.value = extrairErro(e)
  } finally {
    validandoCupom.value = false
  }
}

function removerCupom() {
  cupomCodigo.value = ''
  cupomAplicadoInfo.value = null
  erroCupom.value = ''
}

const inscrevendo = ref(false)
const erroInscricao = ref('')
const metodoPagamentoSelecionado = ref<'PIX' | 'CREDITO'>('PIX')
const inscricaoCriada = ref<{ id?: string; pedidoId?: string; pagamentoId?: string; valor: string; metodo?: string; pixCopiaECola?: string; pixQrCodeUrl?: string } | null>(null)

// Acompanhamento do PIX: sem isso o comprador pagava e ficava na tela sem
// nenhuma confirmacao, dependendo de recarregar a pagina.
const { consultarStatus } = usePagamento()
const statusPagamento = ref<'PENDENTE' | 'APROVADO' | 'EXPIRADO' | 'RECUSADO' | 'ESTORNADO' | 'CANCELADO'>('PENDENTE')
let timerStatus: ReturnType<typeof setInterval> | null = null

function pararAcompanhamento() {
  if (timerStatus) {
    clearInterval(timerStatus)
    timerStatus = null
  }
}

function acompanharPagamento(pagamentoId: string) {
  pararAcompanhamento()
  statusPagamento.value = 'PENDENTE'

  timerStatus = setInterval(async () => {
    try {
      const res = await consultarStatus(pagamentoId)
      if (!res) return
      statusPagamento.value = res.status
      if (res.status !== 'PENDENTE') pararAcompanhamento()
    } catch {
      // Falha de rede pontual nao deve encerrar o acompanhamento.
    }
  }, 5000)
}

onBeforeUnmount(pararAcompanhamento)

const tamanhos = ['PP', 'P', 'M', 'G', 'GG', 'XGG']

const storageKey = `checkout_carrinho_${eventoId}`

function salvarEstadoCheckout() {
  if (import.meta.client) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        step: step.value,
        carrinho: carrinho.value,
        cupomCodigo: cupomCodigo.value,
      }))
    } catch {}
  }
}

function recuperarEstadoCheckout() {
  if (import.meta.client) {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.carrinho && Array.isArray(parsed.carrinho) && parsed.carrinho.length > 0) {
          carrinho.value = parsed.carrinho
        }
        if (parsed.step && parsed.step > 1) {
          step.value = parsed.step
        }
        if (parsed.cupomCodigo) {
          cupomCodigo.value = parsed.cupomCodigo
        }
      }
    } catch {}
  }
}

function limparEstadoCheckout() {
  if (import.meta.client) {
    try {
      sessionStorage.removeItem(storageKey)
    } catch {}
  }
}

watch([carrinho, step, cupomCodigo], () => {
  salvarEstadoCheckout()
}, { deep: true })

onMounted(async () => {
  try {
    await fetchEvento(eventoId)
    recuperarEstadoCheckout()
    if (eventoSelecionado.value) {
      if (eventoSelecionado.value.aceitaPix !== false) {
        metodoPagamentoSelecionado.value = 'PIX'
      } else if (eventoSelecionado.value.aceitaCartao) {
        metodoPagamentoSelecionado.value = 'CREDITO'
      }
    }
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }

  if (token.value) {
    try {
      await fetchClienteMe()
      await fetchDependentes()
      await fetchMinhas()
    } catch {
      // perfil ou inscrições não carregadas
    }
    inicializarCarrinhoComTitular()
  }
})

function inicializarCarrinhoComTitular() {
  if (carrinho.value.length === 0 && cliente.value?.pf) {
    if (titularJaInscrito.value) {
      // Se o titular já estiver inscrito no evento, não adiciona ele automaticamente no carrinho
      return
    }
    const pf = cliente.value.pf
    carrinho.value.push({
      uid: 'titular_' + Date.now(),
      tipo: 'EU',
      nome: pf.nomeCompleto,
      cpf: pf.cpf,
      dataNascimento: pf.dataNascimento ? pf.dataNascimento.split('T')[0] : '',
      genero: pf.genero as any,
      pcd: pf.pcd || false,
      modalidadeId: null,
      categoriaId: null,
      tamanhoCamisa: 'M'
    })
  }
}

function abrirModalAdicionarAtleta() {
  erroInscricao.value = ''
  formManual.nomeCompleto = ''
  formManual.cpf = ''
  formManual.dataNascimento = ''
  formManual.genero = 'MASCULINO'
  formManual.pcd = false
  dependenteSelecionadoId.value = dependentes.value.length > 0 ? dependentes.value[0].id : null
  modalAdicionarAtletaAberto.value = true
}

function confirmarAdicionarAtleta() {
  erroInscricao.value = ''
  if (tipoNovoAtleta.value === 'DEPENDENTE') {
    if (!dependenteSelecionadoId.value) {
      alert('Selecione um dependente.')
      return
    }
    const dep = dependentes.value.find((d) => d.id === dependenteSelecionadoId.value)
    if (!dep) return

    const depCpf = (dep.cpf || '').replace(/\D/g, '')
    if (depCpf && carrinho.value.some((item) => (item.cpf || '').replace(/\D/g, '') === depCpf)) {
      alert(`O atleta ${dep.nomeCompleto} já está no seu carrinho de inscrições.`)
      return
    }

    carrinho.value.push({
      uid: 'dep_' + dep.id + '_' + Date.now(),
      tipo: 'DEPENDENTE',
      dependenteId: dep.id,
      nome: dep.nomeCompleto,
      cpf: dep.cpf || '',
      dataNascimento: dep.dataNascimento ? dep.dataNascimento.split('T')[0] : '',
      genero: dep.genero as any,
      pcd: dep.pcd || false,
      modalidadeId: null,
      categoriaId: null,
      tamanhoCamisa: 'M'
    })
  } else {
    if (!formManual.nomeCompleto.trim() || !formManual.cpf.trim() || !formManual.dataNascimento) {
      alert('Preencha os campos obrigatórios do atleta (Nome, CPF e Data de Nascimento).')
      return
    }
    const cpfLimpo = formManual.cpf.replace(/\D/g, '')
    if (!cpfEhValido(cpfLimpo)) {
      alert('CPF inválido. Confira os números digitados.')
      return
    }
    if (carrinho.value.some((item) => (item.cpf || '').replace(/\D/g, '') === cpfLimpo)) {
      alert('Este CPF já está no seu carrinho de inscrições.')
      return
    }

    carrinho.value.push({
      uid: 'man_' + Date.now(),
      tipo: 'MANUAL',
      nome: formManual.nomeCompleto.trim(),
      cpf: cpfLimpo,
      dataNascimento: formManual.dataNascimento,
      genero: formManual.genero,
      pcd: formManual.pcd,
      modalidadeId: null,
      categoriaId: null,
      tamanhoCamisa: 'M'
    })
  }
  modalAdicionarAtletaAberto.value = false
}

function removerAtleta(uid: string) {
  carrinho.value = carrinho.value.filter((item) => item.uid !== uid)
}

function calcularIdade(nascimentoIso: string, referenciaIso: string) {
  if (!nascimentoIso || !referenciaIso) return 0
  const nascimento = new Date(nascimentoIso)
  const referencia = new Date(referenciaIso)
  let idade = referencia.getUTCFullYear() - nascimento.getUTCFullYear()
  const aniversarioEsteAno = Date.UTC(referencia.getUTCFullYear(), nascimento.getUTCMonth(), nascimento.getUTCDate())
  if (referencia.getTime() < aniversarioEsteAno) idade -= 1
  return idade
}

function motivoInelegibilidadeParaAtleta(
  categoria: { idadeMinima: number | null; idadeMaxima: number | null; genero: string; pcd: boolean; vagasRestantes?: number | null },
  atleta: { dataNascimento: string; genero: string; pcd: boolean }
) {
  if (!atleta || !eventoSelecionado.value) return null

  if (categoria.vagasRestantes !== undefined && categoria.vagasRestantes !== null && categoria.vagasRestantes <= 0) {
    return 'Vagas esgotadas para essa categoria'
  }

  if (categoria.idadeMinima !== null || categoria.idadeMaxima !== null) {
    const idade = calcularIdade(atleta.dataNascimento, eventoSelecionado.value.dataInicio)
    if (categoria.idadeMinima !== null && idade < categoria.idadeMinima) {
      return `Idade mínima: ${categoria.idadeMinima} anos (atleta tem ${idade} anos)`
    }
    if (categoria.idadeMaxima !== null && idade > categoria.idadeMaxima) {
      return `Idade máxima: ${categoria.idadeMaxima} anos (atleta tem ${idade} anos)`
    }
  }

  if (categoria.genero !== 'LIVRE' && categoria.genero !== atleta.genero) {
    return 'Gênero incompatível com a categoria'
  }

  if (categoria.pcd && !atleta.pcd) {
    return 'Categoria exclusiva PCD'
  }

  return null
}

const modalidadesAtivas = computed(
  () => eventoSelecionado.value?.modalidades.filter((m) => m.ativo) || []
)

const loteAtivo = computed(() => {
  const agora = new Date()
  const lotes = eventoSelecionado.value?.lotes || []
  const disponivel = lotes.find(
    (l) =>
      new Date(l.inicioVenda) <= agora &&
      agora <= new Date(l.fimVenda) &&
      (l.vagasRestantes === null || l.vagasRestantes > 0)
  )
  return disponivel || lotes[0] || null
})

function precoBasePara(modalidadeId: string) {
  const preco = loteAtivo.value?.precos.find((p) => p.modalidadeId === modalidadeId)
  return preco ? Number(preco.valor) : 0
}

function calcularPrecoItem(item: ItemCarrinho) {
  if (!item.modalidadeId) return 0
  const valorBase = precoBasePara(item.modalidadeId)
  let valor = valorBase

  if (eventoSelecionado.value?.aplicaDescontoIdoso && eventoSelecionado.value.percentualDescontoIdoso) {
    const idade = calcularIdade(item.dataNascimento, eventoSelecionado.value.dataInicio)
    if (idade >= 60) {
      valor -= valor * (Number(eventoSelecionado.value.percentualDescontoIdoso) / 100)
    }
  }

  if (cupomAplicadoInfo.value) {
    valor -= valor * (cupomAplicadoInfo.value.percentualDesconto / 100)
  }

  if (eventoSelecionado.value?.taxaRepassadaAtleta) {
    valor += valorBase * 0.10
  }

  return Math.max(0, valor)
}

const valorTotalCalculado = computed(() => {
  return carrinho.value.reduce((total, item) => total + calcularPrecoItem(item), 0)
})

function selecionarModalidadeItem(item: ItemCarrinho, modalidadeId: string) {
  item.modalidadeId = modalidadeId
  item.categoriaId = null
  const mod = modalidadesAtivas.value.find((m) => m.id === modalidadeId)
  if (mod && mod.categorias && mod.categorias.length > 0) {
    const elegivel = mod.categorias.find((c) => !motivoInelegibilidadeParaAtleta(c, item))
    item.categoriaId = elegivel ? elegivel.id : mod.categorias[0].id
  }
}

const podeAvancar = computed(() => {
  if (carrinho.value.length === 0) return false
  if (step.value === 1) {
    return carrinho.value.length > 0
  }
  if (step.value === 2) {
    return carrinho.value.every((i) => !!i.modalidadeId && !!i.categoriaId)
  }
  if (step.value === 3) {
    return carrinho.value.every((i) => !!i.tamanhoCamisa)
  }
  return true
})

function formatarPreco(valor: number | null) {
  return valor === null ? 'Sem preço definido' : `R$ ${valor.toFixed(2)}`
}

function formatarCpf(val: string | null | undefined) {
  if (!val) return ''
  const nums = val.replace(/\D/g, '').slice(0, 11)
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatarData(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const generoLabel: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  LIVRE: 'Livre'
}

function avancar() {
  erroInscricao.value = ''

  if (carrinho.value.length === 0) {
    erroInscricao.value = 'Adicione ao menos um atleta no carrinho para continuar.'
    return
  }

  if (step.value === 1) {
    // Na Etapa 1, apenas confirma se há atletas no carrinho
    if (carrinho.value.length === 0) {
      erroInscricao.value = 'Adicione ao menos um participante no carrinho para avançar.'
      return
    }
  }

  if (step.value === 2) {
    // Na Etapa 2, valida a escolha da modalidade e categoria para cada participante
    const pendentes = carrinho.value.filter((i) => !i.modalidadeId || !i.categoriaId)
    if (pendentes.length > 0) {
      const nomes = pendentes.map((i) => i.nome).join(', ')
      erroInscricao.value = `Selecione o percurso (modalidade) e a categoria para: ${nomes}.`
      return
    }
  }

  if (step.value === 3) {
    // Na Etapa 3, valida o tamanho das camisetas
    const faltamCamisetas = carrinho.value.filter((i) => !i.tamanhoCamisa)
    if (faltamCamisetas.length > 0) {
      const nomes = faltamCamisetas.map((i) => i.nome).join(', ')
      erroInscricao.value = `Selecione o tamanho da camiseta para: ${nomes}.`
      return
    }
  }

  if (step.value < passos.length) {
    step.value += 1
  }
}

function voltar() {
  erroInscricao.value = ''
  if (step.value > 1) step.value -= 1
}

// O cartao passou a ser tokenizado pelo Payment Brick do Mercado Pago: nenhum
// dado de cartao passa por aqui nem pelo nosso servidor.
const { montar: montarBrick, desmontar: desmontarBrick } = useMercadoPagoBrick()

// A tarifa do gateway e a taxa de servico vem do servidor, com o eventoId, para
// a tela mostrar exatamente o que sera cobrado: quem paga a comissao e escolha
// do organizador e o front nao conhece a comissao de cada um.
const { buscar: buscarTarifas } = useTarifas()
const tarifas = ref<TabelaTarifas | null>(null)

watch(
  () => valorTotalCalculado.value,
  async (base) => {
    if (!base || base <= 0) {
      tarifas.value = null
      return
    }
    try {
      tarifas.value = await buscarTarifas(base, eventoId)
    } catch {
      tarifas.value = null
    }
  },
  { immediate: true }
)

const taxaServico = computed(() => tarifas.value?.taxaServico ?? 0)
const taxaPix = computed(() => tarifas.value?.pixTarifa ?? 0)
const totalPix = computed(() => tarifas.value?.pixTotal ?? valorTotalCalculado.value)

const opcoesParcelamentoCalculadas = computed(() => {
  const base = valorTotalCalculado.value
  if (!base) return []

  const lista = []

  for (const opcao of tarifas.value?.parcelamento || []) {
    const { num: n, total: totalComJuros, parcela: valorParcela } = opcao

    if (n === 1) {
      lista.push({
        num: 1,
        total: totalComJuros,
        parcela: totalComJuros,
        label: `1x à vista de R$ ${totalComJuros.toFixed(2)}`
      })
    } else {
      lista.push({
        num: n,
        total: totalComJuros,
        parcela: valorParcela,
        label: `${n}x de R$ ${valorParcela.toFixed(2)} (Total: R$ ${totalComJuros.toFixed(2)})`
      })
    }
  }

  return lista
})

// Valor a vista no cartao. O custo do parcelamento e apresentado e cobrado
// pelo proprio Mercado Pago dentro do Brick.
const totalCartao = computed(
  () => tarifas.value?.parcelamento?.[0]?.total ?? valorTotalCalculado.value
)

// Só a tarifa do gateway: a taxa de serviço já aparece na linha dela, e sem
// descontar aqui o resumo somaria a comissão duas vezes.
const taxaCartao = computed(() =>
  Math.max(0, totalCartao.value - valorTotalCalculado.value - taxaServico.value)
)

const valorFinalComMetodo = computed(() =>
  metodoPagamentoSelecionado.value === 'CREDITO'
    ? totalCartao.value
    : totalPix.value
)

/**
 * Cria o pedido e gera a cobranca.
 *
 * No cartao quem dispara e o Brick, ja com o token pronto; no PIX e o botao da
 * tela. O pedido so e criado aqui, depois de o cartao ter sido validado, para
 * nao deixar inscricao orfa quando o cartao e recusado.
 */
// O Brick precisa do valor final; remonta quando o carrinho ou o metodo muda.
watch(
  [metodoPagamentoSelecionado, totalCartao, step],
  async ([metodo, valor, passoAtual], anterior) => {
    if (metodo !== 'CREDITO' || passoAtual !== 4 || !valor) {
      // Sem isso o aviso do cartao continuava na tela depois de trocar para o
      // PIX, dizendo que o pagamento estava indisponivel bem acima de um PIX
      // que funciona.
      if (anterior?.[0] === 'CREDITO' && metodo !== 'CREDITO') {
        erroInscricao.value = ''
      }
      await desmontarBrick()
      return
    }

    await nextTick()
    await montarBrick({
      container: '#brick-cartao',
      valor,
      eventoId,
      email: cliente.value?.usuario?.email,
      maxParcelas: tarifas.value?.maxParcelas ?? 12,
      onPagar: (dados) => onInscrever(dados),
      onErro: (mensagem) => {
        erroInscricao.value = mensagem
      }
    })
  },
  { immediate: true }
)

async function onInscrever(dadosCartao?: DadosCartaoTokenizado) {
  erroInscricao.value = ''

  if (!token.value) {
    await navigateTo(`/login?redirect=/eventos/${eventoId}`)
    return
  }

  if (carrinho.value.length === 0) {
    erroInscricao.value = 'Adicione ao menos um atleta participante para prosseguir.'
    return
  }

  if (carrinho.value.some((i) => !i.categoriaId || !i.modalidadeId)) {
    erroInscricao.value = 'Selecione a modalidade e a categoria para todos os atletas do carrinho.'
    return
  }

  inscrevendo.value = true
  try {
    const itemsPayload = carrinho.value.map((item) => ({
      categoriaId: item.categoriaId!,
      loteId: loteAtivo.value!.id,
      tamanhoCamisa: item.tamanhoCamisa,
      cupomCodigo: cupomCodigo.value || undefined,
      dependenteId: item.dependenteId,
      atleta: item.tipo === 'MANUAL'
        ? {
            nomeCompleto: item.nome,
            cpf: item.cpf,
            dataNascimento: item.dataNascimento,
            genero: item.genero,
            pcd: item.pcd
          }
        : undefined
    }))

    const batchRes = await criarBatch(itemsPayload)

    const pagamentoRes = await pagarInscricao(
      undefined,
      metodoPagamentoSelecionado.value,
      dadosCartao,
      batchRes.pedidoId
    )

    const valorFinalReal = (pagamentoRes as any)?.valor || valorFinalComMetodo.value || batchRes.valorTotal

    inscricaoCriada.value = {
      pedidoId: batchRes.pedidoId,
      pagamentoId: (pagamentoRes as any)?.id,
      valor: valorFinalReal.toString(),
      metodo: metodoPagamentoSelecionado.value,
      pixCopiaECola: (pagamentoRes as any)?.pixCopiaECola,
      pixQrCodeUrl: (pagamentoRes as any)?.pixQrCodeUrl
    }
    limparEstadoCheckout()

    if (metodoPagamentoSelecionado.value === 'PIX' && inscricaoCriada.value.pagamentoId) {
      acompanharPagamento(inscricaoCriada.value.pagamentoId)
    }
  } catch (e: any) {
    erroInscricao.value = extrairErro(e)
  } finally {
    inscrevendo.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800 py-8 px-4 sm:px-6">
    <div class="mx-auto max-w-5xl">

      <!-- Loading / Erro Evento -->
      <div v-if="carregando" class="py-20 text-center text-slate-400">
        <div class="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p>Carregando dados do evento...</p>
      </div>

      <div v-else-if="erro || !eventoSelecionado" class="py-16 text-center text-rose-400">
        <AlertTriangle class="w-12 h-12 mx-auto mb-3" />
        <p class="font-bold">{{ erro || 'Evento não encontrado.' }}</p>
        <NuxtLink to="/" class="mt-4 inline-block text-sm text-orange-400 underline">Voltar para a lista de eventos</NuxtLink>
      </div>

      <template v-else>

        <!-- Sucesso Inscrição -->
        <div v-if="inscricaoCriada" class="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-xl text-center space-y-5 text-slate-800">
          <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
            <CheckCircle class="w-10 h-10" />
          </div>

          <div>
            <h2 class="text-xl sm:text-3xl font-black text-slate-900">Inscrições Geradas com Sucesso!</h2>
            <p class="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              {{ carrinho.length }} atleta(s) cadastrado(s) no evento <strong class="text-slate-800">{{ eventoSelecionado.nome }}</strong>.
            </p>
          </div>

          <!-- PIX QR Code / Copia e Cola Responsivo -->
          <div v-if="inscricaoCriada.metodo === 'PIX' && inscricaoCriada.pixCopiaECola" class="p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div class="space-y-1">
              <span class="inline-block px-3 py-1 bg-orange-100 text-orange-800 border border-orange-200 rounded-full text-[11px] font-black uppercase tracking-wider">
                Pagamento via PIX
              </span>
              <p class="text-2xl sm:text-3xl font-black text-slate-900 pt-1">R$ {{ Number(inscricaoCriada.valor).toFixed(2) }}</p>
            </div>

            <!-- Imagem QR Code Responsiva -->
            <div v-if="inscricaoCriada.pixQrCodeUrl" class="bg-white p-3 inline-block rounded-2xl mx-auto border border-slate-200 shadow-sm max-w-full">
              <img :src="inscricaoCriada.pixQrCodeUrl" alt="QR Code PIX" class="w-44 h-44 sm:w-52 sm:h-52 mx-auto object-contain" />
              <p class="text-[11px] font-bold text-slate-500 mt-2">Aponte a câmera do app do seu banco</p>
            </div>

            <!-- Código Copia e Cola com Botão de Ação Destacado -->
            <div class="space-y-2 text-left max-w-md mx-auto">
              <label class="block text-xs font-bold text-slate-700">PIX Copia e Cola:</label>
              <div class="flex flex-col sm:flex-row items-stretch gap-2">
                <input
                  type="text"
                  readonly
                  :value="inscricaoCriada.pixCopiaECola"
                  class="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none shadow-xs truncate select-all"
                  @click="(e) => (e.target as HTMLInputElement).select()"
                />
                <button
                  @click="copiarPixCode(inscricaoCriada.pixCopiaECola!)"
                  class="px-5 py-3 sm:py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                >
                  <Copy class="w-4 h-4" />
                  <span>{{ pixCopiado ? 'Copiado com Sucesso!' : 'Copiar Código' }}</span>
                </button>
              </div>
            </div>

            <!-- Estado da cobranca, atualizado automaticamente a cada 5s -->
            <div
              v-if="statusPagamento === 'APROVADO'"
              class="flex items-center justify-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black uppercase tracking-wider"
            >
              <CheckCircle class="w-4 h-4" />
              <span>Pagamento confirmado! Vouchers enviados por e-mail.</span>
            </div>

            <div
              v-else-if="statusPagamento === 'EXPIRADO'"
              class="flex items-center justify-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold"
            >
              <AlertTriangle class="w-4 h-4 shrink-0" />
              <span>Este código PIX expirou. Gere uma nova cobrança em "Minhas Inscrições".</span>
            </div>

            <div
              v-else
              class="flex items-center justify-center gap-2 text-[11px] sm:text-xs font-semibold text-slate-500 pt-1"
            >
              <span class="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0"></span>
              <span>Aguardando o pagamento… a confirmação aparece aqui automaticamente.</span>
            </div>
          </div>

          <div v-else class="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-2xl">
            Sua compra via Cartão de Crédito foi processada com sucesso. Confira suas inscrições em "Minhas Inscrições".
          </div>

          <div class="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
            <NuxtLink to="/minhas-inscricoes" class="w-full sm:w-auto px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md text-center">
              Ver Minhas Inscrições
            </NuxtLink>
            <NuxtLink to="/" class="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition text-center">
              Voltar ao Início
            </NuxtLink>
          </div>
        </div>

        <!-- Inscrições Esgotadas / Encerradas -->
        <div v-else-if="eventoSelecionado.status === 'INSCRICOES_ENCERRADAS' || eventoSelecionado.status === 'FINALIZADO'" class="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xl text-center space-y-6 text-slate-800">
          <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200">
            <AlertTriangle class="w-9 h-9" />
          </div>

          <div class="space-y-2">
            <span class="inline-block px-3.5 py-1 bg-red-100 text-red-800 border border-red-200 rounded-full text-xs font-black uppercase tracking-wider">
              {{ eventoSelecionado.status === 'INSCRICOES_ENCERRADAS' ? 'Inscrições Esgotadas' : 'Evento Finalizado' }}
            </span>
            <h1 class="text-2xl sm:text-3xl font-black text-slate-900">{{ eventoSelecionado.nome }}</h1>
            <p class="text-sm font-semibold text-slate-500 max-w-md mx-auto">
              {{ eventoSelecionado.status === 'INSCRICOES_ENCERRADAS' ? 'As vagas e inscrições para este evento foram esgotadas pelo organizador.' : 'Este evento já foi realizado e encerrado.' }}
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-600 pt-3 border-t border-slate-100">
            <span class="flex items-center gap-1.5"><Calendar class="w-4 h-4 text-orange-500" /> {{ formatarData(eventoSelecionado.dataInicio) }}</span>
            <span class="flex items-center gap-1.5"><MapPin class="w-4 h-4 text-orange-500" /> {{ eventoSelecionado.local }} - {{ eventoSelecionado.cidade }}/{{ eventoSelecionado.estado }}</span>
          </div>

          <div class="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <NuxtLink to="/" class="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm rounded-xl transition shadow-lg">
              Ver Outros Eventos Abertos
            </NuxtLink>
          </div>
        </div>

        <!-- Fluxo de Checkout em Passos -->
        <div v-else class="space-y-8">
          
          <!-- Banner Header Evento -->
          <div class="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-sm">
            <div class="space-y-2">
              <span class="px-3 py-1 bg-orange-100 text-orange-800 border border-orange-200 rounded-full text-xs font-black uppercase tracking-wider">
                Inscrição de Atletas
              </span>
              <h1 class="text-2xl sm:text-3xl font-black text-slate-900">{{ eventoSelecionado.nome }}</h1>
              <div class="flex flex-wrap gap-4 text-xs font-semibold text-slate-500 pt-1">
                <span class="flex items-center gap-1"><Calendar class="w-4 h-4 text-orange-500" /> {{ formatarData(eventoSelecionado.dataInicio) }}</span>
                <span class="flex items-center gap-1"><MapPin class="w-4 h-4 text-orange-500" /> {{ eventoSelecionado.local }} - {{ eventoSelecionado.cidade }}/{{ eventoSelecionado.estado }}</span>
              </div>
            </div>

            <!-- Stepper -->
            <div class="flex items-center gap-2 self-stretch md:self-auto justify-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div v-for="(p, index) in passos" :key="index" class="flex items-center gap-2">
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition"
                  :class="step === index + 1 ? 'bg-orange-500 text-white shadow-sm' : step > index + 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'"
                >
                  {{ index + 1 }}
                </div>
                <span class="text-xs font-bold hidden sm:inline" :class="step === index + 1 ? 'text-slate-900' : 'text-slate-400'">{{ p }}</span>
                <span v-if="index < passos.length - 1" class="w-4 h-0.5 bg-slate-300"></span>
              </div>
            </div>
          </div>

          <!-- Alertas Globais -->
          <div v-if="erroInscricao" class="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-2xl flex items-center gap-3">
            <AlertTriangle class="w-5 h-5 flex-shrink-0 text-red-600" />
            <span>{{ erroInscricao }}</span>
          </div>

          <!-- Alerta Titular Já Inscrito -->
          <div v-if="titularJaInscrito" class="p-4 bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold rounded-2xl flex items-center justify-between gap-3 shadow-sm">
            <div class="flex items-center gap-2.5">
              <CheckCircle class="w-5 h-5 text-amber-600 shrink-0" />
              <span><strong>Você (Titular) já possui inscrição neste evento.</strong> Selecione ou cadastre abaixo apenas os dependentes que deseja inscrever.</span>
            </div>
          </div>

          <!-- PASSO 1: ESCOLHA DOS ATLETAS -->
          <div v-if="step === 1" class="space-y-6">

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Users class="w-5 h-5 text-orange-500" />
                  1. Atletas Participantes ({{ carrinho.length }})
                </h2>
                <p class="text-xs text-slate-500">Confirme quem irá participar do evento. Você pode adicionar dependentes ou convidados.</p>
              </div>

              <button
                @click="abrirModalAdicionarAtleta"
                class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm shrink-0"
              >
                <Plus class="w-4 h-4" />
                <span>Adicionar Atleta</span>
              </button>
            </div>

            <!-- Carrinho Vazio -->
            <div v-if="carrinho.length === 0" class="p-8 sm:p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
              <div class="w-14 h-14 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto">
                <Users class="w-7 h-7" />
              </div>
              <h3 class="text-base sm:text-lg font-extrabold text-slate-800">Nenhum atleta no carrinho para este evento</h3>
              <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                {{ titularJaInscrito ? 'Como você já possui inscrição neste evento, selecione ou cadastre seus dependentes para continuar.' : 'Adicione os participantes que deseja inscrever neste evento.' }}
              </p>
              <button
                @click="abrirModalAdicionarAtleta"
                class="inline-flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm"
              >
                <Plus class="w-4 h-4" />
                <span>Adicionar Atleta</span>
              </button>
            </div>

            <!-- Lista de Atletas no Passo 1 -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="(item, idx) in carrinho"
                :key="item.uid"
                class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 relative flex flex-col justify-between"
              >
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-extrabold text-xs flex items-center justify-center border border-orange-200">
                        #{{ idx + 1 }}
                      </span>
                      <h3 class="font-extrabold text-base text-slate-900">{{ item.nome }}</h3>
                    </div>
                    <button
                      @click="removerAtleta(item.uid)"
                      class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition"
                      title="Remover Atleta"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>

                  <div class="flex flex-wrap gap-1.5 text-[10px] font-black uppercase">
                    <span v-if="item.tipo === 'EU'" class="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded-full">Titular</span>
                    <span v-else-if="item.tipo === 'DEPENDENTE'" class="px-2.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded-full">Dependente</span>
                    <span v-else class="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full">Convidado</span>
                    <span v-if="item.pcd" class="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-full">PCD</span>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                    <div>
                      <span class="text-[10px] font-bold uppercase text-slate-400 block">CPF</span>
                      <span class="font-bold text-slate-800">{{ formatarCpf(item.cpf) }}</span>
                    </div>
                    <div>
                      <span class="text-[10px] font-bold uppercase text-slate-400 block">Nascimento</span>
                      <span class="font-bold text-slate-800">{{ formatarData(item.dataNascimento) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- PASSO 2: MODALIDADES & CATEGORIAS -->
          <div v-if="step === 2" class="space-y-6">
            <div>
              <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
                <Footprints class="w-5 h-5 text-orange-500" />
                2. Seleção de Modalidades & Categorias
              </h2>
              <p class="text-xs text-slate-500">Escolha o percurso e a categoria correspondente para cada atleta selecionado.</p>
            </div>

            <div class="space-y-6">
              <div
                v-for="(item, idx) in carrinho"
                :key="item.uid"
                class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm text-slate-800"
              >
                <!-- Cabeçalho do Atleta -->
                <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-extrabold flex items-center justify-center border border-orange-200 text-xs">
                      #{{ idx + 1 }}
                    </div>
                    <h3 class="font-extrabold text-base text-slate-900">{{ item.nome }}</h3>
                  </div>
                  <span v-if="item.modalidadeId && item.categoriaId" class="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle class="w-4 h-4" /> Selecionado
                  </span>
                  <span v-else class="text-xs font-bold text-amber-600">
                    Pendente de Seleção
                  </span>
                </div>

                <!-- Escolha da Modalidade -->
                <div class="space-y-3">
                  <label class="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Percurso / Modalidade para {{ item.nome.split(' ')[0] }}:
                  </label>

                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <button
                      v-for="mod in modalidadesAtivas"
                      :key="mod.id"
                      :disabled="mod.vagasRestantes !== undefined && mod.vagasRestantes !== null && mod.vagasRestantes <= 0"
                      @click="selecionarModalidadeItem(item, mod.id)"
                      class="p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-2"
                      :class="[
                        mod.vagasRestantes !== undefined && mod.vagasRestantes !== null && mod.vagasRestantes <= 0
                          ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed text-slate-400'
                          : item.modalidadeId === mod.id
                          ? 'bg-orange-50 border-orange-500 text-slate-900 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      ]"
                    >
                      <div class="flex items-center justify-between">
                        <span class="font-extrabold text-sm text-slate-900">{{ mod.nome }}</span>
                        <span class="text-xs font-black text-orange-600">{{ formatarPreco(precoBasePara(mod.id)) }}</span>
                      </div>
                      <p v-if="mod.descricao" class="text-xs text-slate-500 line-clamp-2">{{ mod.descricao }}</p>
                      <p v-if="mod.vagasRestantes !== undefined && mod.vagasRestantes !== null && mod.vagasRestantes <= 0" class="text-xs font-bold text-rose-500">
                        Vagas esgotadas
                      </p>
                    </button>
                  </div>
                </div>

                <!-- Categorias Elegíveis para Este Atleta -->
                <div v-if="item.modalidadeId" class="space-y-3 pt-2">
                  <label class="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Categoria para {{ item.nome.split(' ')[0] }}:
                  </label>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      v-for="cat in modalidadesAtivas.find((m) => m.id === item.modalidadeId)?.categorias || []"
                      :key="cat.id"
                      @click="!motivoInelegibilidadeParaAtleta(cat, item) && (item.categoriaId = cat.id)"
                      class="p-3.5 rounded-xl border transition flex items-center justify-between cursor-pointer"
                      :class="[
                        motivoInelegibilidadeParaAtleta(cat, item)
                          ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed text-slate-400'
                          : item.categoriaId === cat.id
                          ? 'bg-orange-50 border-orange-500 text-slate-900 font-extrabold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      ]"
                    >
                      <div>
                        <p class="text-sm font-semibold">{{ cat.nome }}</p>
                        <p v-if="motivoInelegibilidadeParaAtleta(cat, item)" class="text-xs text-rose-500 mt-0.5">
                          {{ motivoInelegibilidadeParaAtleta(cat, item) }}
                        </p>
                      </div>
                      <Check v-if="item.categoriaId === cat.id" class="w-4 h-4 text-orange-500" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- PASSO 3: CAMISETAS & RESUMO -->
          <div v-if="step === 3" class="space-y-6">
            <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
              <Shirt class="w-5 h-5 text-orange-500" />
              3. Tamanho das Camisetas & Resumo
            </h2>

            <div class="space-y-4">
              <div
                v-for="item in carrinho"
                :key="item.uid"
                class="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
              >
                <div>
                  <h4 class="font-extrabold text-slate-900 text-base">{{ item.nome }}</h4>
                  <p class="text-xs font-semibold text-slate-500">
                    {{ modalidadesAtivas.find((m) => m.id === item.modalidadeId)?.nome }} ·
                    {{ modalidadesAtivas.find((m) => m.id === item.modalidadeId)?.categorias?.find((c) => c.id === item.categoriaId)?.nome }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-xs text-slate-700 font-bold">Camiseta:</span>
                  <div class="flex gap-1">
                    <button
                      v-for="tam in tamanhos"
                      :key="tam"
                      @click="item.tamanhoCamisa = tam"
                      class="w-9 h-9 rounded-xl border text-xs font-bold transition flex items-center justify-center"
                      :class="item.tamanhoCamisa === tam ? 'bg-orange-500 border-orange-500 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'"
                    >
                      {{ tam }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Resumo do Carrinho -->
            <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h3 class="font-black text-base text-slate-900 border-b border-slate-100 pb-3">Resumo dos Valores</h3>
              
              <div class="space-y-2 text-sm">
                <div v-for="item in carrinho" :key="item.uid" class="flex justify-between text-slate-700">
                  <span class="font-semibold">{{ item.nome }} ({{ modalidadesAtivas.find((m) => m.id === item.modalidadeId)?.nome }})</span>
                  <span class="font-mono font-bold text-slate-900">R$ {{ calcularPrecoItem(item).toFixed(2) }}</span>
                </div>
              </div>

              <div class="pt-4 border-t border-slate-100 flex justify-between items-center text-lg font-black text-slate-900">
                <span>Valor Total:</span>
                <span class="text-orange-600">R$ {{ Number(valorTotalCalculado).toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <!-- PASSO 4: PAGAMENTO -->
          <div v-if="step === 4" class="space-y-6">
            <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
              <CreditCard class="w-5 h-5 text-orange-500" />
              4. Checkout & Pagamento Único
            </h2>

            <!-- Cupom de Desconto -->
            <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
              <label class="block text-xs font-black uppercase tracking-wider text-slate-700">Cupom de Desconto</label>
              <div class="flex gap-2">
                <input
                  v-model="cupomCodigo"
                  type="text"
                  placeholder="DIGITE SEU CUPOM"
                  class="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs uppercase font-mono text-slate-800 focus:border-orange-500 focus:bg-white focus:outline-none flex-1"
                />
                <button
                  @click="aplicarCupom"
                  :disabled="validandoCupom"
                  class="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition"
                >
                  {{ validandoCupom ? '...' : 'Aplicar' }}
                </button>
              </div>

              <div v-if="cupomAplicadoInfo" class="text-xs text-emerald-600 font-bold">
                Cupom "{{ cupomAplicadoInfo.codigo }}" aplicado! Desconto de {{ cupomAplicadoInfo.percentualDesconto }}%.
              </div>
              <div v-if="erroCupom" class="text-xs text-red-600 font-semibold">
                {{ erroCupom }}
              </div>
            </div>

            <!-- Seleção do Método de Pagamento -->
            <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
              <div class="grid grid-cols-2 gap-3">
                <button
                  @click="metodoPagamentoSelecionado = 'PIX'"
                  class="p-4 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-1.5"
                  :class="metodoPagamentoSelecionado === 'PIX' ? 'bg-orange-50 border-orange-500 text-slate-900 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'"
                >
                  <span class="text-base font-black">PIX</span>
                  <span class="text-[11px] text-slate-500 font-semibold">Aprovação Imediata</span>
                </button>

                <button
                  @click="metodoPagamentoSelecionado = 'CREDITO'"
                  class="p-4 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-1.5"
                  :class="metodoPagamentoSelecionado === 'CREDITO' ? 'bg-orange-50 border-orange-500 text-slate-900 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'"
                >
                  <span class="text-base font-black">Cartão de Crédito</span>
                  <span class="text-[11px] text-slate-500 font-semibold">Parcele em até 12x</span>
                </button>
              </div>

              <!-- Cartão: Payment Brick do Mercado Pago -->
              <div v-if="metodoPagamentoSelecionado === 'CREDITO'" class="border-t border-slate-100 pt-4">
                <div id="brick-cartao" class="min-h-[16rem]"></div>
                <p class="mt-2 text-[11px] text-slate-500">
                  Seus dados de cartão vão criptografados direto para o Mercado Pago — eles
                  não passam pelo SeuPercurso.
                </p>
              </div>

              <!-- Total Final, com a taxa discriminada -->
              <div class="pt-4 border-t border-slate-100 space-y-2">
                <div class="flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>Inscrições</span>
                  <span>R$ {{ Number(valorTotalCalculado).toFixed(2) }}</span>
                </div>

                <div
                  v-if="taxaServico > 0"
                  class="flex justify-between items-center text-xs font-semibold text-slate-500"
                >
                  <span>Taxa de serviço</span>
                  <span>R$ {{ Number(taxaServico).toFixed(2) }}</span>
                </div>

                <div
                  v-if="metodoPagamentoSelecionado === 'PIX' && taxaPix > 0"
                  class="flex justify-between items-center text-xs font-semibold text-slate-500"
                >
                  <span>Taxa de processamento</span>
                  <span>R$ {{ Number(taxaPix).toFixed(2) }}</span>
                </div>

                <div
                  v-else-if="metodoPagamentoSelecionado === 'CREDITO' && taxaCartao > 0"
                  class="flex justify-between items-center text-xs font-semibold text-slate-500"
                >
                  <span>Taxa de processamento</span>
                  <span>R$ {{ Number(taxaCartao).toFixed(2) }}</span>
                </div>

                <div class="flex justify-between items-center text-xl font-black text-slate-900 pt-1">
                  <span>Valor Total a Pagar:</span>
                  <span class="text-orange-600">R$ {{ Number(valorFinalComMetodo).toFixed(2) }}</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Botões de Navegação -->
          <div class="flex items-center justify-between border-t border-slate-200 pt-6">
            <button
              v-if="step > 1"
              @click="voltar"
              class="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition"
            >
              Voltar
            </button>
            <div v-else></div>

            <button
              v-if="step < 4"
              @click="avancar"
              class="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-sm"
            >
              Próximo Passo
            </button>

            <!-- No cartão o botão de pagar é o do próprio Brick. -->
            <button
              v-else-if="metodoPagamentoSelecionado === 'PIX'"
              @click="onInscrever()"
              :disabled="inscrevendo"
              class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {{ inscrevendo ? 'Gerando Inscrições...' : 'Gerar PIX' }}
            </button>

            <span v-else class="text-xs font-semibold text-slate-500">
              {{ inscrevendo ? 'Processando pagamento...' : 'Preencha o cartão acima para finalizar' }}
            </span>
          </div>

        </div>

      </template>

    </div>

    <!-- Modal Adicionar Atleta -->
    <div v-if="modalAdicionarAtletaAberto" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-6 text-slate-800">
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 class="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
            <Users class="w-5 h-5 text-orange-500" />
            Adicionar Atleta
          </h3>
          <button @click="modalAdicionarAtletaAberto = false" class="text-slate-400 hover:text-slate-600 p-1">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
          <button
            @click="tipoNovoAtleta = 'DEPENDENTE'"
            class="flex-1 py-2 rounded-lg transition"
            :class="tipoNovoAtleta === 'DEPENDENTE' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'"
          >
            Escolher Atleta Salvo
          </button>
          <button
            @click="tipoNovoAtleta = 'MANUAL'"
            class="flex-1 py-2 rounded-lg transition"
            :class="tipoNovoAtleta === 'MANUAL' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'"
          >
            Cadastrar Novo para o Evento
          </button>
        </div>

        <!-- Se Escolher Salvo -->
        <div v-if="tipoNovoAtleta === 'DEPENDENTE'" class="space-y-4">
          <div v-if="!dependentes || dependentes.length === 0" class="text-center py-6 text-slate-500 space-y-2">
            <p class="text-sm">Você ainda não possui atletas cadastrados no perfil.</p>
            <NuxtLink to="/perfil/dependentes" target="_blank" class="text-xs font-bold text-orange-600 hover:underline">
              Clique aqui para cadastrar no seu perfil
            </NuxtLink>
          </div>
          <div v-else>
            <label class="block text-xs font-bold text-slate-700 mb-1">Selecione o Atleta:</label>
            <select
              v-model="dependenteSelecionadoId"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
            >
              <option v-for="d in dependentes" :key="d.id" :value="d.id">
                {{ d.nomeCompleto }} (CPF: {{ formatarCpf(d.cpf) }})
              </option>
            </select>
          </div>
        </div>

        <!-- Se Preencher Novo na hora -->
        <div v-else class="space-y-3 text-sm">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
            <input v-model="formManual.nomeCompleto" type="text" placeholder="Ex: Maria Oliveira" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 focus:border-orange-500 focus:bg-white focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">CPF *</label>
              <input :value="formManual.cpf" @input="onInputCpfManual" type="text" inputmode="numeric" placeholder="000.000.000-00" maxlength="14" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 focus:border-orange-500 focus:bg-white focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Data Nasc. *</label>
              <input v-model="formManual.dataNascimento" type="date" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 focus:border-orange-500 focus:bg-white focus:outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Gênero *</label>
              <select v-model="formManual.genero" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 focus:border-orange-500 focus:bg-white focus:outline-none">
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div class="flex items-center pt-5">
              <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input v-model="formManual.pcd" type="checkbox" class="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                Atleta PCD
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button @click="modalAdicionarAtletaAberto = false" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase rounded-xl transition">
            Cancelar
          </button>
          <button @click="confirmarAdicionarAtleta" class="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm transition">
            Adicionar Atleta
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
