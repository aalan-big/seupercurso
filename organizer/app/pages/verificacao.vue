<script setup lang="ts">
const { organizador, fetchMe, uploadDocumentoIdentidade } = useOrganizador()
const config = useRuntimeConfig()

const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const enviando = ref(false)
const documentoArquivo = ref<File | null>(null)

onMounted(async () => {
  try {
    await fetchMe()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

const statusInfo: Record<string, { texto: string; classe: string }> = {
  PENDENTE: { texto: 'Em análise', classe: 'bg-warning/10 text-warning' },
  APROVADO: { texto: 'Aprovado', classe: 'bg-accent/10 text-accent' },
  REJEITADO: { texto: 'Rejeitado', classe: 'bg-red-100 text-red-700' },
  SUSPENSO: { texto: 'Suspenso', classe: 'bg-slate-200 text-slate-600' }
}

const documentoUrl = computed(() => {
  if (!organizador.value?.documentoIdentidadeUrl) return null
  return `${config.public.apiBase}${organizador.value.documentoIdentidadeUrl}`
})

const ehPdf = computed(() => documentoUrl.value?.toLowerCase().endsWith('.pdf'))

function onSelecionarDocumento(e: Event) {
  const input = e.target as HTMLInputElement
  documentoArquivo.value = input.files?.[0] ?? null
}

async function onReenviar() {
  erro.value = ''
  sucesso.value = ''

  if (!documentoArquivo.value) {
    erro.value = 'Selecione um arquivo pra enviar.'
    return
  }

  enviando.value = true
  try {
    await uploadDocumentoIdentidade(documentoArquivo.value)
    documentoArquivo.value = null
    sucesso.value = 'Documento enviado. Assim que revisarmos, o status é atualizado aqui.'
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Verificação de conta</h1>
    <p class="mt-1 text-sm text-slate-500">Status do seu cadastro e do documento de identidade enviado.</p>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="organizador">
      <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span
          class="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          :class="statusInfo[organizador.status]?.classe"
        >
          {{ statusInfo[organizador.status]?.texto || organizador.status }}
        </span>

        <p v-if="organizador.motivoRevisao" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span class="font-semibold">Motivo:</span> {{ organizador.motivoRevisao }}
        </p>

        <div class="mt-4">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Documento enviado</p>
          <div v-if="!documentoUrl" class="mt-2 text-sm text-slate-500">Nenhum documento enviado ainda.</div>
          <a v-else-if="ehPdf" :href="documentoUrl" target="_blank" rel="noopener" class="mt-2 inline-block text-sm font-semibold text-secondary hover:underline">
            📄 Ver documento (PDF)
          </a>
          <a v-else :href="documentoUrl" target="_blank" rel="noopener" class="mt-2 block">
            <img :src="documentoUrl" alt="Documento de identidade" class="max-h-64 rounded-lg border border-slate-200 object-contain" />
          </a>
        </div>

        <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ erro }}</p>
        <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{{ sucesso }}</p>

        <div class="mt-6 border-t border-slate-100 pt-4">
          <label class="mb-1 block text-sm font-semibold text-slate-700">
            {{ documentoUrl ? 'Reenviar documento (RG ou CNH, foto ou PDF)' : 'Enviar documento (RG ou CNH, foto ou PDF)' }}
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            class="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            @change="onSelecionarDocumento"
          />
          <p v-if="documentoArquivo" class="mt-2 text-xs text-slate-500">Selecionado: {{ documentoArquivo.name }}</p>
          <button
            type="button"
            :disabled="enviando"
            class="mt-3 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
            @click="onReenviar"
          >
            {{ enviando ? 'Enviando...' : 'Enviar' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
