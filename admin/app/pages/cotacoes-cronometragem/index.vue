<script setup lang="ts">
import { Timer, CheckCircle, Ban, ExternalLink, Save, Send } from 'lucide-vue-next'
import {
  ROTULO_SERVICO_CRONOMETRAGEM,
  type CotacaoCronometragemAdmin,
  type SituacaoCotacaoAdmin
} from '../../composables/useAdminCotacaoCronometragem'
import type { CronometradoraAdmin } from '../../composables/useAdminCronometragem'

const {
  listar,
  buscar,
  enviarProposta,
  confirmarPagamento,
  concluir,
  cancelar,
  obterDadosPagamento,
  salvarDadosPagamento
} = useAdminCotacaoCronometragem()
const { fetchEmpresas } = useAdminCronometragem()
const config = useRuntimeConfig()

const cotacoes = ref<CotacaoCronometragemAdmin[]>([])
const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const processando = ref(false)

// Abas pelo que precisa de acao; a lista vem inteira e o filtro e local.
type Aba = 'orcar' | 'propostas' | 'pagamento' | 'pagas' | 'encerradas' | 'todas'
const aba = ref<Aba>('orcar')
const abas: { valor: Aba; label: string; situacoes: SituacaoCotacaoAdmin[] | null }[] = [
  { valor: 'orcar', label: 'Aguardando orçamento', situacoes: ['SOLICITADA'] },
  { valor: 'propostas', label: 'Propostas enviadas', situacoes: ['ORCADA', 'EXPIRADA'] },
  { valor: 'pagamento', label: 'Aguardando pagamento', situacoes: ['ACEITA'] },
  { valor: 'pagas', label: 'Pagas', situacoes: ['PAGA'] },
  { valor: 'encerradas', label: 'Encerradas', situacoes: ['CONCLUIDA', 'RECUSADA', 'CANCELADA'] },
  { valor: 'todas', label: 'Todas', situacoes: null }
]

function contar(situacoes: SituacaoCotacaoAdmin[] | null) {
  return situacoes ? cotacoes.value.filter((c) => situacoes.includes(c.situacao)).length : cotacoes.value.length
}

const filtradas = computed(() => {
  const situacoes = abas.find((a) => a.valor === aba.value)?.situacoes
  return situacoes ? cotacoes.value.filter((c) => situacoes.includes(c.situacao)) : cotacoes.value
})

const ROTULO_SITUACAO: Record<SituacaoCotacaoAdmin, { texto: string; classe: string }> = {
  SOLICITADA: { texto: 'Aguardando orçamento', classe: 'bg-amber-100 text-amber-800' },
  ORCADA: { texto: 'Proposta enviada', classe: 'bg-sky-100 text-sky-800' },
  EXPIRADA: { texto: 'Proposta vencida', classe: 'bg-slate-200 text-slate-700' },
  ACEITA: { texto: 'Aguardando pagamento', classe: 'bg-amber-100 text-amber-800' },
  PAGA: { texto: 'Paga', classe: 'bg-emerald-100 text-emerald-800' },
  CONCLUIDA: { texto: 'Concluída', classe: 'bg-emerald-100 text-emerald-800' },
  RECUSADA: { texto: 'Recusada pelo organizador', classe: 'bg-slate-200 text-slate-700' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-red-100 text-red-700' }
}

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    cotacoes.value = await listar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

// --- Dados de pagamento (configuracao) ---------------------------------------
const dadosPagamento = ref('')
const mostrarDados = ref(false)
const salvandoDados = ref(false)

async function carregarDadosPagamento() {
  try {
    dadosPagamento.value = (await obterDadosPagamento()).dados ?? ''
    if (!dadosPagamento.value) mostrarDados.value = true
  } catch {
    // Sem os dados a tela segue; o card avisa que estao vazios.
  }
}

async function onSalvarDados() {
  erro.value = ''
  sucesso.value = ''
  salvandoDados.value = true
  try {
    dadosPagamento.value = (await salvarDadosPagamento(dadosPagamento.value)).dados ?? ''
    sucesso.value = 'Dados para pagamento salvos.'
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvandoDados.value = false
  }
}

// --- Detalhe -----------------------------------------------------------------
const abertaId = ref<string | null>(null)
const detalhe = ref<CotacaoCronometragemAdmin | null>(null)
const carregandoDetalhe = ref(false)
const cronometradoras = ref<CronometradoraAdmin[]>([])
const cronometradoraId = ref('')

const proposta = reactive({ valor: '' as string | number, descricao: '', propostaValidaAte: '', pagamentoAte: '' })

function dataIso(d: Date) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function preencherProposta(c: CotacaoCronometragemAdmin) {
  proposta.valor = c.valor ? Number(c.valor) : ''
  proposta.descricao = c.descricaoProposta ?? ''
  const hoje = new Date()
  const validade = new Date(hoje.getTime() + 7 * 86400000)
  // Sugestao: pagar ate 7 dias antes da prova, mas nunca antes da validade.
  const seteAntes = new Date(new Date(c.evento.dataInicio).getTime() - 7 * 86400000)
  const pagamento = seteAntes > validade ? seteAntes : validade
  proposta.propostaValidaAte = dataIso(validade)
  proposta.pagamentoAte = dataIso(pagamento)
}

async function abrir(c: CotacaoCronometragemAdmin) {
  if (abertaId.value === c.id) {
    abertaId.value = null
    return
  }
  abertaId.value = c.id
  detalhe.value = null
  carregandoDetalhe.value = true
  try {
    const carregada = await buscar(c.id)
    detalhe.value = carregada
    preencherProposta(carregada)
    if (carregada.situacao === 'ACEITA' && cronometradoras.value.length === 0) {
      cronometradoras.value = await fetchEmpresas().catch(() => [])
    }
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoDetalhe.value = false
  }
}

async function executar(acao: () => Promise<CotacaoCronometragemAdmin>, mensagem: string) {
  erro.value = ''
  sucesso.value = ''
  processando.value = true
  try {
    detalhe.value = await acao()
    sucesso.value = mensagem
    await carregar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processando.value = false
  }
}

async function onEnviarProposta() {
  if (!detalhe.value) return
  const valor = Number(proposta.valor)
  if (!valor || valor <= 0) {
    erro.value = 'Informe o valor da proposta.'
    return
  }
  if (proposta.descricao.trim().length < 3) {
    erro.value = 'Descreva o que está incluso na proposta.'
    return
  }
  const id = detalhe.value.id
  await executar(
    () =>
      enviarProposta(id, {
        valor: Math.round(valor * 100) / 100,
        descricao: proposta.descricao.trim(),
        propostaValidaAte: proposta.propostaValidaAte,
        pagamentoAte: proposta.pagamentoAte
      }),
    'Proposta enviada. O organizador recebe um e-mail.'
  )
}

async function onConfirmarPagamento() {
  if (!detalhe.value) return
  const nome = cronometradoras.value.find((c) => c.id === cronometradoraId.value)?.nome
  const texto = nome
    ? `Confirmar o pagamento? A cronometradora ${nome} ganha acesso aos inscritos da prova no Mark.`
    : 'Confirmar o pagamento? Nenhuma cronometradora vai receber acesso automático.'
  if (!confirm(texto)) return
  const id = detalhe.value.id
  await executar(
    () => confirmarPagamento(id, cronometradoraId.value || undefined),
    'Pagamento confirmado. O organizador recebe um e-mail.'
  )
}

async function onConcluir() {
  if (!detalhe.value || !confirm('Marcar a cronometragem desta prova como concluída?')) return
  const id = detalhe.value.id
  await executar(() => concluir(id), 'Cotação concluída.')
}

async function onCancelar() {
  if (!detalhe.value) return
  const motivo = prompt('Motivo do cancelamento (o organizador recebe por e-mail):')
  if (motivo === null) return
  const id = detalhe.value.id
  await executar(() => cancelar(id, motivo.trim() || undefined), 'Cotação cancelada.')
}

// --- Formatacao --------------------------------------------------------------
function nomeOrganizador(c: CotacaoCronometragemAdmin) {
  const cliente = c.organizador.cliente
  return cliente.pf?.nomeCompleto || cliente.pj?.razaoSocial || cliente.usuario.email
}

function telefoneOrganizador(c: CotacaoCronometragemAdmin) {
  const cliente = c.organizador.cliente
  return cliente.pf?.celular || cliente.pj?.celularComercial || null
}

function rotuloServico(chave: string) {
  return ROTULO_SERVICO_CRONOMETRAGEM[chave] ?? chave
}

function formatarValor(valor: string | number | null) {
  return valor === null || valor === ''
    ? '—'
    : Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'
}

function urlArquivo(caminho: string | null) {
  return urlFoto(caminho, config.public.apiBase as string)
}

onMounted(() => {
  carregar()
  carregarDadosPagamento()
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div>
      <h1 class="flex items-center gap-2 text-2xl font-black uppercase tracking-tight text-primary">
        <Timer :size="24" /> Cotações de cronometragem
      </h1>
      <p class="mt-1 text-xs text-slate-500">
        Pedidos de cotação dos organizadores. Envie a proposta, confirme o pagamento quando cair na conta e libere a cronometradora.
      </p>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
      <CheckCircle :size="16" /> {{ sucesso }}
    </p>

    <!-- Dados para pagamento -->
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-800">Dados para pagamento</h2>
          <p class="mt-0.5 text-xs text-slate-500">
            Aparecem para o organizador depois que ele aceita a proposta (chave PIX, favorecido, banco).
          </p>
        </div>
        <button
          type="button"
          class="text-xs font-bold uppercase tracking-wide text-secondary hover:underline"
          @click="mostrarDados = !mostrarDados"
        >
          {{ mostrarDados ? 'Fechar' : 'Editar' }}
        </button>
      </div>
      <p v-if="!mostrarDados" class="mt-3 whitespace-pre-wrap text-sm" :class="dadosPagamento ? 'text-slate-700' : 'font-semibold text-amber-700'">
        {{ dadosPagamento || 'Ainda não preenchido: o organizador verá “a equipe vai enviar os dados para pagamento”.' }}
      </p>
      <div v-else class="mt-3 space-y-2">
        <textarea
          v-model="dadosPagamento"
          rows="4"
          maxlength="2000"
          placeholder="Ex.: PIX (CNPJ): 00.000.000/0001-00&#10;Favorecido: Seu Percurso LTDA&#10;Banco: ..."
          class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        />
        <button
          type="button"
          :disabled="salvandoDados"
          class="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-50"
          @click="onSalvarDados"
        >
          <Save :size="14" /> {{ salvandoDados ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </div>

    <!-- Abas -->
    <div class="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <button
        v-for="a in abas"
        :key="a.valor"
        type="button"
        class="rounded-xl px-3 py-2 text-xs font-bold transition"
        :class="aba === a.valor ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'"
        @click="aba = a.valor"
      >
        {{ a.label }} ({{ contar(a.situacoes) }})
      </button>
    </div>

    <p v-if="carregando" class="text-sm text-slate-500">Carregando...</p>
    <div v-else-if="filtradas.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      Nenhuma cotação aqui.
    </div>

    <div v-else class="space-y-3">
      <div v-for="c in filtradas" :key="c.id" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button type="button" class="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left" @click="abrir(c)">
          <div class="min-w-0">
            <p class="font-bold text-slate-900">{{ c.evento.nome }}</p>
            <p class="text-xs text-slate-500">
              {{ nomeOrganizador(c) }} · prova em {{ formatarData(c.evento.dataInicio) }} · pedido em {{ formatarData(c.createdAt) }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="c.valor" class="text-sm font-black text-slate-800">{{ formatarValor(c.valor) }}</span>
            <span class="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider" :class="ROTULO_SITUACAO[c.situacao].classe">
              {{ ROTULO_SITUACAO[c.situacao].texto }}
            </span>
          </div>
        </button>

        <div v-if="abertaId === c.id" class="space-y-4 border-t border-slate-100 p-4 text-sm">
          <p v-if="carregandoDetalhe" class="text-slate-500">Carregando...</p>
          <template v-else-if="detalhe">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Organizador</p>
                <p class="font-semibold text-slate-800">{{ nomeOrganizador(detalhe) }}</p>
                <p class="text-slate-600">{{ detalhe.organizador.cliente.usuario.email }}</p>
                <p v-if="telefoneOrganizador(detalhe)" class="text-slate-600">{{ telefoneOrganizador(detalhe) }}</p>
              </div>
              <div>
                <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Prova</p>
                <p class="font-semibold text-slate-800">{{ formatarData(detalhe.evento.dataInicio) }} · {{ detalhe.evento.cidade }}/{{ detalhe.evento.estado }}</p>
                <p class="text-slate-600">{{ detalhe.evento.local }}</p>
                <p v-if="detalhe.evento.modalidades?.length" class="text-slate-600">
                  {{ detalhe.evento.modalidades.map((m) => m.distanciaKm ? `${m.nome} (${Number(m.distanciaKm)} km)` : m.nome).join(', ') }}
                </p>
              </div>
              <div>
                <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Pedido</p>
                <p class="text-slate-700">{{ detalhe.servicos.map(rotuloServico).join(', ') }}</p>
                <p class="text-slate-600">
                  Atletas esperados: <strong>{{ detalhe.atletasEstimados ?? '—' }}</strong> ·
                  Inscritos confirmados hoje: <strong>{{ detalhe.inscritosConfirmados ?? '—' }}</strong>
                </p>
                <p class="text-slate-600">Pontos de passagem: <strong>{{ detalhe.pontosPassagem ?? '—' }}</strong></p>
              </div>
              <div v-if="detalhe.observacoes">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Observações</p>
                <p class="whitespace-pre-wrap text-slate-700">{{ detalhe.observacoes }}</p>
              </div>
            </div>

            <p v-if="detalhe.motivo" class="rounded-xl bg-slate-50 p-3 text-slate-700">
              <strong>Motivo:</strong> {{ detalhe.motivo }}
            </p>

            <!-- Proposta: enviar ou reenviar -->
            <div v-if="['SOLICITADA', 'ORCADA', 'EXPIRADA'].includes(detalhe.situacao)" class="space-y-3 rounded-xl border border-slate-200 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
                {{ detalhe.situacao === 'SOLICITADA' ? 'Enviar proposta' : 'Reenviar proposta (substitui a anterior)' }}
              </p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="text-xs font-semibold text-slate-500">
                  Valor (R$)
                  <input v-model="proposta.valor" type="number" min="0.01" step="0.01" class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
                </label>
                <label class="text-xs font-semibold text-slate-500">
                  Proposta válida até
                  <input v-model="proposta.propostaValidaAte" type="date" class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
                </label>
                <label class="text-xs font-semibold text-slate-500">
                  Pagamento até
                  <input v-model="proposta.pagamentoAte" type="date" class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
                </label>
              </div>
              <label class="block text-xs font-semibold text-slate-500">
                O que está incluso
                <textarea
                  v-model="proposta.descricao"
                  rows="4"
                  maxlength="4000"
                  placeholder="Chip descartável para até 500 atletas, 2 tapetes, pórtico, resultado online no dia..."
                  class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                :disabled="processando"
                class="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-50"
                @click="onEnviarProposta"
              >
                <Send :size="14" /> {{ processando ? 'Enviando...' : 'Enviar proposta' }}
              </button>
            </div>

            <!-- Proposta enviada (somente leitura) -->
            <div v-if="['ACEITA', 'PAGA', 'CONCLUIDA', 'RECUSADA'].includes(detalhe.situacao) && detalhe.valor" class="rounded-xl bg-slate-50 p-3 text-slate-700">
              <p><strong>{{ formatarValor(detalhe.valor) }}</strong> · pagamento até {{ formatarData(detalhe.pagamentoAte) }}</p>
              <p v-if="detalhe.descricaoProposta" class="mt-1 whitespace-pre-wrap">{{ detalhe.descricaoProposta }}</p>
            </div>

            <a
              v-if="detalhe.comprovanteUrl"
              :href="urlArquivo(detalhe.comprovanteUrl)!"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline"
            >
              <ExternalLink :size="14" /> Ver comprovante (enviado em {{ formatarData(detalhe.comprovanteEnviadoEm) }})
            </a>

            <!-- Confirmar pagamento -->
            <div v-if="detalhe.situacao === 'ACEITA'" class="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-emerald-800">Confirmar pagamento</p>
              <label class="block text-xs font-semibold text-slate-600">
                Cronometradora que vai trabalhar na prova (ganha acesso aos inscritos no Mark)
                <select v-model="cronometradoraId" class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 sm:w-80">
                  <option value="">Nenhuma por enquanto</option>
                  <option v-for="cr in cronometradoras" :key="cr.id" :value="cr.id">{{ cr.nome }}</option>
                </select>
              </label>
              <button
                type="button"
                :disabled="processando"
                class="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:opacity-50"
                @click="onConfirmarPagamento"
              >
                <CheckCircle :size="14" /> Confirmar pagamento recebido
              </button>
            </div>

            <p v-if="detalhe.situacao === 'PAGA'" class="text-emerald-800">
              Pago em {{ formatarData(detalhe.pagaEm) }}<template v-if="detalhe.cronometradora"> · cronometradora: <strong>{{ detalhe.cronometradora.nome }}</strong></template>
            </p>

            <div class="flex flex-wrap gap-2">
              <button
                v-if="detalhe.situacao === 'PAGA'"
                type="button"
                :disabled="processando"
                class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                @click="onConcluir"
              >
                Marcar como concluída
              </button>
              <button
                v-if="['SOLICITADA', 'ORCADA', 'EXPIRADA', 'ACEITA'].includes(detalhe.situacao)"
                type="button"
                :disabled="processando"
                class="flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-600 hover:bg-red-50 disabled:opacity-50"
                @click="onCancelar"
              >
                <Ban :size="14" /> Cancelar cotação
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
