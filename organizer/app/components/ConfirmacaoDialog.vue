<script setup lang="ts">
import { AlertTriangle, Info } from 'lucide-vue-next'

const { estado, responder } = useConfirmacao()

function onTecla(e: KeyboardEvent) {
  if (estado.value.aberto && e.key === 'Escape') responder(false)
}

onMounted(() => window.addEventListener('keydown', onTecla))
onBeforeUnmount(() => window.removeEventListener('keydown', onTecla))
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div
        v-if="estado.aberto"
        class="fixed inset-0 z-[500] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" @click="responder(false)"></div>

        <div class="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
          <div class="flex items-start gap-3.5">
            <div
              class="rounded-2xl p-3 shrink-0"
              :class="estado.perigo ? 'bg-red-100 text-red-700' : estado.somenteAviso ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'"
            >
              <Info v-if="estado.somenteAviso" :size="22" />
              <AlertTriangle v-else :size="22" />
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-extrabold text-slate-900 leading-tight">{{ estado.titulo }}</h3>
              <p class="mt-1.5 text-sm text-slate-600 whitespace-pre-line">{{ estado.mensagem }}</p>
            </div>
          </div>

          <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              v-if="!estado.somenteAviso"
              type="button"
              class="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              @click="responder(false)"
            >
              {{ estado.textoCancelar || 'Cancelar' }}
            </button>
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition cursor-pointer"
              :class="estado.perigo ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-warning text-primary hover:brightness-95'"
              @click="responder(true)"
            >
              {{ estado.textoConfirmar || 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>
