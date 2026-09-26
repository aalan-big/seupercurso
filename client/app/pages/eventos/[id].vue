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
  Mail,
  UserPlus,
  LogIn,
  X,
  Camera,
  Eye,
  Landmark,
  IdCard
} from 'lucide-vue-next'
import type { ModeloCamisaEvento } from '../../composables/useEvento'

const route = useRoute()
const eventoId = route.params.id as string

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

const { token, user } = useAuth()
const { eventoSelecionado, fetchEvento } = useEvento()
const { minhasInscricoes, fetchMinhas, criarBatch, uploadDocumentoIdoso, validarServidorPublico, pagarInscricao } = useInscricao()
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

// Nem todo evento entrega camisa: quando nao entrega, o passo 3 vira so o
// resumo e o atleta nunca ve escolha de tamanho.
const eventoPossuiCamisa = computed(() => eventoSelecionado.value?.possuiCamisa !== false)

const passos = computed(() => [
  'Escolha dos Atletas',
  'Modalidades & Categorias',
  eventoPossuiCamisa.value ? 'Camisetas & Resumo' : 'Resumo',
  'Pagamento'
])
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
  incluiCamisa?: boolean
  modeloCamisaId?: string | null
  tamanhoCamisa: string
  // Documento com foto de quem leva o desconto do idoso. Fica o caminho no
  // servidor (sobrevive ao sessionStorage) e o nome so pra mostrar na tela.
  documentoIdosoUrl?: string
  documentoIdosoNome?: string
  documentoIdosoErro?: string
  matriculaServidor?: string
  servidorValidado?: boolean
  servidorValidando?: boolean
  servidorErro?: string
}

// Modal Lightbox de fotos de modelos de camisa
const modalFotoCamisaAberto = ref(false)
const modeloVisualizado = ref<ModeloCamisaEvento | null>(null)
const abaFotoAtiva = ref<'frente' | 'verso'>('frente')

function abrirFotosModelo(modelo: ModeloCamisaEvento) {
  modeloVisualizado.value = modelo
  abaFotoAtiva.value = modelo.fotoFrenteUrl ? 'frente' : (modelo.fotoVersoUrl ? 'verso' : 'frente')
  modalFotoCamisaAberto.value = true
}

function fotoAtualModelo(modelo: ModeloCamisaEvento | null) {
  if (!modelo) return null
  if (modelo.fotoFrenteUrl && modelo.fotoVersoUrl) {
    const caminho = abaFotoAtiva.value === 'frente' ? modelo.fotoFrenteUrl : modelo.fotoVersoUrl
    return urlFoto(caminho, apiBase)
  }
  const caminho = modelo.fotoFrenteUrl || modelo.fotoVersoUrl
  return urlFoto(caminho, apiBase)
}

const carrinho = ref<ItemCarrinho[]>([])

// Modal de adição de atleta
const modalAdicionarAtletaAberto = ref(false)
const erroAdicionarAtleta = ref('')
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

// Mexeu no codigo depois de aplicar: o desconto mostrado deixa de valer ate
// aplicar de novo, senao a tela mostraria o desconto de um cupom e mandaria outro.
watch(cupomCodigo, (novo) => {
  if (
    cupomAplicadoInfo.value &&
    novo.trim().toUpperCase() !== cupomAplicadoInfo.value.codigo.toUpperCase()
  ) {
    cupomAplicadoInfo.value = null
  }
})

function removerCupom() {
  cupomCodigo.value = ''
  cupomAplicadoInfo.value = null
  erroCupom.value = ''
}

const inscrevendo = ref(false)
const erroInscricao = ref('')
const metodoPagamentoSelecionado = ref<'PIX' | 'CREDITO'>('PIX')
const inscricaoCriada = ref<{ id?: string; pedidoId?: string; pagamentoId?: string; valor: string; metodo?: string; pixCopiaECola?: string; pixQrCodeUrl?: string; isencaoServidor?: boolean } | null>(null)

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

function normalizarCamisasNoCarrinho() {
  if (!eventoSelecionado.value) return
  const temOpcional = !!eventoSelecionado.value.camisaOpcional
  const primeiroModeloId = eventoSelecionado.value.modelosCamisa?.[0]?.id || null

  for (const item of carrinho.value) {
    if (item.incluiCamisa === undefined) {
      item.incluiCamisa = temOpcional ? false : true
    }
    if (!item.modeloCamisaId && primeiroModeloId) {
      item.modeloCamisaId = primeiroModeloId
    }
    if (temOpcional && !item.incluiCamisa) {
      // Sem camisa
    } else if (!item.tamanhoCamisa && eventoPossuiCamisa.value) {
      item.tamanhoCamisa = 'M'
    }
  }
}

onMounted(async () => {
  try {
    await fetchEvento(eventoId)
    recuperarEstadoCheckout()
    // O codigo volta da sessao, mas o desconto nao: valida de novo para a tela
    // mostrar o mesmo valor que sera cobrado.
    if (cupomCodigo.value.trim()) {
      aplicarCupom()
    }
    normalizarCamisasNoCarrinho()
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
    sincronizarCarrinhoComCadastro()
    inicializarCarrinhoComTitular()
    normalizarCamisasNoCarrinho()
  }
})

// Perfil editado em outra aba (ou nesta, voltando pelo historico) nao chega
// aqui sozinho: ao voltar o foco pra pagina, rele cadastro e dependentes.
// O watcher abaixo cuida de refletir isso no carrinho.
async function recarregarCadastroAoVoltar() {
  if (!token.value || document.visibilityState !== 'visible') return
  try {
    await fetchClienteMe()
    await fetchDependentes()
  } catch {
    // sem rede ou sessao expirada: mantem o que ja esta na tela
  }
}

onMounted(() => {
  window.addEventListener('focus', recarregarCadastroAoVoltar)
  document.addEventListener('visibilitychange', recarregarCadastroAoVoltar)
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', recarregarCadastroAoVoltar)
  document.removeEventListener('visibilitychange', recarregarCadastroAoVoltar)
})

watch(
  () => [cliente.value?.pf, dependentes.value] as const,
  () => sincronizarCarrinhoComCadastro(),
  { deep: true }
)

// O carrinho restaurado do sessionStorage guarda uma copia dos dados de
// quando foi montado. Se a pessoa editou o perfil ou o dependente nesse
// meio tempo (data de nascimento, nome, PCD), a tela mostrava o valor
// antigo — e o preco e o pedido de documento seguiam junto. O servidor
// sempre usa o cadastro atual; aqui a tela passa a fazer o mesmo.
function sincronizarCarrinhoComCadastro() {
  const pf = cliente.value?.pf
  carrinho.value = carrinho.value.map((item) => {
    if (item.tipo === 'EU' && pf) {
      return {
        ...item,
        nome: pf.nomeCompleto,
        cpf: pf.cpf,
        dataNascimento: pf.dataNascimento ? pf.dataNascimento.split('T')[0] : '',
        genero: pf.genero as any,
        pcd: pf.pcd || false
      }
    }
    if (item.tipo === 'DEPENDENTE' && item.dependenteId) {
      const dep = dependentes.value.find((d) => d.id === item.dependenteId)
      if (!dep) return item
      return {
        ...item,
        nome: dep.nomeCompleto,
        cpf: dep.cpf,
        dataNascimento: dep.dataNascimento ? dep.dataNascimento.split('T')[0] : '',
        genero: dep.genero as any,
        pcd: dep.pcd || false
      }
    }
    return item
  })
}

function inicializarCarrinhoComTitular() {
  if (carrinho.value.length === 0 && cliente.value?.pf) {
    if (titularJaInscrito.value) {
      // Se o titular já estiver inscrito no evento, não adiciona ele automaticamente no carrinho
      return
    }
    const pf = cliente.value.pf
    const temCamisaOpcional = !!eventoSelecionado.value?.camisaOpcional
    const primeiroModeloId = eventoSelecionado.value?.modelosCamisa?.[0]?.id || null
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
      incluiCamisa: temCamisaOpcional ? false : true,
      modeloCamisaId: primeiroModeloId,
      tamanhoCamisa: temCamisaOpcional ? '' : 'M'
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
  erroAdicionarAtleta.value = ''
  modalAdicionarAtletaAberto.value = true
}

function confirmarAdicionarAtleta() {
  erroInscricao.value = ''
  erroAdicionarAtleta.value = ''
  const temCamisaOpcional = !!eventoSelecionado.value?.camisaOpcional
  const primeiroModeloId = eventoSelecionado.value?.modelosCamisa?.[0]?.id || null

  if (tipoNovoAtleta.value === 'DEPENDENTE') {
    if (!dependenteSelecionadoId.value) {
      erroAdicionarAtleta.value = 'Selecione um dependente.'
      return
    }
    const dep = dependentes.value.find((d) => d.id === dependenteSelecionadoId.value)
    if (!dep) return

    const depCpf = (dep.cpf || '').replace(/\D/g, '')
    if (depCpf && carrinho.value.some((item) => (item.cpf || '').replace(/\D/g, '') === depCpf)) {
      erroAdicionarAtleta.value = `O atleta ${dep.nomeCompleto} já está no seu carrinho de inscrições.`
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
      incluiCamisa: temCamisaOpcional ? false : true,
      modeloCamisaId: primeiroModeloId,
      tamanhoCamisa: temCamisaOpcional ? '' : 'M'
    })
  } else {
    if (!formManual.nomeCompleto.trim() || !formManual.cpf.trim() || !formManual.dataNascimento) {
      erroAdicionarAtleta.value = 'Preencha os campos obrigatórios do atleta (Nome, CPF e Data de Nascimento).'
      return
    }
    const cpfLimpo = formManual.cpf.replace(/\D/g, '')
    if (!cpfEhValido(cpfLimpo)) {
      erroAdicionarAtleta.value = 'CPF inválido. Confira os números digitados.'
      return
    }
    if (carrinho.value.some((item) => (item.cpf || '').replace(/\D/g, '') === cpfLimpo)) {
      erroAdicionarAtleta.value = 'Este CPF já está no seu carrinho de inscrições.'
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
      incluiCamisa: temCamisaOpcional ? false : true,
      modeloCamisaId: primeiroModeloId,
      tamanhoCamisa: temCamisaOpcional ? '' : 'M'
    })
  }
  modalAdicionarAtletaAberto.value = false
}

function removerAtleta(uid: string) {
  carrinho.value = carrinho.value.filter((item) => item.uid !== uid)
}

// O desconto do idoso e aplicado pela data que a propria pessoa digitou, entao
// quem se qualifica precisa comprovar com documento — o servidor recusa sem ele.
function temDescontoIdoso(item: ItemCarrinho) {
  const ev = eventoSelecionado.value
  if (!ev?.aplicaDescontoIdoso || !ev.percentualDescontoIdoso) return false
  if (isencaoServidorAtiva(item)) return false
  return calcularIdade(item.dataNascimento, ev.dataInicio) >= 60
}

async function comprimirImagemSeNecessario(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith('image/') || arquivo.type === 'image/svg+xml') {
    return arquivo
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const maxDim = 1920
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(arquivo)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(arquivo)
              return
            }
            const compFile = new File([blob], arquivo.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compFile)
          },
          'image/jpeg',
          0.82
        )
      }
      img.onerror = () => resolve(arquivo)
      img.src = event.target?.result as string
    }
    reader.onerror = () => resolve(arquivo)
    reader.readAsDataURL(arquivo)
  })
}

const enviandoDocumentoIdoso = ref<string | null>(null)

async function onDocumentoIdosoSelecionado(item: ItemCarrinho, e: Event) {
  const input = e.target as HTMLInputElement
  const arquivoOriginal = input.files?.[0]
  if (!arquivoOriginal) return
  item.documentoIdosoErro = ''
  enviandoDocumentoIdoso.value = item.uid
  try {
    const arquivo = await comprimirImagemSeNecessario(arquivoOriginal)
    const url = await uploadDocumentoIdoso(arquivo)
    item.documentoIdosoUrl = url
    item.documentoIdosoNome = arquivoOriginal.name
  } catch (err: any) {
    // Aparece junto dos botoes de envio daquele atleta, onde a pessoa esta
    // olhando; o alert() do navegador travava a tela no celular.
    item.documentoIdosoErro = `Falha ao enviar documento: ${extrairErro(err)}`
  } finally {
    enviandoDocumentoIdoso.value = null
    input.value = ''
  }
}

function atletasSemDocumentoIdoso() {
  return carrinho.value.filter((i) => temDescontoIdoso(i) && !i.documentoIdosoUrl)
}

function rolarParaErro() {
  if (import.meta.client) {
    nextTick(() => {
      const alerta = document.getElementById('alerta-documento-idoso-checkout') || document.querySelector('.bg-red-50')
      if (alerta) {
        alerta.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        window.scrollTo({ top: 120, behavior: 'smooth' })
      }
    })
  }
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

function itemIsServidorPublico(item: ItemCarrinho) {
  if (!item.modalidadeId || !item.categoriaId) return false
  const mod = modalidadesAtivas.value.find((m) => m.id === item.modalidadeId)
  const cat = mod?.categorias?.find((c) => c.id === item.categoriaId)
  return !!cat?.servidorPublico
}

// O servidor da lista disputa qualquer categoria de graca; a matricula e
// obrigatoria so na categoria marcada como Servidor Publico.
function isencaoServidorAtiva(item: ItemCarrinho) {
  return !!eventoSelecionado.value?.permiteServidorPublico && !!item.categoriaId && !!item.servidorValidado
}

async function validarMatriculaServidor(item: ItemCarrinho) {
  item.servidorErro = ''
  if (!item.matriculaServidor || !item.matriculaServidor.trim()) {
    item.servidorErro = 'Digite o número da sua matrícula de servidor público.'
    return
  }
  // O servidor exige login para validar; o carrinho sobrevive ao login.
  if (!token.value) {
    item.servidorErro = 'Entre na sua conta para validar a matrícula. Os atletas do carrinho continuam salvos.'
    return
  }
  item.servidorValidando = true
  try {
    const res = await validarServidorPublico(eventoId, item.cpf, item.matriculaServidor.trim())
    if (res.valido) {
      item.servidorValidado = true
      item.servidorErro = ''
    }
  } catch (err: any) {
    item.servidorValidado = false
    item.servidorErro = extrairErro(err)
  } finally {
    item.servidorValidando = false
  }
}

// A matricula validada vale para o CPF no evento inteiro, em qualquer
// categoria: trocar de categoria nao obriga a validar de novo.
const todosSaoServidoresIsentos = computed(
  () => carrinho.value.length > 0 && carrinho.value.every((i) => isencaoServidorAtiva(i))
)

function selecionarCategoriaItem(item: ItemCarrinho, categoriaId: string) {
  item.categoriaId = categoriaId
}

function calcularPrecoItem(item: ItemCarrinho) {
  if (!item.modalidadeId) return 0
  if (isencaoServidorAtiva(item)) return 0
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

  // Se o evento possui camisa opcional e o atleta optou por incluir camisa
  if (eventoSelecionado.value?.camisaOpcional && item.incluiCamisa && eventoSelecionado.value.valorCamisaOpcional) {
    valor += Number(eventoSelecionado.value.valorCamisaOpcional)
  }

  // A comissao nao entra aqui: quando o organizador a repassa, ela vem do
  // servidor como "Taxa de servico" e aparece discriminada no checkout. O 0.10
  // fixo que existia aqui ainda errava para organizador com comissao diferente.
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
    return carrinho.value.every((i) => {
      if (!i.modalidadeId || !i.categoriaId) return false
      if (itemIsServidorPublico(i) && !i.servidorValidado) return false
      if (eventoPossuiCamisa.value && (!eventoSelecionado.value?.camisaOpcional || i.incluiCamisa) && !i.tamanhoCamisa) return false
      return true
    })
  }
  if (step.value === 3) {
    return !eventoPossuiCamisa.value || carrinho.value.every((i) => {
      if (eventoSelecionado.value?.camisaOpcional && !i.incluiCamisa) return true
      return !!i.tamanhoCamisa
    })
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
    rolarParaErro()
    return
  }

  if (step.value === 1) {
    // Na Etapa 1, apenas confirma se há atletas no carrinho
    if (carrinho.value.length === 0) {
      erroInscricao.value = 'Adicione ao menos um participante no carrinho para avançar.'
      rolarParaErro()
      return
    }
    // Se o evento não possui servidor público liberado, valida documento imediatamente
    if (!eventoSelecionado.value?.permiteServidorPublico) {
      const semDocumento = atletasSemDocumentoIdoso()
      if (semDocumento.length > 0) {
        const nomes = semDocumento.map((i) => i.nome).join(', ')
        erroInscricao.value = `Envie um documento com foto (RG ou CNH) para comprovar a idade de: ${nomes}.`
        rolarParaErro()
        return
      }
    }
  }

  if (step.value === 2) {
    // Na Etapa 2, valida a escolha da modalidade e categoria para cada participante
    const pendentes = carrinho.value.filter((i) => !i.modalidadeId || !i.categoriaId)
    if (pendentes.length > 0) {
      const nomes = pendentes.map((i) => i.nome).join(', ')
      erroInscricao.value = `Selecione o percurso (modalidade) e a categoria para: ${nomes}.`
      rolarParaErro()
      return
    }

    const servidoresNaoValidados = carrinho.value.filter((i) => itemIsServidorPublico(i) && !i.servidorValidado)
    if (servidoresNaoValidados.length > 0) {
      const nomes = servidoresNaoValidados.map((i) => i.nome).join(', ')
      erroInscricao.value = `Valide a matrícula de servidor público para: ${nomes}.`
      rolarParaErro()
      return
    }

    if (eventoPossuiCamisa.value) {
      const pendentesCamisa = carrinho.value.filter((i) => (!eventoSelecionado.value?.camisaOpcional || i.incluiCamisa) && !i.tamanhoCamisa)
      if (pendentesCamisa.length > 0) {
        const nomes = pendentesCamisa.map((i) => i.nome).join(', ')
        erroInscricao.value = `Selecione o tamanho da camiseta para: ${nomes}.`
        rolarParaErro()
        return
      }
    }

    // Agora que as categorias foram selecionadas, quem não for servidor público precisa do documento do idoso
    const semDocumento = atletasSemDocumentoIdoso()
    if (semDocumento.length > 0) {
      const nomes = semDocumento.map((i) => i.nome).join(', ')
      erroInscricao.value = `Envie um documento com foto (RG ou CNH) para comprovar o desconto de idoso de: ${nomes}.`
      rolarParaErro()
      return
    }
  }

  if (step.value === 3 && eventoPossuiCamisa.value) {
    // Na Etapa 3, valida o tamanho das camisetas
    const faltamCamisetas = carrinho.value.filter((i) => (!eventoSelecionado.value?.camisaOpcional || i.incluiCamisa) && !i.tamanhoCamisa)
    if (faltamCamisetas.length > 0) {
      const nomes = faltamCamisetas.map((i) => i.nome).join(', ')
      erroInscricao.value = `Selecione o tamanho da camiseta para: ${nomes}.`
      rolarParaErro()
      return
    }
  }

  if (step.value < passos.value.length) {
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

// O botao anunciava "ate 12x" fixo no HTML. Com o teto configuravel — e ainda
// cortado pelo valor minimo de parcela — o texto prometia o que o formulario
// nao ia oferecer.
const rotuloParcelamento = computed(() => {
  const n = tarifas.value?.parcelamento?.length ?? 0
  return n > 1 ? `Parcele em até ${n}x` : 'Aprovação na hora'
})

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
      container: 'brick-cartao',
      valor,
      eventoId,
      email: cliente.value?.usuario?.email,
      // A lista `parcelamento` ja vem cortada pelo valor minimo de parcela;
      // `maxParcelas` e o teto cru e ignorava isso, deixando o Brick oferecer
      // 12x de centavos numa inscricao barata.
      maxParcelas: tarifas.value?.parcelamento?.length ?? 1,
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
    rolarParaErro()
    return
  }

  if (carrinho.value.some((i) => !i.categoriaId || !i.modalidadeId)) {
    erroInscricao.value = 'Selecione a modalidade e a categoria para todos os atletas do carrinho.'
    rolarParaErro()
    return
  }

  // Cupom digitado sem "Aplicar" ia para a compra do mesmo jeito: com codigo
  // errado a compra inteira falhava, e com codigo certo a tela mostrava o preco
  // cheio mas cobrava com desconto. Agora so vai o cupom validado.
  if (cupomCodigo.value.trim() && !cupomAplicadoInfo.value) {
    erroInscricao.value = 'Você digitou um cupom mas não aplicou. Clique em "Aplicar" no campo do cupom (ou apague o código) antes de pagar.'
    rolarParaErro()
    return
  }

  const semDocumento = atletasSemDocumentoIdoso()
  if (semDocumento.length > 0) {
    erroInscricao.value = `Envie um documento com foto (RG ou CNH) para comprovar a idade de: ${semDocumento.map((i) => i.nome).join(', ')}.`
    rolarParaErro()
    return
  }

  inscrevendo.value = true
  try {
    const itemsPayload = carrinho.value.map((item) => {
      const comCamisa = eventoPossuiCamisa.value && (!eventoSelecionado.value?.camisaOpcional || item.incluiCamisa)
      return {
        categoriaId: item.categoriaId!,
        loteId: loteAtivo.value!.id,
        tamanhoCamisa: comCamisa ? item.tamanhoCamisa : undefined,
        incluiCamisa: eventoSelecionado.value?.camisaOpcional ? !!item.incluiCamisa : undefined,
        modeloCamisaId: comCamisa ? (item.modeloCamisaId || undefined) : undefined,
        cupomCodigo: cupomAplicadoInfo.value?.codigo || undefined,
        dependenteId: item.dependenteId,
        matriculaServidor: isencaoServidorAtiva(item) ? item.matriculaServidor?.trim() : undefined,
        documentoIdosoUrl: item.documentoIdosoUrl || undefined,
        atleta: item.tipo === 'MANUAL'
          ? {
              nomeCompleto: item.nome,
              cpf: item.cpf,
              dataNascimento: item.dataNascimento,
              genero: item.genero,
              pcd: item.pcd
            }
          : undefined
      }
    })

    const batchRes = await criarBatch(itemsPayload)

    // Pedido de R$ 0 ja volta confirmado: servidores isentos, cupom de 100%...
    if (batchRes.valorTotal === 0 || batchRes.status === 'CONFIRMADA') {
      inscricaoCriada.value = {
        pedidoId: batchRes.pedidoId,
        valor: '0.00',
        metodo: 'GRATUITO',
        isencaoServidor: todosSaoServidoresIsentos.value
      }
      limparEstadoCheckout()
      return
    }

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
    rolarParaErro()
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

          <!-- Inscricao gratuita (servidores isentos, cupom de 100%...) -->
          <div v-if="inscricaoCriada.metodo === 'GRATUITO'" class="p-5 sm:p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-black uppercase tracking-wider">
              <Landmark v-if="inscricaoCriada.isencaoServidor" class="w-3.5 h-3.5" />
              {{ inscricaoCriada.isencaoServidor ? 'Isenção Concedida · Servidor Público' : 'Inscrição Gratuita' }}
            </span>
            <p class="text-2xl sm:text-3xl font-black text-emerald-600">R$ 0,00 (100% Gratuito)</p>
            <p class="text-xs sm:text-sm font-semibold text-emerald-900">
              Sua inscrição foi confirmada com sucesso! Os comprovantes foram enviados para o seu e-mail cadastrado.
            </p>
          </div>

          <!-- PIX QR Code / Copia e Cola Responsivo -->
          <div v-else-if="inscricaoCriada.metodo === 'PIX'" class="p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
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
            <div v-if="inscricaoCriada.pixCopiaECola" class="space-y-2 text-left max-w-md mx-auto">
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

            <div v-else-if="!inscricaoCriada.pixQrCodeUrl" class="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl">
              Gerando dados do PIX... Caso demore, acesse suas inscrições para efetuar o pagamento.
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
          <div class="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm">
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

            <!-- Stepper: linha propria, abaixo do titulo, para o nome do evento
                 nao espremer os rotulos. Em telas estreitas rola na horizontal. -->
            <div class="flex items-center gap-3 sm:gap-4 overflow-x-auto bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200">
              <div v-for="(p, index) in passos" :key="index" class="flex items-center gap-3 sm:gap-4 shrink-0">
                <div class="flex items-center gap-2">
                  <div
                    class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition"
                    :class="step === index + 1 ? 'bg-orange-500 text-white shadow-sm' : step > index + 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'"
                  >
                    {{ index + 1 }}
                  </div>
                  <span class="text-xs font-bold whitespace-nowrap hidden sm:inline" :class="step === index + 1 ? 'text-slate-900' : 'text-slate-400'">{{ p }}</span>
                </div>
                <span v-if="index < passos.length - 1" class="w-6 sm:w-8 h-0.5 bg-slate-300 shrink-0"></span>
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

            <!--
              Quem chega por link compartilhado normalmente nao tem conta, e ate
              agora so descobria isso ao tentar pagar, no fim do checkout. O
              carrinho sobrevive ao login (fica em sessionStorage por evento),
              entao o aviso vem cedo sem obrigar a interromper o que estava
              fazendo.
            -->
            <div
              v-if="!token"
              class="bg-white border border-orange-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4"
            >
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 shrink-0 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center">
                  <UserPlus class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="text-base font-extrabold text-slate-900">
                    Entre na sua conta para concluir a inscrição
                  </h3>
                  <p class="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Você pode montar a inscrição agora e entrar depois — os atletas que
                    adicionar continuam aqui quando voltar.
                  </p>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3">
                <NuxtLink
                  :to="`/login?redirect=/eventos/${eventoId}`"
                  class="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm"
                >
                  <LogIn class="w-4 h-4" />
                  <span>Já tenho conta</span>
                </NuxtLink>
                <NuxtLink
                  :to="`/cadastro?redirect=/eventos/${eventoId}`"
                  class="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider rounded-xl transition"
                >
                  <UserPlus class="w-4 h-4" />
                  <span>Criar conta</span>
                </NuxtLink>
              </div>
            </div>

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

                  <!-- Desconto do idoso: exige documento com foto -->
                  <div
                    v-if="temDescontoIdoso(item)"
                    class="rounded-xl border p-3 space-y-2"
                    :class="item.documentoIdosoUrl ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'"
                  >
                    <p class="text-[11px] font-bold" :class="item.documentoIdosoUrl ? 'text-emerald-900' : 'text-amber-900'">
                      Desconto do idoso ({{ eventoSelecionado?.percentualDescontoIdoso }}%) — envie um documento com foto (RG ou CNH) pra comprovar a idade.
                      <span v-if="eventoSelecionado?.permiteServidorPublico" class="block font-normal mt-0.5 text-slate-600">
                        (Não obrigatório se o atleta for servidor público da lista oficial: a inscrição dele sai de graça).
                      </span>
                      <span v-else class="block font-normal mt-0.5">
                        Ele será conferido na retirada do kit.
                      </span>
                    </p>
                    <DocumentoIdosoUpload
                      :enviando="enviandoDocumentoIdoso === item.uid"
                      :enviado="!!item.documentoIdosoUrl"
                      :nome-arquivo="item.documentoIdosoNome"
                      :erro="item.documentoIdosoErro"
                      @selecionar="onDocumentoIdosoSelecionado(item, $event)"
                    />
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
                      @click="!motivoInelegibilidadeParaAtleta(cat, item) && selecionarCategoriaItem(item, cat.id)"
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
                        <div class="flex items-center gap-2">
                          <p class="text-sm font-semibold">{{ cat.nome }}</p>
                          <span
                            v-if="cat.servidorPublico"
                            class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200"
                          >
                            <Landmark class="inline w-3 h-3 -mt-0.5" /> Servidor Público
                          </span>
                        </div>
                        <p v-if="motivoInelegibilidadeParaAtleta(cat, item)" class="text-xs text-rose-500 mt-0.5">
                          {{ motivoInelegibilidadeParaAtleta(cat, item) }}
                        </p>
                      </div>
                      <Check v-if="item.categoriaId === cat.id" class="w-4 h-4 text-orange-500" />
                    </div>
                  </div>

                  <!--
                    Validacao de servidor publico. Obrigatoria na categoria marcada
                    como Servidor Publico; nas demais e opcional, porque o servidor
                    da lista disputa qualquer categoria de graca.
                  -->
                  <div
                    v-if="eventoSelecionado?.permiteServidorPublico && item.categoriaId"
                    class="rounded-xl border p-4 space-y-3 transition mt-3"
                    :class="item.servidorValidado ? 'bg-emerald-50 border-emerald-300' : 'bg-blue-50 border-blue-200'"
                  >
                    <div class="flex items-start gap-3">
                      <Landmark class="w-6 h-6 shrink-0" :class="item.servidorValidado ? 'text-emerald-600' : 'text-blue-600'" />
                      <div class="flex-1 space-y-2">
                        <div>
                          <h4 class="text-xs font-black uppercase tracking-wider" :class="item.servidorValidado ? 'text-emerald-900' : 'text-blue-900'">
                            {{ itemIsServidorPublico(item) ? 'Categoria Servidor Público · 100% Gratuita' : 'É servidor público? Inscrição 100% gratuita' }}
                          </h4>
                          <p class="text-xs text-slate-600 mt-0.5">
                            Digite a matrícula funcional de <strong>{{ item.nome.split(' ')[0] }}</strong> (CPF {{ formatarCpf(item.cpf) }}) para validar na lista oficial e liberar a gratuidade.
                            <span v-if="!itemIsServidorPublico(item)">Se não for servidor, deixe em branco.</span>
                          </p>
                        </div>

                        <div v-if="!item.servidorValidado" class="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            v-model="item.matriculaServidor"
                            type="text"
                            placeholder="Número da matrícula..."
                            class="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
                            @keydown.enter.prevent="validarMatriculaServidor(item)"
                          />
                          <button
                            type="button"
                            @click="validarMatriculaServidor(item)"
                            :disabled="item.servidorValidando"
                            class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                          >
                            <span v-if="item.servidorValidando" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>{{ item.servidorValidando ? 'Validando...' : 'Validar Matrícula' }}</span>
                          </button>
                        </div>

                        <div v-else class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <div class="flex items-center gap-2 text-xs font-bold text-emerald-800">
                            <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Matrícula {{ item.matriculaServidor }} confirmada ✓</span>
                          </div>
                          <button
                            type="button"
                            @click="item.servidorValidado = false"
                            class="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline text-left"
                          >
                            Alterar Matrícula
                          </button>
                        </div>

                        <div v-if="item.servidorErro" class="p-2.5 bg-red-100/70 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                          <AlertTriangle class="w-4 h-4 shrink-0 text-red-600" />
                          <span>{{ item.servidorErro }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Desconto do idoso na Etapa 2 para quem não é servidor público -->
                  <div
                    v-if="temDescontoIdoso(item) && !itemIsServidorPublico(item)"
                    class="rounded-xl border p-4 space-y-2 transition mt-3"
                    :class="item.documentoIdosoUrl ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'"
                  >
                    <div class="flex items-start gap-2.5">
                      <IdCard class="w-5 h-5 shrink-0" :class="item.documentoIdosoUrl ? 'text-emerald-600' : 'text-amber-600'" />
                      <div class="flex-1 space-y-1.5">
                        <p class="text-xs font-black uppercase tracking-wider" :class="item.documentoIdosoUrl ? 'text-emerald-900' : 'text-amber-900'">
                          Desconto 60+ (Idoso) · {{ eventoSelecionado?.percentualDescontoIdoso }}% OFF
                        </p>
                        <p class="text-xs" :class="item.documentoIdosoUrl ? 'text-emerald-800' : 'text-amber-800'">
                          Para validar o desconto por idade de <strong>{{ item.nome.split(' ')[0] }}</strong>, anexe uma foto do documento oficial (RG ou CNH).
                        </p>

                        <DocumentoIdosoUpload
                          class="pt-1"
                          :enviando="enviandoDocumentoIdoso === item.uid"
                          :enviado="!!item.documentoIdosoUrl"
                          :nome-arquivo="item.documentoIdosoNome"
                          :erro="item.documentoIdosoErro"
                          @selecionar="onDocumentoIdosoSelecionado(item, $event)"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- SEÇÃO DE CAMISETA / MODELO / TAMANHO -->
                <div v-if="eventoPossuiCamisa" class="space-y-4 pt-4 border-t border-slate-200">
                  <!-- Caso 1: Camisa Opcional (Escolha entre Sem Camisa vs Com Camisa Oficial) -->
                  <div v-if="eventoSelecionado?.camisaOpcional" class="space-y-2">
                    <label class="block text-xs font-black uppercase tracking-wider text-slate-700">
                      Opção de Camiseta para {{ item.nome.split(' ')[0] }}:
                    </label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <!-- Opção Sem Camisa -->
                      <div
                        @click="item.incluiCamisa = false; item.tamanhoCamisa = ''"
                        class="p-4 rounded-xl border transition cursor-pointer flex items-center justify-between"
                        :class="!item.incluiCamisa ? 'bg-orange-50 border-orange-500 text-slate-900 font-extrabold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'"
                      >
                        <div class="flex items-center gap-3">
                          <div
                            class="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition"
                            :class="!item.incluiCamisa ? 'bg-orange-100 text-orange-600' : 'bg-slate-200/70 text-slate-500'"
                          >
                            <Ticket class="w-5 h-5" />
                          </div>
                          <div>
                            <p class="text-sm font-bold">Sem Camiseta</p>
                            <p class="text-xs text-slate-500 font-normal">Apenas inscrição no evento</p>
                          </div>
                        </div>
                        <Check v-if="!item.incluiCamisa" class="w-5 h-5 text-orange-500 shrink-0" />
                      </div>

                      <!-- Opção Com Camisa -->
                      <div
                        @click="item.incluiCamisa = true; if (!item.tamanhoCamisa) item.tamanhoCamisa = 'M'; if (!item.modeloCamisaId && eventoSelecionado?.modelosCamisa?.length) item.modeloCamisaId = eventoSelecionado.modelosCamisa[0].id"
                        class="p-4 rounded-xl border transition cursor-pointer flex items-center justify-between"
                        :class="item.incluiCamisa ? 'bg-orange-50 border-orange-500 text-slate-900 font-extrabold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'"
                      >
                        <div class="flex items-center gap-3">
                          <div
                            class="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition"
                            :class="item.incluiCamisa ? 'bg-orange-100 text-orange-600' : 'bg-slate-200/70 text-slate-500'"
                          >
                            <Shirt class="w-5 h-5" />
                          </div>
                          <div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <p class="text-sm font-bold">Com Camiseta Oficial</p>
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                + {{ formatarPreco(Number(eventoSelecionado?.valorCamisaOpcional || 0)) }}
                              </span>
                            </div>
                            <p class="text-xs text-slate-500 font-normal">Camiseta oficial inclusa no kit</p>
                          </div>
                        </div>
                        <Check v-if="item.incluiCamisa" class="w-5 h-5 text-orange-500 shrink-0" />
                      </div>
                    </div>
                  </div>

                  <!-- Configuração da Camiseta (Quando o evento tem camisa obrigatória ou quando optou por incluir camisa) -->
                  <div v-if="!eventoSelecionado?.camisaOpcional || item.incluiCamisa" class="space-y-4 pt-1">
                    <!-- Escolha do Modelo (quando houver mais de 1 modelo cadastrado) -->
                    <div v-if="eventoSelecionado?.modelosCamisa && eventoSelecionado.modelosCamisa.length > 1" class="space-y-2">
                      <label class="block text-xs font-black uppercase tracking-wider text-slate-700">
                        Modelo da Camiseta:
                      </label>
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div
                          v-for="modCamisa in eventoSelecionado.modelosCamisa"
                          :key="modCamisa.id"
                          @click="item.modeloCamisaId = modCamisa.id"
                          class="p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-2.5"
                          :class="item.modeloCamisaId === modCamisa.id ? 'bg-orange-50 border-orange-500 text-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'"
                        >
                          <div class="flex items-start gap-3">
                            <!-- Miniatura da Foto -->
                            <div
                              v-if="modCamisa.fotoFrenteUrl || modCamisa.fotoVersoUrl"
                              class="w-14 h-14 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5"
                            >
                              <img
                                :src="urlFoto(modCamisa.fotoFrenteUrl || modCamisa.fotoVersoUrl, apiBase)!"
                                :alt="modCamisa.nome"
                                class="w-full h-full object-contain"
                              />
                            </div>
                            <div
                              v-else
                              class="w-14 h-14 rounded-lg bg-orange-100/50 border border-orange-200 text-orange-600 shrink-0 flex items-center justify-center"
                            >
                              <Shirt class="w-6 h-6" />
                            </div>

                            <div class="min-w-0 flex-1">
                              <div class="flex items-center justify-between gap-1">
                                <p class="text-xs font-extrabold text-slate-900 leading-tight truncate">{{ modCamisa.nome }}</p>
                                <Check v-if="item.modeloCamisaId === modCamisa.id" class="w-4 h-4 text-orange-500 shrink-0" />
                              </div>
                              <p v-if="modCamisa.descricao" class="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                                {{ modCamisa.descricao }}
                              </p>
                            </div>
                          </div>

                          <!-- Botão Ver Fotos -->
                          <button
                            v-if="modCamisa.fotoFrenteUrl || modCamisa.fotoVersoUrl"
                            type="button"
                            @click.stop="abrirFotosModelo(modCamisa)"
                            class="w-full py-1 px-2 rounded-lg bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1.5 transition"
                          >
                            <Eye class="w-3.5 h-3.5 text-orange-500" />
                            <span>{{ (modCamisa.fotoFrenteUrl && modCamisa.fotoVersoUrl) ? 'Ver Fotos (Frente e Verso)' : 'Ver Foto da Camisa' }}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Modelo Único com Fotos -->
                    <div
                      v-else-if="eventoSelecionado?.modelosCamisa && eventoSelecionado.modelosCamisa.length === 1"
                      class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          v-if="eventoSelecionado.modelosCamisa[0].fotoFrenteUrl || eventoSelecionado.modelosCamisa[0].fotoVersoUrl"
                          class="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5 cursor-pointer"
                          @click="abrirFotosModelo(eventoSelecionado.modelosCamisa[0])"
                        >
                          <img
                            :src="urlFoto(eventoSelecionado.modelosCamisa[0].fotoFrenteUrl || eventoSelecionado.modelosCamisa[0].fotoVersoUrl, apiBase)!"
                            :alt="eventoSelecionado.modelosCamisa[0].nome"
                            class="w-full h-full object-contain"
                          />
                        </div>
                        <div class="min-w-0">
                          <p class="text-xs font-bold text-slate-800">
                            Modelo: {{ eventoSelecionado.modelosCamisa[0].nome }}
                          </p>
                          <p v-if="eventoSelecionado.modelosCamisa[0].descricao" class="text-[11px] text-slate-500 truncate">
                            {{ eventoSelecionado.modelosCamisa[0].descricao }}
                          </p>
                        </div>
                      </div>

                      <button
                        v-if="eventoSelecionado.modelosCamisa[0].fotoFrenteUrl || eventoSelecionado.modelosCamisa[0].fotoVersoUrl"
                        type="button"
                        @click="abrirFotosModelo(eventoSelecionado.modelosCamisa[0])"
                        class="py-1.5 px-3 rounded-lg bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition shrink-0"
                      >
                        <Eye class="w-3.5 h-3.5 text-orange-500" />
                        <span>{{ (eventoSelecionado.modelosCamisa[0].fotoFrenteUrl && eventoSelecionado.modelosCamisa[0].fotoVersoUrl) ? 'Ver Fotos (Frente e Verso)' : 'Ver Foto' }}</span>
                      </button>
                    </div>

                    <!-- Seleção do Tamanho -->
                    <div class="space-y-2">
                      <label class="block text-xs font-black uppercase tracking-wider text-slate-700">
                        Tamanho da Camiseta:
                      </label>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="tam in tamanhos"
                          :key="tam"
                          type="button"
                          @click="item.tamanhoCamisa = tam"
                          class="w-11 h-11 rounded-xl border text-xs font-extrabold transition flex items-center justify-center shadow-2xs"
                          :class="item.tamanhoCamisa === tam ? 'bg-orange-500 border-orange-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'"
                        >
                          {{ tam }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- PASSO 3: CAMISETAS & RESUMO -->
          <div v-if="step === 3" class="space-y-6">
            <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
              <Shirt v-if="eventoPossuiCamisa" class="w-5 h-5 text-orange-500" />
              <FileText v-else class="w-5 h-5 text-orange-500" />
              {{ eventoPossuiCamisa ? '3. Tamanho das Camisetas & Resumo' : '3. Resumo da Inscrição' }}
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
                  <p v-if="eventoSelecionado?.camisaOpcional && !item.incluiCamisa" class="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                    <Ticket class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Sem camiseta oficial (apenas inscrição)</span>
                  </p>
                  <p v-else-if="eventoPossuiCamisa && item.modeloCamisaId" class="text-xs text-slate-600 font-semibold mt-1 flex items-center gap-1.5">
                    <Shirt class="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span>Modelo: {{ eventoSelecionado?.modelosCamisa?.find(m => m.id === item.modeloCamisaId)?.nome || 'Padrão' }}</span>
                  </p>
                </div>

                <div v-if="eventoPossuiCamisa && (!eventoSelecionado?.camisaOpcional || item.incluiCamisa)" class="flex items-center gap-2">
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
                <div v-for="item in carrinho" :key="item.uid" class="flex justify-between items-center text-slate-700">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold">{{ item.nome }} ({{ modalidadesAtivas.find((m) => m.id === item.modalidadeId)?.nome }})</span>
                    <span
                      v-if="isencaoServidorAtiva(item)"
                      class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200"
                    >
                      <Landmark class="inline w-3 h-3 -mt-0.5" /> Servidor Público
                    </span>
                    <span
                      v-else-if="eventoSelecionado?.camisaOpcional && item.incluiCamisa"
                      class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200"
                    >
                      + Camiseta Oficial (+ {{ formatarPreco(Number(eventoSelecionado?.valorCamisaOpcional || 0)) }})
                    </span>
                    <span
                      v-else-if="eventoSelecionado?.camisaOpcional && !item.incluiCamisa"
                      class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600"
                    >
                      Sem camiseta
                    </span>
                  </div>
                  <span class="font-mono font-bold" :class="calcularPrecoItem(item) === 0 ? 'text-emerald-600' : 'text-slate-900'">
                    {{ calcularPrecoItem(item) === 0 ? 'GRÁTIS' : `R$ ${calcularPrecoItem(item).toFixed(2)}` }}
                  </span>
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
              4. Checkout & Confirmação
            </h2>

            <!--
              A compra nao exige mais e-mail confirmado. Em troca, o e-mail de
              destino aparece aqui: um erro de digitacao e pego antes de pagar,
              e o voucher fica de qualquer jeito em "Meus Eventos".
            -->
            <div
              v-if="user?.email"
              class="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex items-start gap-3 min-w-0">
                <Mail class="w-5 h-5 shrink-0 text-orange-500 mt-0.5" />
                <div class="min-w-0">
                  <p class="text-xs text-slate-500">Os comprovantes e vouchers serão enviados para:</p>
                  <p class="text-sm font-bold text-slate-900 break-all">{{ user.email }}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Eles também ficam sempre disponíveis em "Meus Eventos".</p>
                </div>
              </div>
              <NuxtLink
                to="/perfil#email"
                class="shrink-0 self-start rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition sm:self-center"
              >
                E-mail errado? Corrigir
              </NuxtLink>
            </div>

            <!-- Caso 100% Gratuito (servidores isentos, cupom de 100%...) -->
            <div v-if="valorTotalCalculado === 0" class="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-4">
              <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <CheckCircle class="w-8 h-8" />
              </div>
              <div class="space-y-2">
                <span
                  v-if="todosSaoServidoresIsentos"
                  class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-black uppercase tracking-wider"
                >
                  <Landmark class="w-3.5 h-3.5" /> Isenção Integral · Servidor Público
                </span>
                <h3 class="text-xl sm:text-2xl font-black text-slate-900">Inscrição 100% Gratuita</h3>
                <p class="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
                  <template v-if="todosSaoServidoresIsentos">A matrícula e o CPF de todos os atletas foram confirmados na lista de servidores públicos autorizados.</template>
                  O valor total da sua inscrição é <strong>R$ 0,00</strong>.
                </p>
              </div>

              <div class="pt-4 border-t border-slate-100 flex justify-between items-center text-xl font-black text-slate-900 max-w-md mx-auto">
                <span>Total a Pagar:</span>
                <span class="text-emerald-600">R$ 0,00</span>
              </div>
            </div>

            <!-- Caso Pagamento Normal (PIX / Cartão) -->
            <template v-else>
              <!-- Comprovação de Desconto de Idoso (60+) no Checkout se houver pendência -->
              <div
                v-if="atletasSemDocumentoIdoso().length > 0"
                id="alerta-documento-idoso-checkout"
                class="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3 shadow-sm"
              >
                <div class="flex items-start gap-3">
                  <IdCard class="w-6 h-6 shrink-0 text-amber-600" />
                  <div class="flex-1 space-y-1">
                    <h4 class="text-xs font-black uppercase tracking-wider text-amber-900">
                      Comprovante de Idade (Desconto 60+) Obrigatório
                    </h4>
                    <p class="text-xs text-amber-800">
                      Para confirmar o desconto de {{ eventoSelecionado?.percentualDescontoIdoso }}% para atletas 60+, anexe um documento oficial com foto (RG ou CNH) antes de concluir o pagamento.
                    </p>
                  </div>
                </div>

                <div class="space-y-3 pt-1">
                  <div
                    v-for="item in atletasSemDocumentoIdoso()"
                    :key="item.uid"
                    class="p-3 bg-white rounded-xl border border-amber-200 space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-900">
                        {{ item.nome }} · {{ calcularIdade(item.dataNascimento, eventoSelecionado?.dataInicio || '') }} anos
                      </span>
                      <span v-if="item.documentoIdosoUrl" class="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle class="w-4 h-4" /> Comprovante Enviado
                      </span>
                      <span v-else class="text-xs font-bold text-amber-600">
                        Pendente de Comprovante
                      </span>
                    </div>

                    <DocumentoIdosoUpload
                      class="pt-1"
                      :enviando="enviandoDocumentoIdoso === item.uid"
                      :enviado="!!item.documentoIdosoUrl"
                      :nome-arquivo="item.documentoIdosoNome"
                      :erro="item.documentoIdosoErro"
                      @selecionar="onDocumentoIdosoSelecionado(item, $event)"
                    />
                  </div>
                </div>
              </div>

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
                    <span class="text-[11px] text-slate-500 font-semibold">{{ rotuloParcelamento }}</span>
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
            </template>

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

            <!-- Se for 100% gratuito (Servidor Público) -->
            <button
              v-else-if="valorTotalCalculado === 0"
              @click="onInscrever()"
              :disabled="inscrevendo"
              class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {{ inscrevendo ? 'Confirmando Inscrições...' : 'Concluir Inscrição Gratuita' }}
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

        <p
          v-if="erroAdicionarAtleta"
          class="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700"
        >
          <AlertTriangle class="w-4 h-4 shrink-0 text-red-600" />
          <span>{{ erroAdicionarAtleta }}</span>
        </p>

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

    <!-- MODAL LIGHTBOX FOTOS DA CAMISA (FRENTE E VERSO) -->
    <Teleport to="body">
      <div
        v-if="modalFotoCamisaAberto && modeloVisualizado"
        class="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-4"
        @keydown.window.escape="modalFotoCamisaAberto = false"
      >
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs" @click="modalFotoCamisaAberto = false"></div>

        <div class="relative flex w-full max-w-2xl max-h-[92vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl z-[401]">
          <!-- Topo do Modal -->
          <div class="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 bg-white">
            <div class="flex items-center gap-3 min-w-0">
              <div class="h-10 w-10 shrink-0 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Shirt class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <h3 class="font-black text-base text-slate-900 truncate">{{ modeloVisualizado.nome }}</h3>
                <p v-if="modeloVisualizado.descricao" class="text-xs text-slate-500 truncate">
                  {{ modeloVisualizado.descricao }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              @click="modalFotoCamisaAberto = false"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Abas Frente / Verso (Exibidas apenas se o organizador enviou as DUAS fotos) -->
          <div
            v-if="modeloVisualizado.fotoFrenteUrl && modeloVisualizado.fotoVersoUrl"
            class="flex items-center justify-center gap-2 border-b border-slate-100 bg-slate-50/70 p-2.5"
          >
            <button
              type="button"
              @click="abaFotoAtiva = 'frente'"
              class="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
              :class="abaFotoAtiva === 'frente' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
            >
              <Camera class="w-3.5 h-3.5" />
              <span>Foto da Frente</span>
            </button>

            <button
              type="button"
              @click="abaFotoAtiva = 'verso'"
              class="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
              :class="abaFotoAtiva === 'verso' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
            >
              <Camera class="w-3.5 h-3.5" />
              <span>Foto do Verso</span>
            </button>
          </div>

          <!-- Área da Imagem -->
          <div class="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-900/5 min-h-[300px]">
            <div v-if="fotoAtualModelo(modeloVisualizado)" class="relative max-h-[60vh] flex items-center justify-center">
              <img
                :src="fotoAtualModelo(modeloVisualizado)!"
                :alt="`${modeloVisualizado.nome} - ${abaFotoAtiva === 'frente' ? 'Frente' : 'Verso'}`"
                class="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-lg border border-slate-200 bg-white"
              />
            </div>
            <div v-else class="text-center py-12 text-slate-400">
              <Shirt class="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p class="text-sm font-semibold">Nenhuma foto disponível para esta visualização.</p>
            </div>
          </div>

          <!-- Rodapé -->
          <div class="border-t border-slate-100 p-4 bg-white flex justify-end">
            <button
              type="button"
              @click="modalFotoCamisaAberto = false"
              class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
