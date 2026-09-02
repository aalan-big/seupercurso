<script setup lang="ts">
import { CheckCircle, AlertTriangle } from 'lucide-vue-next'
import type { AlteracaoDocumento } from '../composables/useAlteracaoDocumento'

/**
 * Dados do titular.
 *
 * O recebimento passou a ser pela conta do proprio organizador no Mercado Pago,
 * conectada na tela Financeiro — nao ha mais subconta nossa para abrir aqui.
 * O que resta e o CPF/CNPJ do titular, que continua exigindo documento e
 * aprovacao para mudar.
 */
const { organizador, fetchMe } = useOrganizador()

const carregando = ref(true)
const erro = ref('')

const ehPessoaJuridica = computed(() => organizador.value?.tipoPessoa === 'PJ')

const { listar: listarAlteracoes, solicitar: solicitarAlteracao } = useAlteracaoDocumento()
const alteracoes = ref<AlteracaoDocumento[]>([])
const formAlteracao = reactive({ documentoNovo: '', motivo: '' })
const arquivoDocumento = ref<File | null>(null)
const enviandoAlteracao = ref(false)
const erroAlteracao = ref('')
const sucessoAlteracao = ref('')
const painelAlteracaoAberto = ref(false)

const alteracaoPendente = computed(() =>
  alteracoes.value.find((a) => a.status === 'PENDENTE')
)

function onArquivoDocumento(e: Event) {
  arquivoDocumento.value = (e.target as HTMLInputElement).files?.[0] || null
}

async function onSolicitarAlteracao() {
  erroAlteracao.value = ''
  sucessoAlteracao.value = ''

  if (!arquivoDocumento.value) {
    erroAlteracao.value = 'Anexe a foto do documento que comprova o novo número.'
    return
  }

  enviandoAlteracao.value = true
  try {
    await solicitarAlteracao(
      formAlteracao.documentoNovo,
      arquivoDocumento.value,
      formAlteracao.motivo || undefined
    )
    sucessoAlteracao.value =
      'Solicitação enviada. Assim que a análise terminar, você é avisado por aqui.'
    formAlteracao.documentoNovo = ''
    formAlteracao.motivo = ''
    arquivoDocumento.value = null
    painelAlteracaoAberto.value = false
    alteracoes.value = await listarAlteracoes()
  } catch (e) {
    erroAlteracao.value = extrairErro(e)
  } finally {
    enviandoAlteracao.value = false
  }
}

onMounted(async () => {
  try {
    await fetchMe()
    alteracoes.value = await listarAlteracoes()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Dados do titular</h1>
    <p class="mt-1 text-sm text-slate-500">
      Documento usado nos seus eventos e nos comprovantes emitidos pela plataforma.
    </p>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <template v-else>
      <div class="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
        <CheckCircle :size="20" class="shrink-0 text-slate-400" />
        <div class="space-y-1">
          <p class="text-sm font-black text-slate-900">Onde o dinheiro cai</p>
          <p class="text-[11px] leading-relaxed text-slate-600">
            As inscrições são pagas direto na sua conta do Mercado Pago, e é lá que você
            saca. Para conectá-la, vá em
            <NuxtLink to="/financeiro" class="font-bold underline">Financeiro</NuxtLink>.
          </p>
        </div>
      </div>

      <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ erro }}
      </p>

      <!-- Troca de CPF/CNPJ: continua exigindo documento e análise -->
      <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-black text-slate-900">
              {{ ehPessoaJuridica ? 'CNPJ' : 'CPF' }} do titular
            </h2>
            <p class="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
              Este documento identifica você como organizador nos eventos e nos comprovantes.
              Por isso não é editável direto no perfil — alterar exige envio do documento e
              análise da nossa equipe.
            </p>
          </div>
          <button
            v-if="!alteracaoPendente"
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            @click="painelAlteracaoAberto = !painelAlteracaoAberto"
          >
            {{ painelAlteracaoAberto ? 'Cancelar' : 'Solicitar alteração' }}
          </button>
        </div>

        <div
          v-if="alteracaoPendente"
          class="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
        >
          <AlertTriangle :size="16" class="mt-0.5 shrink-0" />
          <div>
            <p class="font-black uppercase tracking-wider">Solicitação em análise</p>
            <p class="mt-1 leading-relaxed">
              Pedido de alteração para
              <strong class="font-mono">{{ alteracaoPendente.documentoNovo }}</strong> enviado.
              Você é avisado por aqui quando a análise terminar.
            </p>
          </div>
        </div>

        <p
          v-if="sucessoAlteracao"
          class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"
        >
          {{ sucessoAlteracao }}
        </p>
        <p
          v-if="erroAlteracao"
          class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          {{ erroAlteracao }}
        </p>

        <form
          v-if="painelAlteracaoAberto && !alteracaoPendente"
          class="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4"
          @submit.prevent="onSolicitarAlteracao"
        >
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">
              Novo {{ ehPessoaJuridica ? 'CNPJ' : 'CPF' }}
            </label>
            <input
              v-model="formAlteracao.documentoNovo"
              type="text"
              inputmode="numeric"
              required
              :placeholder="ehPessoaJuridica ? '00.000.000/0000-00' : '000.000.000-00'"
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Foto do documento</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-bold"
              @change="onArquivoDocumento"
            />
            <p class="mt-1.5 text-xs text-slate-500">
              Imagem ou PDF de até 10 MB, legível e com o número visível.
            </p>
          </div>

          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Motivo (opcional)</label>
            <input
              v-model="formAlteracao.motivo"
              type="text"
              maxlength="500"
              placeholder="Ex.: correção de digitação no cadastro"
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
          </div>

          <button
            type="submit"
            :disabled="enviandoAlteracao"
            class="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {{ enviandoAlteracao ? 'Enviando...' : 'Enviar para análise' }}
          </button>
        </form>

        <ul v-if="alteracoes.length" class="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <li
            v-for="a in alteracoes"
            :key="a.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"
          >
            <span class="font-mono font-bold text-slate-700">
              {{ a.documentoAtual }} → {{ a.documentoNovo }}
            </span>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              :class="{
                'bg-amber-100 text-amber-800': a.status === 'PENDENTE',
                'bg-emerald-100 text-emerald-800': a.status === 'APROVADA',
                'bg-red-100 text-red-700': a.status === 'REJEITADA'
              }"
            >
              {{ a.status }}
            </span>
            <span v-if="a.motivoRejeicao" class="w-full text-red-700">{{ a.motivoRejeicao }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
