<script setup lang="ts">
import { CheckCircle, Lock, Clock } from 'lucide-vue-next'

const { organizador, fetchMe, atualizarDadosBancarios } = useOrganizador()

const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const salvando = ref(false)

const form = reactive({
  chavePix: '',
  banco: '',
  agencia: '',
  conta: '',
  tipoConta: '',
  // Exigidos pelo Asaas para abrir a conta de recebimento.
  rendaFaturamentoMensal: '' as string | number,
  tipoEmpresa: ''
})

const ehPessoaJuridica = computed(() => organizador.value?.tipoPessoa === 'PJ')

const tiposEmpresa = [
  { valor: 'MEI', rotulo: 'MEI — Microempreendedor Individual' },
  { valor: 'LIMITED', rotulo: 'LTDA — Sociedade Limitada' },
  { valor: 'INDIVIDUAL', rotulo: 'EI — Empresário Individual' },
  { valor: 'ASSOCIATION', rotulo: 'Associação' }
]


onMounted(async () => {
  try {
    await fetchMe()
    form.chavePix = organizador.value?.chavePix || ''
    form.banco = organizador.value?.banco || ''
    form.agencia = organizador.value?.agencia || ''
    form.conta = organizador.value?.conta || ''
    form.tipoConta = organizador.value?.tipoConta || ''
    form.rendaFaturamentoMensal = organizador.value?.rendaFaturamentoMensal
      ? Number(organizador.value.rendaFaturamentoMensal)
      : ''
    form.tipoEmpresa = organizador.value?.tipoEmpresa || ''
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
      tipoEmpresa: ehPessoaJuridica.value ? form.tipoEmpresa || undefined : undefined
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
      Onde os repasses das suas inscrições vão cair. Enquanto o pagamento ainda é simulado, esses dados ficam só guardados aqui.
    </p>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <template v-else>
      <div v-if="organizador?.asaasWalletId" class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900 flex items-start gap-3 shadow-2xs">
        <CheckCircle :size="20" class="text-emerald-600" />
        <div class="space-y-1">
          <p class="font-black text-sm text-emerald-950">Sua conta de recebimento está ativa</p>
          <p class="text-[11px] text-emerald-800 leading-relaxed">Tudo certo! Você já pode receber automaticamente os pagamentos das suas inscrições, via PIX e Cartão, com o dinheiro liberado em até 2 dias.</p>
        </div>
      </div>

      <div
        v-else-if="(organizador?.chavePix || organizador?.conta) && organizador?.status !== 'APROVADO'"
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
            Por regras de compliance do BACEN e prevenção a fraudes, <strong>os saques via PIX só são processados para contas bancárias ou chaves PIX de titularidade do próprio organizador</strong> (mesmo CPF ou CNPJ cadastrado). Não são permitidas transferências para contas de terceiros.
          </p>
        </div>
      </div>

      <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ erro }}</p>
      <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{{ sucesso }}</p>

      <form class="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="onSalvar">
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Chave Pix</label>
          <input
            v-model="form.chavePix"
            type="text"
            placeholder="CPF/CNPJ, e-mail, celular ou chave aleatória"
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
          />
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
    </template>
  </div>
</template>
