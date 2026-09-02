<script setup lang="ts">
import { CheckCircle, Lock, Clock } from 'lucide-vue-next'
import type { AlteracaoDocumento } from '../composables/useAlteracaoDocumento'

const { organizador, fetchMe, atualizarDadosBancarios } = useOrganizador()

const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const salvando = ref(false)

const form = reactive({
  banco: '',
  agencia: '',
  conta: '',
  tipoConta: '',
  // Exigidos pelo Asaas para abrir a conta de recebimento.
  rendaFaturamentoMensal: '' as string | number,
  tipoEmpresa: '',
  emailRecebimento: ''
})

const emailLogin = computed(() => organizador.value?.emailLogin || '')

const ehPessoaJuridica = computed(() => organizador.value?.tipoPessoa === 'PJ')

// --- Troca de CPF/CNPJ ---
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
      'Solicitação enviada. Os saques ficam bloqueados até a análise ser concluída.'
    formAlteracao.documentoNovo = ''
    formAlteracao.motivo = ''
    arquivoDocumento.value = null
    alteracoes.value = await listarAlteracoes()
  } catch (e) {
    erroAlteracao.value = extrairErro(e)
  } finally {
    enviandoAlteracao.value = false
  }
}

const tiposEmpresa = [
  { valor: 'MEI', rotulo: 'MEI — Microempreendedor Individual' },
  { valor: 'LIMITED', rotulo: 'LTDA — Sociedade Limitada' },
  { valor: 'INDIVIDUAL', rotulo: 'EI — Empresário Individual' },
  { valor: 'ASSOCIATION', rotulo: 'Associação' }
]


onMounted(async () => {
  try {
    await fetchMe()
    form.banco = organizador.value?.banco || ''
    form.agencia = organizador.value?.agencia || ''
    form.conta = organizador.value?.conta || ''
    form.tipoConta = organizador.value?.tipoConta || ''
    form.rendaFaturamentoMensal = organizador.value?.rendaFaturamentoMensal
      ? Number(organizador.value.rendaFaturamentoMensal)
      : ''
    form.tipoEmpresa = organizador.value?.tipoEmpresa || ''
    form.emailRecebimento = organizador.value?.emailRecebimento || ''
    alteracoes.value = await listarAlteracoes()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

async function onSalvar() {
  erro.value = ''
  sucesso.value = ''
  salvando.value = true
  try {
    await atualizarDadosBancarios({
      ...form,
      rendaFaturamentoMensal: Number(form.rendaFaturamentoMensal) || undefined,
      // O Asaas recusa companyType em conta de pessoa física.
      tipoEmpresa: ehPessoaJuridica.value ? form.tipoEmpresa || undefined : undefined,
      emailRecebimento: form.emailRecebimento || undefined
    })
    sucesso.value = 'Dados bancários salvos.'
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Dados bancários</h1>
    <p class="mt-1 text-sm text-slate-500">
      Dados necessários para abrir sua conta de recebimento no Asaas, onde caem os repasses das suas inscrições.
    </p>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <template v-else>
      <div v-if="organizador?.asaasWalletId" class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900 flex items-start gap-3 shadow-2xs">
        <CheckCircle :size="20" class="text-emerald-600" />
        <div class="space-y-1">
          <p class="font-black text-sm text-emerald-950">Conta de recebimento criada</p>
          <p class="text-[11px] text-emerald-800 leading-relaxed">
            Sua parte das inscrições já é direcionada para esta conta. Para <strong>sacar</strong>,
            o Asaas ainda precisa aprovar a documentação — ele envia as instruções por e-mail, e o
            andamento aparece na tela Financeiro.
          </p>
        </div>
      </div>

      <div
        v-else-if="organizador?.rendaFaturamentoMensal && organizador?.status !== 'APROVADO'"
        class="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-2xs"
      >
        <Clock :size="20" class="text-amber-600" />
        <div class="space-y-1">
          <p class="font-black text-sm text-amber-950">Dados salvos — conta ainda não ativada</p>
          <p class="text-[11px] text-amber-800 leading-relaxed">Assim que seu cadastro de organizador for aprovado pela nossa equipe, sua conta de recebimento é ativada automaticamente. Não precisa preencher nada de novo.</p>
        </div>
      </div>

      <!-- Banner de Trava de Segurança de Titularidade -->
      <div class="mt-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 flex items-start gap-3 shadow-2xs">
        <Lock :size="20" class="text-blue-700" />
        <div class="space-y-1">
          <p class="font-black text-sm text-blue-950">Trava de Segurança de Titularidade Ativa (PF / PJ)</p>
          <p class="text-[11px] text-blue-800 leading-relaxed">
            O saque vai <strong>sempre para a chave PIX do seu CPF/CNPJ cadastrado</strong>, em qualquer banco — o destino não é escolhido. Como a chave é o próprio documento, o sistema bancário garante que o dinheiro cai em conta sua. Alterar o CPF/CNPJ exige envio do documento e análise.
          </p>
        </div>
      </div>

      <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ erro }}</p>
      <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{{ sucesso }}</p>

      <form class="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="onSalvar">
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-semibold text-slate-700">Conta que recebe os saques</p>
          <p class="mt-1 text-xs leading-relaxed text-slate-500">
            Os saques vão sempre para a <strong>chave PIX do seu CPF/CNPJ cadastrado</strong>,
            em qualquer banco. Não é possível escolher outra conta — é assim que garantimos
            que o dinheiro cai com você, e não com terceiros.
          </p>
        </div>

        <div class="border-t border-slate-100 pt-4">
          <label class="mb-1 block text-sm font-semibold text-slate-700">
            Renda mensal (PF) ou faturamento mensal (PJ)
          </label>
          <input
            v-model="form.rendaFaturamentoMensal"
            type="number"
            min="1"
            step="0.01"
            placeholder="5000.00"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
          />
          <p class="mt-1.5 text-xs text-slate-500">
            Exigido pelo Asaas para abrir sua conta de recebimento. Sem esse dado o repasse
            automático das inscrições não é ativado.
          </p>

          <div class="mt-4">
            <label class="mb-1 block text-sm font-semibold text-slate-700">
              E-mail da conta de recebimento
            </label>
            <input
              v-model="form.emailRecebimento"
              type="email"
              :placeholder="emailLogin || 'seu@email.com'"
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
            <p class="mt-1.5 text-xs text-slate-500">
              Deixe em branco para usar o e-mail da sua conta. Preencha apenas se
              <strong>você já tiver uma conta no Asaas</strong> com esse endereço — o Asaas não
              permite dois cadastros com o mesmo e-mail.
            </p>
          </div>

          <div v-if="ehPessoaJuridica" class="mt-4">
            <label class="mb-1 block text-sm font-semibold text-slate-700">Natureza jurídica</label>
            <select
              v-model="form.tipoEmpresa"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            >
              <option value="" disabled>Selecione</option>
              <option v-for="tipo in tiposEmpresa" :key="tipo.valor" :value="tipo.valor">
                {{ tipo.rotulo }}
              </option>
            </select>
            <p class="mt-1.5 text-xs text-slate-500">
              Obrigatório para conta com CNPJ.
            </p>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-4">
          <p class="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Ou dados da conta bancária</p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Banco</label>
              <input v-model="form.banco" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Agência</label>
              <input v-model="form.agencia" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Conta</label>
              <input v-model="form.conta" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Tipo de conta</label>
              <select v-model="form.tipoConta" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30">
                <option value="">Selecione</option>
                <option value="CORRENTE">Corrente</option>
                <option value="POUPANCA">Poupança</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="salvando"
          class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
        >
          {{ salvando ? 'Salvando...' : 'Salvar' }}
        </button>
      </form>

      <!-- Troca de CPF/CNPJ: e esse documento que define o destino do saque -->
      <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-black text-slate-900">
              {{ ehPessoaJuridica ? 'CNPJ' : 'CPF' }} do titular
            </h2>
            <p class="mt-1 text-xs text-slate-500 max-w-xl leading-relaxed">
              Os saques saem sempre para a chave PIX deste documento, em qualquer banco. Por isso
              ele não é editável no perfil — alterar exige análise com foto do documento.
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
          class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
        >
          <p class="font-black uppercase tracking-wider">Solicitação em análise</p>
          <p class="mt-1 leading-relaxed">
            Pedido de alteração para
            <strong class="font-mono">{{ alteracaoPendente.documentoNovo }}</strong>
            enviado. <strong>Os saques ficam bloqueados até a conclusão.</strong>
          </p>
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
            <label class="mb-1 block text-sm font-semibold text-slate-700">
              Foto do documento
            </label>
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
