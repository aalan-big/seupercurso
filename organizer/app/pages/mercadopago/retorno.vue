<script setup lang="ts">
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-vue-next'

// Pagina de retorno do OAuth: o Mercado Pago manda o organizador para ca com
// `code` e `state` na URL depois de ele autorizar a nossa aplicacao.
const route = useRoute()
const { concluirConexao } = useMercadoPagoConexao()

const estado = ref<'processando' | 'ok' | 'erro'>('processando')
const erro = ref('')

onMounted(async () => {
  const code = String(route.query.code || '')
  const state = String(route.query.state || '')

  if (!code) {
    estado.value = 'erro'
    erro.value =
      route.query.error_description
        ? String(route.query.error_description)
        : 'A autorização foi cancelada antes de ser concluída.'
    return
  }

  try {
    await concluirConexao(code, state)
    estado.value = 'ok'
    setTimeout(() => navigateTo('/financeiro'), 2500)
  } catch (e) {
    estado.value = 'erro'
    erro.value = extrairErro(e)
  }
})
</script>

<template>
  <div class="mx-auto max-w-lg py-16 text-center">
    <div v-if="estado === 'processando'" class="space-y-4">
      <Loader2 :size="40" class="mx-auto animate-spin text-warning" />
      <h1 class="text-lg font-black text-slate-900">Concluindo a conexão...</h1>
      <p class="text-sm text-slate-500">
        Estamos vinculando sua conta do Mercado Pago. Não feche esta página.
      </p>
    </div>

    <div v-else-if="estado === 'ok'" class="space-y-4">
      <CheckCircle :size="48" class="mx-auto text-emerald-600" />
      <h1 class="text-lg font-black text-emerald-900">Conta conectada!</h1>
      <p class="text-sm text-slate-600">
        As inscrições dos seus eventos já caem direto na sua conta do Mercado Pago.
        Levando você ao Financeiro...
      </p>
    </div>

    <div v-else class="space-y-4">
      <AlertTriangle :size="48" class="mx-auto text-red-600" />
      <h1 class="text-lg font-black text-red-900">Não foi possível conectar</h1>
      <p class="text-sm text-slate-600">{{ erro }}</p>
      <NuxtLink
        to="/financeiro"
        class="inline-block rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
      >
        Tentar de novo
      </NuxtLink>
    </div>
  </div>
</template>
