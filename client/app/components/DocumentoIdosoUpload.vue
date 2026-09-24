<script setup lang="ts">
import { Camera, CheckCircle, FileText, AlertTriangle } from 'lucide-vue-next'

// Botoes de envio do documento do desconto do idoso. A pagina de inscricao
// mostra isso em tres etapas; antes cada uma tinha sua copia, e duas voltaram
// a usar `capture="environment"`, que o conserto para o navegador do
// Instagram tinha tirado. Sem `capture`, o celular oferece camera ou galeria
// e o navegador embutido das redes sociais nao trava.
defineProps<{
  enviando: boolean
  enviado: boolean
  nomeArquivo?: string
  erro?: string
}>()

const emit = defineEmits<{ selecionar: [e: Event] }>()
</script>

<template>
  <div class="space-y-2">
    <div v-if="enviado" class="flex items-center gap-2 text-xs font-bold text-emerald-800">
      <CheckCircle class="w-4 h-4 shrink-0 text-emerald-600" />
      <span class="truncate">{{ nomeArquivo || 'Documento enviado' }}</span>
    </div>

    <div class="flex flex-wrap gap-2">
      <label
        class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold cursor-pointer hover:bg-orange-600 transition"
        :class="{ 'opacity-60 pointer-events-none': enviando }"
      >
        <Camera class="w-4 h-4" />
        <span>{{ enviando ? 'Enviando...' : (enviado ? 'Tirar outra foto' : 'Tirar foto agora') }}</span>
        <input type="file" accept="image/*" class="hidden" @change="emit('selecionar', $event)" />
      </label>
      <label
        class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 transition"
        :class="{ 'opacity-60 pointer-events-none': enviando }"
      >
        <FileText class="w-4 h-4" />
        <span>{{ enviado ? 'Trocar arquivo' : 'Escolher arquivo (PDF ou foto)' }}</span>
        <input type="file" accept="image/*,application/pdf" class="hidden" @change="emit('selecionar', $event)" />
      </label>
    </div>

    <p v-if="erro" class="flex items-start gap-1.5 text-xs font-semibold text-red-700">
      <AlertTriangle class="w-4 h-4 shrink-0 text-red-600" />
      <span>{{ erro }}</span>
    </p>
  </div>
</template>
