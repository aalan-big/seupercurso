<script setup lang="ts">
import { Cookie } from 'lucide-vue-next'

// So cookies essenciais (login e carrinho): nao ha o que aceitar ou recusar,
// entao o aviso e informativo. "Entendi" grava no navegador e ele nao volta.
// Renderiza so no cliente para nao piscar no SSR nem aparecer para quem ja
// confirmou.
const CHAVE = 'seupercurso_aviso_cookies'

const visivel = ref(false)

onMounted(() => {
  try {
    visivel.value = localStorage.getItem(CHAVE) !== '1'
  } catch {
    // navegador bloqueando storage: mostra o aviso mesmo assim
    visivel.value = true
  }
})

function entendi() {
  visivel.value = false
  try {
    localStorage.setItem(CHAVE, '1')
  } catch {}
}
</script>

<template>
  <Transition name="aviso-cookies">
    <div
      v-if="visivel"
      role="dialog"
      aria-label="Aviso sobre cookies"
      class="fixed inset-x-0 bottom-0 z-[200] px-3 pb-3 sm:px-4 sm:pb-4"
      style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom))"
    >
      <div class="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div class="flex items-start gap-3">
          <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Cookie class="h-4 w-4" />
          </span>
          <p class="text-xs leading-relaxed text-slate-600 sm:text-sm">
            Usamos apenas cookies <strong class="text-slate-800">essenciais</strong> para manter você logado e guardar sua inscrição em andamento. Sem rastreamento nem publicidade.
            <NuxtLink to="/privacidade" class="font-bold text-orange-600 hover:underline">Saiba mais</NuxtLink>.
          </p>
        </div>
        <button
          type="button"
          class="w-full shrink-0 rounded-xl bg-orange-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-orange-600 sm:w-auto"
          @click="entendi"
        >
          Entendi
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.aviso-cookies-enter-active,
.aviso-cookies-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.aviso-cookies-enter-from,
.aviso-cookies-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
