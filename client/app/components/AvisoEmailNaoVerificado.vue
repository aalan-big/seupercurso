<script setup lang="ts">
import { MailWarning } from 'lucide-vue-next'

const { token, user, reenviarVerificacao } = useAuth()

const reenviando = ref(false)
const reenviado = ref(false)
const erro = ref('')

const visivel = computed(() => !!token.value && user.value && !user.value.emailVerificado)

async function onReenviar() {
  erro.value = ''
  reenviando.value = true
  try {
    await reenviarVerificacao()
    reenviado.value = true
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    reenviando.value = false
  }
}
</script>

<template>
  <div v-if="visivel" class="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 text-center text-xs font-semibold text-amber-800 sm:justify-between sm:text-left">
      <span class="flex items-center gap-2">
        <MailWarning :size="16" class="shrink-0" />
        {{ reenviado ? 'E-mail reenviado! Confira sua caixa de entrada.' : 'Confirme seu e-mail pra poder se inscrever em eventos.' }}
        <span v-if="erro" class="text-red-600">{{ erro }}</span>
      </span>
      <button
        v-if="!reenviado"
        type="button"
        :disabled="reenviando"
        class="whitespace-nowrap rounded-lg bg-amber-800 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
        @click="onReenviar"
      >
        {{ reenviando ? 'Enviando...' : 'Reenviar e-mail' }}
      </button>
    </div>
  </div>
</template>
