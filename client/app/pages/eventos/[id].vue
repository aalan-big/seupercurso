<script setup lang="ts">
const route = useRoute()
const eventoId = route.params.id as string

const { token } = useAuth()
const { eventoSelecionado, fetchEvento } = useEvento()
const { criar, pagarInscricao } = useInscricao()
const { cliente, fetchMe: fetchClienteMe } = useCliente()

const carregando = ref(true)
const erro = ref('')

const passos = ['Percurso & Categoria', 'Camiseta & Kit', 'Revisão & Pagamento']
const step = ref(1)

const modalidadeSelecionadaId = ref<string | null>(null)
const categoriaSelecionadaId = ref<string | null>(null)
const tamanhoCamisa = ref('')
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
    const config = useRuntimeConfig()
    const apiBase = config.public.apiBase as string
    const res = await $fetch<{ valido: boolean; codigo: string; percentualDesconto: number }>(
      `${apiBase}/eventos/${eventoId}/validar-cupom?codigo=${encodeURIComponent(cod)}`
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

const valorBaseModalidade = computed(() => {
  if (!modalidadeSelecionadaId.value) return 0
  return precoPara(modalidadeSelecionadaId.value) ?? 0
})

const valorDescontoCalculado = computed(() => {
  if (!cupomAplicadoInfo.value || valorBaseModalidade.value <= 0) return 0
  return valorBaseModalidade.value * (cupomAplicadoInfo.value.percentualDesconto / 100)
})

const taxaConvenienciaCalculada = computed(() => {
  if (!eventoSelecionado.value?.taxaRepassadaAtleta || valorBaseModalidade.value <= 0) return 0
  return valorBaseModalidade.value * 0.10
})

const valorTotalCalculado = computed(() => {
  const base = valorBaseModalidade.value
  const desconto = valorDescontoCalculado.value
  const taxa = taxaConvenienciaCalculada.value
  return Math.max(0, base - desconto + taxa)
})

const inscrevendo = ref(false)
const erroInscricao = ref('')
const metodoPagamentoSelecionado = ref<'PIX' | 'CREDITO'>('PIX')
const inscricaoCriada = ref<{ id: string; valor: string; metodo?: string; pixCopiaECola?: string; pixQrCodeUrl?: string } | null>(null)

const tamanhos = ['PP', 'P', 'M', 'G', 'GG', 'XGG']

onMounted(async () => {
  try {
    await fetchEvento(eventoId)
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
    } catch {
      // perfil de atleta ainda não completado
    }
  }
})

function calcularIdade(nascimentoIso: string, referenciaIso: string) {
  const nascimento = new Date(nascimentoIso)
  const referencia = new Date(referenciaIso)
  let idade = referencia.getUTCFullYear() - nascimento.getUTCFullYear()
  const aniversarioEsteAno = Date.UTC(referencia.getUTCFullYear(), nascimento.getUTCMonth(), nascimento.getUTCDate())
  if (referencia.getTime() < aniversarioEsteAno) idade -= 1
  return idade
}

function motivoInelegibilidade(categoria: { idadeMinima: number | null; idadeMaxima: number | null; genero: string; pcd: boolean }) {
  const pf = cliente.value?.pf
  if (!pf || !eventoSelecionado.value) return null

  if (categoria.idadeMinima !== null || categoria.idadeMaxima !== null) {
    const idade = calcularIdade(pf.dataNascimento, eventoSelecionado.value.dataInicio)
    if (categoria.idadeMinima !== null && idade < categoria.idadeMinima) {
      return `Idade mínima: ${categoria.idadeMinima} anos`
    }
    if (categoria.idadeMaxima !== null && idade > categoria.idadeMaxima) {
      return `Idade máxima: ${categoria.idadeMaxima} anos`
    }
  }

  if (categoria.genero !== 'LIVRE' && categoria.genero !== pf.genero) {
    return 'Não corresponde ao seu gênero cadastrado'
  }

  if (categoria.pcd && !pf.pcd) {
    return 'Categoria exclusiva PCD'
  }

  return null
}

function selecionarCategoria(categoria: { id: string; idadeMinima: number | null; idadeMaxima: number | null; genero: string; pcd: boolean }) {
  if (motivoInelegibilidade(categoria)) return
  categoriaSelecionadaId.value = categoria.id
}

const modalidadesAtivas = computed(
  () => eventoSelecionado.value?.modalidades.filter((m) => m.ativo) || []
)

const loteAtivo = computed(() => {
  const agora = new Date()
  return (
    eventoSelecionado.value?.lotes.find(
      (l) =>
        new Date(l.inicioVenda) <= agora &&
        agora <= new Date(l.fimVenda) &&
        (l.vagasRestantes === null || l.vagasRestantes > 0)
    ) || null
  )
})

const modalidadeSelecionada = computed(
  () => modalidadesAtivas.value.find((m) => m.id === modalidadeSelecionadaId.value) || null
)

const categoriaSelecionada = computed(
  () => modalidadeSelecionada.value?.categorias.find((c) => c.id === categoriaSelecionadaId.value) || null
)

const diasRestantesLote = computed(() => {
  if (!loteAtivo.value) return null
  const ms = new Date(loteAtivo.value.fimVenda).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
})

const vagasBadgeClasse = computed(() => {
  const lote = loteAtivo.value
  if (!lote || lote.vagasRestantes === null || !lote.quantidade) return 'text-slate-500'
  return lote.vagasRestantes / lote.quantidade < 0.2 ? 'font-semibold text-red-600' : 'text-slate-500'
})

const podeAvancar = computed(() => {
  if (step.value === 1) return !!modalidadeSelecionadaId.value && !!categoriaSelecionadaId.value && !!loteAtivo.value
  if (step.value === 2) return !!tamanhoCamisa.value
  return true
})

function precoPara(modalidadeId: string) {
  const preco = loteAtivo.value?.precos.find((p) => p.modalidadeId === modalidadeId)
  return preco ? Number(preco.valor) : null
}

function formatarPreco(valor: number | null) {
  return valor === null ? 'Sem preço definido' : `R$ ${valor.toFixed(2)}`
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const generoLabel: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  LIVRE: 'Livre'
}

function faixaEtariaModalidade(min: number | null, max: number | null) {
  if (!min && !max) return null
  if (min && max) return `${min} a ${max} anos`
  if (min) return `A partir de ${min} anos`
  return `Até ${max} anos`
}

function selecionarModalidade(id: string) {
  modalidadeSelecionadaId.value = id
  erroInscricao.value = ''
  
  const mod = modalidadesAtivas.value.find((m) => m.id === id)
  if (mod && mod.categorias && mod.categorias.length > 0) {
    // Auto-seleciona a primeira categoria se houver 1 única ou se for a categoria Geral elegível
    const elegivel = mod.categorias.find((c) => !motivoInelegibilidade(c))
    if (elegivel) {
      categoriaSelecionadaId.value = elegivel.id
    } else {
      categoriaSelecionadaId.value = null
    }
  } else {
    categoriaSelecionadaId.value = null
  }
}

function avancar() {
  if (!podeAvancar.value) return
  erroInscricao.value = ''
  if (step.value < passos.length) step.value += 1
}

function voltar() {
  erroInscricao.value = ''
  if (step.value > 1) step.value -= 1
}

const usarDadosContaTitular = ref(true)

const cartaoForm = reactive({
  holderName: '',
  cpfTitular: '',
  numero: '',
  mesValidade: '12',
  anoValidade: '2028',
  ccv: '',
  cep: '',
  numeroResidencia: '',
  parcelas: 1
})

watch([usarDadosContaTitular, cliente], () => {
  if (usarDadosContaTitular.value && cliente.value) {
    cartaoForm.holderName = (cliente.value.pf?.nome || cliente.value.nome || '').toUpperCase()
    cartaoForm.cpfTitular = cliente.value.pf?.cpf || cliente.value.cpfCnpj || ''
    cartaoForm.cep = cliente.value.endereco?.cep || ''
    cartaoForm.numeroResidencia = cliente.value.endereco?.numero || ''
  }
}, { immediate: true })

function formatarNumeroCartao(val: string) {
  const apenasNumeros = val.replace(/\D/g, '').slice(0, 16)
  return apenasNumeros.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function onInputNumeroCartao(e: Event) {
  const target = e.target as HTMLInputElement
  cartaoForm.numero = formatarNumeroCartao(target.value)
}

function formatarCpf(val: string) {
  const nums = val.replace(/\D/g, '').slice(0, 11)
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function onInputCpfTitular(e: Event) {
  const target = e.target as HTMLInputElement
  cartaoForm.cpfTitular = formatarCpf(target.value)
}

function formatarCep(val: string) {
  const nums = val.replace(/\D/g, '').slice(0, 8)
  return nums.replace(/(\d{5})(\d)/, '$1-$2')
}

function onInputCep(e: Event) {
  const target = e.target as HTMLInputElement
  cartaoForm.cep = formatarCep(target.value)
}

const opcoesParcelamentoCalculadas = computed(() => {
  const base = valorTotalCalculado.value
  if (!base) return []

  const lista = []
  const maxParcelas = Math.min(12, Math.max(1, Math.floor(base / 15))) || 1

  for (let n = 1; n <= maxParcelas; n++) {
    const percentualJurosAsaas = n * 0.0299
    const taxaFixaCartao = 0.49
    const totalComJuros = (base + taxaFixaCartao) * (1 + percentualJurosAsaas)
    const valorParcela = totalComJuros / n

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

const opcaoCartaoSelecionada = computed(() => {
  if (metodoPagamentoSelecionado.value !== 'CREDITO') return null
  return opcoesParcelamentoCalculadas.value.find((o) => o.num === Number(cartaoForm.parcelas)) || opcoesParcelamentoCalculadas.value[0] || null
})

const jurosCartaoCalculados = computed(() => {
  if (!opcaoCartaoSelecionada.value) return 0
  return Math.max(0, opcaoCartaoSelecionada.value.total - valorTotalCalculado.value)
})

const valorFinalComMetodo = computed(() => {
  if (metodoPagamentoSelecionado.value === 'CREDITO' && opcaoCartaoSelecionada.value) {
    return opcaoCartaoSelecionada.value.total
  }
  return valorTotalCalculado.value
})

async function onInscrever() {
  erroInscricao.value = ''

  if (!token.value) {
    await navigateTo(`/login?redirect=/eventos/${eventoId}`)
    return
  }

  if (!categoriaSelecionadaId.value || !loteAtivo.value) {
    erroInscricao.value = 'Selecione a modalidade e a categoria.'
    return
  }

  let cartaoPayload = undefined
  if (metodoPagamentoSelecionado.value === 'CREDITO') {
    if (!cartaoForm.numero || !cartaoForm.holderName || !cartaoForm.ccv) {
      erroInscricao.value = 'Preencha todos os dados do cartão de crédito.'
      return
    }
    cartaoPayload = {
      holderName: cartaoForm.holderName,
      numero: cartaoForm.numero,
      mesValidade: cartaoForm.mesValidade,
      anoValidade: cartaoForm.anoValidade,
      ccv: cartaoForm.ccv,
      parcelas: Number(cartaoForm.parcelas),
      cpfTitular: cartaoForm.cpfTitular,
      cep: cartaoForm.cep,
      numeroResidencia: cartaoForm.numeroResidencia,
    }
  }

  inscrevendo.value = true
  try {
    const res = await criar({
      categoriaId: categoriaSelecionadaId.value,
      loteId: loteAtivo.value.id,
      tamanhoCamisa: tamanhoCamisa.value || undefined,
      cupomCodigo: cupomCodigo.value || undefined
    })

    // Gera cobrança no método selecionado (PIX ou Cartão)
    const pagamentoRes = await pagarInscricao(res.id, metodoPagamentoSelecionado.value, cartaoPayload)

    const valorFinalReal = (pagamentoRes as any)?.valor || valorFinalComMetodo.value || res.valor

    inscricaoCriada.value = {
      id: res.id,
      valor: valorFinalReal,
      metodo: metodoPagamentoSelecionado.value,
      pixCopiaECola: (pagamentoRes as any)?.pixCopiaECola,
      pixQrCodeUrl: (pagamentoRes as any)?.pixQrCodeUrl,
      parcelas: cartaoForm.parcelas,
      valorBase: valorBaseModalidade.value,
      valorDesconto: valorDescontoCalculado.value,
      cupomCodigo: cupomAplicadoInfo.value?.codigo,
      jurosCartao: jurosCartaoCalculados.value,
      parcelaTexto: cartaoForm.parcelas > 1 ? `${cartaoForm.parcelas}x de R$ ${(Number(valorFinalReal) / cartaoForm.parcelas).toFixed(2)}` : null
    }
  } catch (e) {
    const msg = extrairErro(e)
    if (msg.includes('Complete seu perfil')) {
      await navigateTo(`/cadastro?redirect=/eventos/${eventoId}`)
      return
    }
    erroInscricao.value = msg
  } finally {
    inscrevendo.value = false
  }
}
const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

const bannerUrlFormatted = computed(() => {
  return urlFoto(eventoSelecionado.value?.bannerUrl, apiBase)
})
</script>

<template>
  <div>
    <p v-if="carregando" class="mx-auto max-w-3xl px-4 py-16 text-sm text-slate-500">Carregando...</p>

    <p
      v-else-if="erro"
      class="mx-auto mt-8 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ erro }}
    </p>

    <template v-else-if="eventoSelecionado">
      <section class="relative overflow-hidden bg-slate-950 py-16 text-white min-h-[220px] flex items-center">
        <div
          v-if="bannerUrlFormatted"
          class="absolute inset-0 bg-cover bg-center opacity-40 scale-105 transition duration-700"
          :style="{ backgroundImage: `url('${bannerUrlFormatted}')` }"
        ></div>
        <div v-else class="absolute inset-0 bg-gradient-to-br from-primary via-slate-900 to-secondary opacity-90"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>

        <div class="relative z-10 mx-auto max-w-5xl px-4 w-full">
          <span class="inline-block rounded-full bg-warning/20 border border-warning/40 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-warning backdrop-blur-md mb-3">
            🏁 Evento Esportivo Oficial
          </span>
          <h1 class="text-3xl font-black uppercase tracking-tight sm:text-5xl drop-shadow-md text-white">{{ eventoSelecionado.nome }}</h1>
          <div class="mt-3 flex flex-wrap items-center gap-4 text-xs sm:text-sm font-bold text-slate-200">
            <span class="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-xs border border-white/10">
              📍 {{ eventoSelecionado.local }}, {{ eventoSelecionado.cidade }}/{{ eventoSelecionado.estado }}
            </span>
            <span class="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-xs border border-white/10">
              📅 {{ formatarData(eventoSelecionado.dataInicio) }}
            </span>
          </div>
        </div>
      </section>


      <div class="mx-auto max-w-5xl px-4 py-10">
        <p v-if="eventoSelecionado.descricao" class="text-slate-700">{{ eventoSelecionado.descricao }}</p>

        <!-- Tela de Sucesso de Inscrição -->
        <div v-if="inscricaoCriada" class="mt-8">
          <!-- CASO 1: PAGAMENTO VIA CARTÃO DE CRÉDITO (APROVADO) -->
          <div v-if="inscricaoCriada.metodo === 'CREDITO'" class="rounded-3xl border border-emerald-200 bg-white p-6 sm:p-8 space-y-6 shadow-md">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
                  🎉 Inscrição Confirmada & Paga!
                </h2>
                <p class="text-xs text-slate-500 mt-1">Seu pagamento via Cartão de Crédito foi aprovado com sucesso. Sua vaga está garantida!</p>
              </div>
              <span class="rounded-full bg-emerald-100 border border-emerald-300 px-3.5 py-1 text-xs font-black text-emerald-900 flex items-center gap-1.5 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                <span>Pagamento Confirmado</span>
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <!-- Banner de Confirmação -->
              <div class="flex flex-col items-center justify-center bg-emerald-50/70 p-6 rounded-2xl border border-emerald-200/80 text-center space-y-3">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p class="text-base font-black text-emerald-950">Vaga Garantida na Prova!</p>
                  <p class="text-xs text-emerald-800 mt-1 max-w-xs">
                    Você já pode visualizar as orientações de retirada de kit, percurso e comprovante no seu painel.
                  </p>
                </div>
              </div>

              <!-- Detalhes e Resumo Bonitinho do Pagamento -->
              <div class="space-y-4">
                <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 shadow-2xs">
                  <div class="flex justify-between items-center text-xs border-b border-slate-200/80 pb-2">
                    <span class="text-slate-500 font-bold uppercase text-[10px]">Atleta</span>
                    <span class="font-extrabold text-slate-800">
                      {{ cliente?.pf?.nomeCompleto || cliente?.nome || user?.email || 'Atleta' }}
                    </span>
                  </div>

                  <div v-if="modalidadeSelecionada" class="flex justify-between items-center text-xs border-b border-slate-200/80 pb-2">
                    <span class="text-slate-500 font-bold uppercase text-[10px]">Prova / Categoria</span>
                    <span class="font-extrabold text-slate-800 text-right">
                      {{ modalidadeSelecionada.nome }} <template v-if="categoriaSelecionada">({{ categoriaSelecionada.nome }})</template>
                    </span>
                  </div>

                  <div v-if="tamanhoCamisa" class="flex justify-between items-center text-xs border-b border-slate-200/80 pb-2">
                    <span class="text-slate-500 font-bold uppercase text-[10px]">Camiseta</span>
                    <span class="font-bold text-slate-700">Tamanho {{ tamanhoCamisa }}</span>
                  </div>

                  <div class="flex justify-between items-center text-xs border-b border-slate-200/80 pb-2">
                    <span class="text-slate-500 font-bold uppercase text-[10px]">Método</span>
                    <span class="font-extrabold text-slate-800 flex items-center gap-1">
                      💳 Cartão de Crédito
                    </span>
                  </div>

                  <!-- Detalhamento Financeiro do Resumo -->
                  <div class="space-y-1.5 pt-1 text-xs text-slate-600">
                    <div class="flex justify-between">
                      <span>Valor da Inscrição:</span>
                      <span class="font-semibold text-slate-800">R$ {{ Number(inscricaoCriada.valorBase || 0).toFixed(2) }}</span>
                    </div>

                    <div v-if="inscricaoCriada.valorDesconto > 0" class="flex justify-between text-emerald-700 font-semibold">
                      <span>Cupom de Desconto ({{ inscricaoCriada.cupomCodigo }}):</span>
                      <span>- R$ {{ Number(inscricaoCriada.valorDesconto).toFixed(2) }}</span>
                    </div>

                    <div v-if="taxaConvenienciaCalculada > 0" class="flex justify-between text-slate-600">
                      <span>Taxa de Plataforma (10%):</span>
                      <span>+ R$ {{ Number(taxaConvenienciaCalculada).toFixed(2) }}</span>
                    </div>

                    <div v-if="inscricaoCriada.jurosCartao > 0" class="flex justify-between text-amber-700 font-semibold">
                      <span>Juros do Cartão ({{ inscricaoCriada.parcelas }}x):</span>
                      <span>+ R$ {{ Number(inscricaoCriada.jurosCartao).toFixed(2) }}</span>
                    </div>
                  </div>

                  <!-- Total Final Pago -->
                  <div class="pt-2 border-t border-slate-200">
                    <div class="flex justify-between items-baseline">
                      <div>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-wider">Valor Total Pago</p>
                        <p v-if="inscricaoCriada.parcelaTexto" class="text-[11px] font-bold text-amber-800">
                          ({{ inscricaoCriada.parcelaTexto }})
                        </p>
                      </div>
                      <p class="text-2xl font-black text-emerald-600">R$ {{ Number(inscricaoCriada.valor).toFixed(2) }}</p>
                    </div>
                  </div>
                </div>

                <div class="pt-1 flex flex-wrap gap-3">
                  <NuxtLink
                    to="/meus-eventos"
                    class="flex-1 text-center rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                  >
                    📄 Ver Meus Eventos
                  </NuxtLink>
                  <NuxtLink
                    to="/"
                    class="rounded-xl border border-slate-300 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    🏠 Início
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>

          <!-- CASO 2: PAGAMENTO VIA PIX (AGUARDANDO PAGAMENTO) -->
          <div v-else class="rounded-3xl border border-amber-200 bg-white p-6 sm:p-8 space-y-6 shadow-md">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 class="text-xl font-black text-slate-900">🎉 Inscrição Realizada com Sucesso!</h2>
                <p class="text-xs text-slate-500 mt-1">Efetue o pagamento via PIX abaixo para confirmar sua vaga instantaneamente.</p>
              </div>
              <span class="rounded-full bg-amber-100 border border-amber-300 px-3.5 py-1 text-xs font-black text-amber-950">
                ⏳ PIX Aguardando Pagamento
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <!-- QR Code do PIX -->
              <div class="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                <img
                  v-if="inscricaoCriada.pixQrCodeUrl"
                  :src="inscricaoCriada.pixQrCodeUrl"
                  alt="QR Code PIX Asaas"
                  class="w-48 h-48 rounded-xl bg-white p-1"
                />
                <div v-else class="w-48 h-48 flex items-center justify-center bg-slate-100 rounded-xl text-xs text-slate-400 font-bold">
                  Gerando QR Code...
                </div>
                <p class="text-[11px] font-semibold text-slate-500 mt-2">Abra o app do seu banco e escaneie o código acima.</p>
              </div>

              <!-- Dados e Copia e Cola -->
              <div class="space-y-4">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <p class="text-[10px] text-slate-400 font-black uppercase tracking-wider">Valor Total da Inscrição</p>
                  <p class="text-2xl font-black text-emerald-600">R$ {{ Number(inscricaoCriada.valor).toFixed(2) }}</p>
                </div>

                <div v-if="inscricaoCriada.pixCopiaECola" class="space-y-2">
                  <label class="block text-xs font-bold uppercase tracking-wider text-slate-600">Código PIX Copia e Cola</label>
                  <div class="flex gap-2">
                    <input
                      type="text"
                      readonly
                      :value="inscricaoCriada.pixCopiaECola"
                      class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-700 truncate"
                    />
                    <button
                      type="button"
                      class="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 shadow hover:bg-amber-400 transition shrink-0"
                      @click="copiarPixCode(inscricaoCriada.pixCopiaECola)"
                    >
                      {{ pixCopiado ? '✅ Copiado!' : '📋 Copiar PIX' }}
                    </button>
                  </div>
                </div>

                <div class="pt-2 flex flex-wrap gap-3">
                  <NuxtLink
                    to="/meus-eventos"
                    class="rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                  >
                    📄 Ir para Meus Eventos
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>

        <template v-else>
          <div class="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div class="min-w-0 md:col-span-2">
              <!-- Indicador de passos -->
              <div class="mb-8 flex items-center gap-2">
                <template v-for="(label, i) in passos" :key="label">
                  <div
                    class="flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wide"
                    :class="step >= i + 1 ? 'text-primary' : 'text-slate-400'"
                  >
                    <span
                      class="flex h-6 w-6 items-center justify-center rounded-full"
                      :class="step >= i + 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'"
                    >
                      {{ i + 1 }}
                    </span>
                    <span class="hidden sm:inline">{{ label }}</span>
                  </div>
                  <div v-if="i < passos.length - 1" class="h-0.5 flex-1" :class="step >= i + 2 ? 'bg-primary' : 'bg-slate-200'"></div>
                </template>
              </div>

              <!-- Passo 1: Percurso & Categoria -->
              <section v-if="step === 1" class="space-y-6">
                <div>
                  <h2 class="text-xl font-black uppercase tracking-tight text-slate-900">Escolha seu Percurso & Categoria</h2>
                  <p v-if="!loteAtivo" class="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
                    ⚠️ As inscrições para este evento não estão abertas no momento.
                  </p>
                  <p v-else class="mt-1 text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <template v-if="loteAtivo.vagasRestantes !== null">🎟️ {{ loteAtivo.vagasRestantes }} vagas disponíveis · </template>
                    Lote encerra em {{ diasRestantesLote }} {{ diasRestantesLote === 1 ? 'dia' : 'dias' }}
                  </p>
                </div>

                <div v-if="modalidadesAtivas.length === 0" class="text-xs font-medium text-slate-400 py-6 text-center">
                  Nenhuma modalidade disponível para este evento.
                </div>

                <!-- Percursos disponíveis -->
                <div>
                  <label class="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">1. Selecione a Distância / Prova</label>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      v-for="modalidade in modalidadesAtivas"
                      :key="modalidade.id"
                      type="button"
                      class="group relative overflow-hidden rounded-3xl border-2 p-5 text-left transition-all duration-300 flex flex-col justify-between"
                      :class="
                        modalidadeSelecionadaId === modalidade.id
                          ? 'border-warning bg-amber-50/50 shadow-md ring-2 ring-warning/30'
                          : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                      "
                      @click="selecionarModalidade(modalidade.id)"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <div class="flex items-center gap-1.5 flex-wrap mb-2">
                            <span class="inline-block rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-warning">
                              🏃 {{ Number(modalidade.distanciaKm) }} km
                            </span>
                            <span
                              v-if="faixaEtariaModalidade(modalidade.idadeMinima, modalidade.idadeMaxima)"
                              class="inline-block rounded-lg bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-amber-900"
                            >
                              🎂 {{ faixaEtariaModalidade(modalidade.idadeMinima, modalidade.idadeMaxima) }}
                            </span>
                          </div>
                          <h3 class="text-base font-black text-slate-900 group-hover:text-primary transition line-clamp-1">
                            {{ modalidade.nome }}
                          </h3>
                        </div>
                        <div
                          class="h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition"
                          :class="modalidadeSelecionadaId === modalidade.id ? 'border-warning bg-warning text-primary' : 'border-slate-300'"
                        >
                          <AppIcon v-if="modalidadeSelecionadaId === modalidade.id" name="check" size="14" />
                        </div>
                      </div>

                      <p v-if="modalidade.descricao" class="mt-2 text-xs text-slate-500 line-clamp-2">
                        {{ modalidade.descricao }}
                      </p>

                      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Valor individual</span>
                        <span class="text-base font-black text-emerald-600">
                          {{ formatarPreco(precoPara(modalidade.id)) }}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                <!-- Sub-categorias da modalidade selecionada (exibidas somente se houver mais de 1 categoria) -->
                <div v-if="modalidadeSelecionada && modalidadeSelecionada.categorias && modalidadeSelecionada.categorias.length > 1" class="pt-4 border-t border-slate-200">
                  <label class="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">2. Selecione a sua Categoria / Faixa Etária</label>
                  <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      v-for="categoria in modalidadeSelecionada.categorias"
                      :key="categoria.id"
                      type="button"
                      class="rounded-2xl border-2 p-4 text-left text-xs transition flex items-center justify-between gap-3"
                      :disabled="!!motivoInelegibilidade(categoria)"
                      :class="
                        motivoInelegibilidade(categoria)
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-50'
                          : categoriaSelecionadaId === categoria.id
                            ? 'border-warning bg-amber-50/50 text-slate-900 font-extrabold ring-2 ring-warning/30'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      "
                      @click="selecionarCategoria(categoria)"
                    >
                      <div>
                        <span class="font-extrabold text-sm text-slate-900 block">
                          {{ categoria.nome === 'Geral' ? 'Geral (Faixa Etária Aberta - Todas as Idades)' : categoria.nome }}
                        </span>
                        <span class="text-slate-500 font-medium text-[11px] block mt-0.5">
                          {{ generoLabel[categoria.genero] }}
                          <template v-if="categoria.idadeMinima || categoria.idadeMaxima">
                            · {{ categoria.idadeMinima || '0' }}-{{ categoria.idadeMaxima || '+' }} anos
                          </template>
                          <template v-if="categoria.pcd"> · PCD</template>
                        </span>
                        <p v-if="motivoInelegibilidade(categoria)" class="mt-1 text-[11px] font-bold text-red-500">
                          ⚠️ {{ motivoInelegibilidade(categoria) }}
                        </p>
                      </div>
                      <div
                        class="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0"
                        :class="categoriaSelecionadaId === categoria.id ? 'border-warning bg-warning text-primary' : 'border-slate-300'"
                      >
                        <AppIcon v-if="categoriaSelecionadaId === categoria.id" name="check" size="12" />
                      </div>
                    </button>
                  </div>
                </div>
              </section>

              <!-- Passo 2: Camiseta & Kit -->
              <section v-else-if="step === 2" class="space-y-6">
                <div>
                  <h2 class="text-xl font-black uppercase tracking-tight text-slate-900">Camiseta & Kit do Atleta</h2>
                  <p class="mt-1 text-xs text-slate-500">Escolha o tamanho da sua camiseta oficial da prova.</p>
                </div>

                <div class="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
                  <label class="block text-xs font-bold text-slate-700 uppercase">Tamanho da Camiseta</label>
                  <div class="flex flex-wrap gap-2.5">
                    <button
                      v-for="tam in tamanhos"
                      :key="tam"
                      type="button"
                      class="rounded-xl border-2 px-5 py-2.5 text-xs font-black transition"
                      :class="
                        tamanhoCamisa === tam
                          ? 'border-warning bg-amber-50 text-amber-950 ring-2 ring-warning/30'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      "
                      @click="tamanhoCamisa = tamanhoCamisa === tam ? '' : tam"
                    >
                      👕 {{ tam }}
                    </button>
                  </div>
                </div>
              </section>

              <!-- Passo 3: Revisão & Pagamento -->
              <section v-else-if="step === 3" class="space-y-6">
                <div>
                  <h2 class="text-xl font-black uppercase tracking-tight text-slate-900">Forma de Pagamento</h2>
                  <p class="mt-1 text-xs text-slate-500">Escolha como deseja pagar a sua inscrição e confirme o pedido.</p>
                </div>

                <!-- Seleção de Forma de Pagamento -->
                <div class="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                  <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-400">Forma de Pagamento</h3>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      v-if="eventoSelecionado.aceitaPix !== false"
                      type="button"
                      class="flex items-center gap-3 rounded-2xl border p-4 text-left transition"
                      :class="metodoPagamentoSelecionado === 'PIX' ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/30' : 'border-slate-200 bg-white hover:border-slate-300'"
                      @click="metodoPagamentoSelecionado = 'PIX'"
                    >
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect width="5" height="5" x="3" y="3" rx="1"/>
                          <rect width="5" height="5" x="16" y="3" rx="1"/>
                          <rect width="5" height="5" x="3" y="16" rx="1"/>
                          <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                          <path d="M21 21v.01"/>
                          <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                          <path d="M3 12h.01"/>
                          <path d="M12 3h.01"/>
                          <path d="M12 16v.01"/>
                          <path d="M16 12h1"/>
                          <path d="M21 12v.01"/>
                          <path d="M12 21v-1"/>
                        </svg>
                      </div>
                      <div>
                        <p class="font-extrabold text-sm text-slate-900">PIX Instantâneo</p>
                        <p class="text-[11px] text-slate-500">QR Code e Copia e Cola imediato</p>
                      </div>
                    </button>

                    <button
                      v-if="eventoSelecionado.aceitaCartao"
                      type="button"
                      class="flex items-center gap-3 rounded-2xl border p-4 text-left transition"
                      :class="metodoPagamentoSelecionado === 'CREDITO' ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/30' : 'border-slate-200 bg-white hover:border-slate-300'"
                      @click="metodoPagamentoSelecionado = 'CREDITO'"
                    >
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-2xs">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect width="20" height="14" x="2" y="5" rx="2"/>
                          <line x1="2" x2="22" y1="10" y2="10"/>
                        </svg>
                      </div>
                      <div>
                        <p class="font-extrabold text-sm text-slate-900">Cartão de Crédito</p>
                        <p class="text-[11px] text-slate-500">Pagamento online via cartão</p>
                      </div>
                    </button>
                  </div>

                  <!-- Formulário de Cartão de Crédito -->
                  <div v-if="metodoPagamentoSelecionado === 'CREDITO'" class="mt-4 space-y-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/30 p-4">
                    <!-- Checkbox: Usar dados da conta -->
                    <label class="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border border-amber-200/90 shadow-2xs">
                      <input
                        v-model="usarDadosContaTitular"
                        type="checkbox"
                        class="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span class="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span>Usar meus dados cadastrados como titular do cartão</span>
                      </span>
                    </label>

                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">Nome Impresso no Cartão</label>
                        <input
                          v-model="cartaoForm.holderName"
                          type="text"
                          placeholder="EX: MARIA S SILVA"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold uppercase focus:border-amber-500 focus:outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">CPF do Titular do Cartão</label>
                        <input
                          v-model="cartaoForm.cpfTitular"
                          type="text"
                          placeholder="000.000.000-00"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold focus:border-amber-500 focus:outline-none bg-white"
                          @input="onInputCpfTitular"
                        />
                      </div>
                    </div>

                    <div>
                      <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">Número do Cartão</label>
                      <input
                        :value="cartaoForm.numero"
                        type="text"
                        placeholder="4444 5555 6666 7777"
                        maxlength="19"
                        class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-mono font-bold focus:border-amber-500 focus:outline-none bg-white"
                        @input="onInputNumeroCartao"
                      />
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                      <div>
                        <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">Mês</label>
                        <select
                          v-model="cartaoForm.mesValidade"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold bg-white focus:border-amber-500 focus:outline-none"
                        >
                          <option v-for="m in 12" :key="m" :value="String(m).padStart(2, '0')">
                            {{ String(m).padStart(2, '0') }}
                          </option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">Ano</label>
                        <select
                          v-model="cartaoForm.anoValidade"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold bg-white focus:border-amber-500 focus:outline-none"
                        >
                          <option v-for="a in 10" :key="a" :value="String(2025 + a)">
                            {{ 2025 + a }}
                          </option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">CVV</label>
                        <input
                          v-model="cartaoForm.ccv"
                          type="text"
                          placeholder="123"
                          maxlength="4"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-mono font-bold focus:border-amber-500 focus:outline-none bg-white"
                        />
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">CEP de Cobrança do Cartão</label>
                        <input
                          v-model="cartaoForm.cep"
                          type="text"
                          placeholder="60000-000"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold focus:border-amber-500 focus:outline-none bg-white"
                          @input="onInputCep"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">Número da Residência</label>
                        <input
                          v-model="cartaoForm.numeroResidencia"
                          type="text"
                          placeholder="100"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold focus:border-amber-500 focus:outline-none bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label class="block text-[11px] font-bold uppercase text-slate-700 mb-1">Opções de Parcelamento</label>
                      <select
                        v-model="cartaoForm.parcelas"
                        class="w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-xs font-extrabold focus:border-amber-500 focus:outline-none"
                      >
                        <option v-for="opc in opcoesParcelamentoCalculadas" :key="opc.num" :value="opc.num">
                          {{ opc.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <label class="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <input v-model="aceiteTermos" type="checkbox" class="mt-1 h-4 w-4 accent-amber-500" />
                  <span class="text-xs font-semibold text-slate-700">
                    Li e aceito
                    <a
                      v-if="eventoSelecionado.regulamentoUrl"
                      :href="eventoSelecionado.regulamentoUrl"
                      target="_blank"
                      rel="noopener"
                      class="font-bold text-amber-600 underline"
                    >
                      o regulamento
                    </a>
                    <template v-else>os termos de inscrição</template>
                    deste evento.
                  </span>
                </label>

                <p v-if="erroInscricao" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {{ erroInscricao }}
                </p>
              </section>

              <!-- Navegação -->
              <div class="mt-8 flex gap-3">
                <button
                  v-if="step > 1"
                  type="button"
                  class="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
                  @click="voltar"
                >
                  Voltar
                </button>
                <button
                  v-if="step < passos.length"
                  type="button"
                  :disabled="!podeAvancar"
                  class="flex-1 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95 disabled:opacity-50"
                  @click="avancar"
                >
                  Continuar
                </button>
                <button
                  v-else
                  type="button"
                  :disabled="inscrevendo || !aceiteTermos"
                  class="flex-1 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition hover:brightness-95 disabled:opacity-50"
                  @click="onInscrever"
                >
                  {{ inscrevendo ? 'Processando...' : 'Confirmar pagamento' }}
                </button>
              </div>
            </div>

            <!-- Resumo Fixo na Direita -->
            <aside class="order-first min-w-0 md:order-last md:sticky md:top-24 self-start space-y-3">
              <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-amber-200/60">
                <h3 class="text-xs font-bold uppercase tracking-wide text-slate-400">Resumo da inscrição</h3>
                <p class="mt-3 font-bold text-slate-800">{{ eventoSelecionado.nome }}</p>

                <dl class="mt-4 flex flex-col gap-3 text-sm">
                  <div v-if="cliente" class="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <dt class="text-slate-500 font-medium text-xs">Atleta</dt>
                    <dd class="font-bold text-slate-900 text-xs">{{ cliente?.pf?.nomeCompleto || cliente?.nome || user?.email || 'Atleta' }}</dd>
                  </div>
                  <div v-if="modalidadeSelecionada" class="flex items-center justify-between">
                    <dt class="text-slate-500">Modalidade</dt>
                    <dd class="font-medium text-slate-800">{{ modalidadeSelecionada.nome }}</dd>
                  </div>
                  <div v-if="categoriaSelecionada" class="flex items-center justify-between">
                    <dt class="text-slate-500">Categoria</dt>
                    <dd class="font-medium text-slate-800">{{ categoriaSelecionada.nome }}</dd>
                  </div>
                  <div v-if="tamanhoCamisa" class="flex items-center justify-between">
                    <dt class="text-slate-500">Camisa</dt>
                    <dd class="font-medium text-slate-800">{{ tamanhoCamisa }}</dd>
                  </div>
                  <p v-if="!modalidadeSelecionada" class="text-slate-400">Escolha uma modalidade pra ver o resumo.</p>
                </dl>

                <div
                  v-if="modalidadeSelecionada"
                  class="mt-4 border-t border-slate-100 pt-4 space-y-2"
                >
                  <div v-if="cupomAplicadoInfo" class="flex items-center justify-between text-xs text-emerald-700 font-bold">
                    <span>Desconto ({{ cupomAplicadoInfo.percentualDesconto }}%)</span>
                    <span>-R$ {{ valorDescontoCalculado.toFixed(2) }}</span>
                  </div>

                  <div v-if="eventoSelecionado.taxaRepassadaAtleta" class="flex items-center justify-between text-xs text-slate-500">
                    <span>Taxa de conveniência (10% fixo)</span>
                    <span>+R$ {{ taxaConvenienciaCalculada.toFixed(2) }}</span>
                  </div>

                  <div v-if="metodoPagamentoSelecionado === 'CREDITO' && jurosCartaoCalculados > 0" class="flex items-center justify-between text-xs text-amber-700 font-bold">
                    <span>Taxa/Juros Cartão ({{ cartaoForm.parcelas }}x)</span>
                    <span>+R$ {{ jurosCartaoCalculados.toFixed(2) }}</span>
                  </div>

                  <div class="flex items-center justify-between pt-1">
                    <span class="text-sm font-bold uppercase text-slate-500">Total</span>
                    <div class="text-right">
                      <span v-if="cupomAplicadoInfo" class="block text-xs line-through text-slate-400">
                        R$ {{ valorBaseModalidade.toFixed(2) }}
                      </span>
                      <span class="text-lg font-extrabold text-amber-600">
                        R$ {{ valorFinalComMetodo.toFixed(2) }}
                      </span>
                      <span v-if="metodoPagamentoSelecionado === 'CREDITO' && cartaoForm.parcelas > 1" class="block text-[11px] font-bold text-slate-500">
                        {{ cartaoForm.parcelas }}x de R$ {{ (valorFinalComMetodo / cartaoForm.parcelas).toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </div>

                <p v-if="diasRestantesLote !== null" class="mt-4 text-xs" :class="vagasBadgeClasse">
                  <template v-if="loteAtivo?.vagasRestantes !== null">🎟️ {{ loteAtivo?.vagasRestantes }} vagas restantes · </template>
                  Lote encerra em {{ diasRestantesLote }} {{ diasRestantesLote === 1 ? 'dia' : 'dias' }}
                </p>
              </div>

              <!-- Cupom de Desconto Discreto abaixo da caixa de resumo -->
              <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-2">
                <div class="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span class="flex items-center gap-1.5 text-slate-600">
                    <span class="text-sm">🎟️</span> Possui cupom?
                  </span>
                  <span v-if="cupomAplicadoInfo" class="text-[11px] font-black text-emerald-600 uppercase">
                    {{ cupomAplicadoInfo.percentualDesconto }}% OFF
                  </span>
                </div>

                <div class="flex gap-1.5">
                  <input
                    v-model="cupomCodigo"
                    type="text"
                    placeholder="CÓDIGO CUPOM"
                    :disabled="!!cupomAplicadoInfo"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold uppercase focus:border-amber-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 bg-slate-50/50"
                    @keydown.enter.prevent="aplicarCupom"
                  />
                  <button
                    v-if="!cupomAplicadoInfo"
                    type="button"
                    class="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shrink-0"
                    :disabled="validandoCupom"
                    @click="aplicarCupom"
                  >
                    {{ validandoCupom ? '...' : 'Aplicar' }}
                  </button>
                  <button
                    v-else
                    type="button"
                    class="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] font-bold text-red-700 hover:bg-red-100 transition shrink-0"
                    @click="removerCupom"
                  >
                    Remover
                  </button>
                </div>
                <p v-if="erroCupom" class="text-[11px] font-bold text-red-600">⚠️ {{ erroCupom }}</p>
                <p v-if="cupomAplicadoInfo" class="text-[11px] font-bold text-emerald-600">
                  ✅ Cupom <strong>{{ cupomAplicadoInfo.codigo }}</strong> aplicado!
                </p>
              </div>
            </aside>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
