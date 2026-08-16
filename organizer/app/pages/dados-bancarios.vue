<script setup lang="ts">
const { organizador, fetchMe, atualizarDadosBancarios } = useOrganizador()

const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const salvando = ref(false)

const form = reactive({
  chavePix: '',
  banco: '',
  agencia: '',
  conta: ''
})

onMounted(async () => {
  try {
    await fetchMe()
    form.chavePix = organizador.value?.chavePix || ''
    form.banco = organizador.value?.banco || ''
    form.agencia = organizador.value?.agencia || ''
    form.conta = organizador.value?.conta || ''
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
    await atualizarDadosBancarios({ ...form })
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
      <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ erro }}</p>
      <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{{ sucesso }}</p>

      <form class="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="onSalvar">
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Chave Pix</label>
          <input
            v-model="form.chavePix"
            type="text"
            placeholder="CPF/CNPJ, e-mail, celular ou chave aleatória"
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div class="border-t border-slate-100 pt-4">
          <p class="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Ou dados da conta bancária</p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Banco</label>
              <input v-model="form.banco" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Agência</label>
              <input v-model="form.agencia" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Conta</label>
              <input v-model="form.conta" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
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
