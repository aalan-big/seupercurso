<script setup lang="ts">
import { CheckCircle2, XCircle, Loader2 } from 'lucide-vue-next'

const { token, verificarEmail, reenviarVerificacao, fetchMe } = useAuth()
const route = useRoute()

const estado = ref<'verificando' | 'sucesso' | 'erro'>('verificando')
const mensagem = ref('')
const reenviando = ref(false)
const reenviado = ref(false)

onMounted(async () => {
  const emailToken = route.query.token
  if (typeof emailToken !== 'string' || !emailToken) {
    estado.value = 'erro'
    mensagem.value = 'Link de verificação inválido.'
    return
  }

  try {
    await verificarEmail(emailToken)
    estado.value = 'sucesso'
    if (token.value) {
      fetchMe().catch(() => {
        // se falhar, o banner some no próximo carregamento normal do site
      })
    }
  } catch (e) {
    estado.value = 'erro'
    mensagem.value = extrairErro(e)
  }
})

async function onReenviar() {
  reenviando.value = true
  try {
    await reenviarVerificacao()
    reenviado.value = true
  } catch (e) {
    mensagem.value = extrairErro(e)
  } finally {
    reenviando.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center px-6 py-16">
    <div class="mx-auto w-full max-w-md text-center">
      <div v-if="estado === 'verificando'" class="flex flex-col items-center gap-3">
        <Loader2 :size="40" class="animate-spin text-secondary" />
        <p class="text-sm text-slate-500">Confirmando seu e-mail...</p>
      </div>

      <div v-else-if="estado === 'sucesso'" class="flex flex-col items-center gap-3">
        <CheckCircle2 :size="48" class="text-accent" />
        <h1 class="text-xl font-extrabold uppercase tracking-tight text-primary">E-mail confirmado!</h1>
        <p class="text-sm text-slate-500">Sua conta está verificada. Já pode se inscrever nos eventos.</p>
        <NuxtLink
          to="/"
          class="mt-2 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95"
        >
          Ver eventos
        </NuxtLink>
      </div>

      <div v-else class="flex flex-col items-center gap-3">
        <XCircle :size="48" class="text-red-500" />
        <h1 class="text-xl font-extrabold uppercase tracking-tight text-primary">Não deu certo</h1>
        <p class="text-sm text-slate-500">{{ mensagem || 'Esse link pode ter expirado ou já ter sido usado.' }}</p>

        <p v-if="reenviado" class="mt-2 text-sm text-accent">
          Reenviamos um novo link de verificação pro seu e-mail.
        </p>
        <button
          v-else-if="token"
          type="button"
          :disabled="reenviando"
          class="mt-2 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
          @click="onReenviar"
        >
          {{ reenviando ? 'Reenviando...' : 'Reenviar e-mail de verificação' }}
        </button>
        <NuxtLink v-else to="/login" class="mt-2 text-sm font-semibold text-secondary hover:underline">
          Fazer login pra reenviar o e-mail
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
