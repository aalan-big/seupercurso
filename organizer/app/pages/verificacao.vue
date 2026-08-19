<script setup lang="ts">
const { organizador, fetchMe, uploadFotoRosto, uploadDocumentoIdentidade } = useOrganizador()
const config = useRuntimeConfig()

const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const enviandoFoto = ref(false)
const enviandoDoc = ref(false)

const fotoArquivo = ref<File | null>(null)
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
  PENDENTE: { texto: '🟡 Em Análise pelo Administrador', classe: 'bg-amber-100 text-amber-900 font-bold' },
  APROVADO: { texto: '🟢 Perfil Aprovado & Liberado', classe: 'bg-emerald-100 text-emerald-900 font-bold' },
  REJEITADO: { texto: '🔴 Documentos Rejeitados', classe: 'bg-red-100 text-red-800 font-bold' },
  SUSPENSO: { texto: '⚪ Perfil Suspenso', classe: 'bg-slate-200 text-slate-700' }
}

const fotoRostoUrlFormatted = computed(() => {
  if (!organizador.value?.fotoRostoUrl) return null
  if (organizador.value.fotoRostoUrl.startsWith('http')) return organizador.value.fotoRostoUrl
  return `${config.public.apiBase}${organizador.value.fotoRostoUrl}`
})

const documentoUrlFormatted = computed(() => {
  if (!organizador.value?.documentoIdentidadeUrl) return null
  if (organizador.value.documentoIdentidadeUrl.startsWith('http')) return organizador.value.documentoIdentidadeUrl
  return `${config.public.apiBase}${organizador.value.documentoIdentidadeUrl}`
})

const ehPdf = computed(() => documentoUrlFormatted.value?.toLowerCase().endsWith('.pdf'))

function onSelecionarFoto(e: Event) {
  const input = e.target as HTMLInputElement
  fotoArquivo.value = input.files?.[0] ?? null
}

function onSelecionarDocumento(e: Event) {
  const input = e.target as HTMLInputElement
  documentoArquivo.value = input.files?.[0] ?? null
}

async function onEnviarFotoRosto() {
  if (!fotoArquivo.value) return
  erro.value = ''
  sucesso.value = ''
  enviandoFoto.value = true
  try {
    await uploadFotoRosto(fotoArquivo.value)
    fotoArquivo.value = null
    sucesso.value = 'Foto do rosto (selfie) enviada com sucesso!'
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    enviandoFoto.value = false
  }
}

async function onEnviarDocumento() {
  if (!documentoArquivo.value) return
  erro.value = ''
  sucesso.value = ''
  enviandoDoc.value = true
  try {
    await uploadDocumentoIdentidade(documentoArquivo.value)
    documentoArquivo.value = null
    sucesso.value = 'Documento oficial enviado com sucesso!'
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    enviandoDoc.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-4xl mx-auto">
    <!-- Cabeçalho Principal -->
    <div class="border-b border-slate-200 pb-5">
      <h1 class="text-2xl font-black uppercase tracking-tight text-primary">Verificação de Identidade (KYC)</h1>
      <p class="mt-1 text-xs text-slate-500">
        Para sua segurança e conformidade bancária, envie a foto do seu rosto (Selfie) e do seu documento oficial (RG ou CNH).
      </p>
    </div>

    <p v-if="carregando" class="py-8 text-center text-xs text-slate-400">Carregando dados da verificação...</p>

    <template v-else-if="organizador">
      <!-- Status Badge Card -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Status do Cadastro</p>
          <span
            class="inline-block rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-wide"
            :class="statusInfo[organizador.status]?.classe"
          >
            {{ statusInfo[organizador.status]?.texto || organizador.status }}
          </span>
        </div>

        <div v-if="organizador.status === 'APROVADO'" class="text-emerald-700 text-xs font-bold bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
          ✨ Seus documentos foram verificados! Você já pode publicar eventos e receber repasses.
        </div>
      </div>

      <!-- Alerta de Motivo de Rejeição se houver -->
      <div v-if="organizador.motivoRevisao" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 space-y-1">
        <p class="font-black text-sm">⚠️ Revisão Necessária pelo Administrador</p>
        <p><span class="font-bold">Motivo informado:</span> {{ organizador.motivoRevisao }}</p>
        <p class="text-[11px] text-red-600">Envie novamente as fotos corrigidas abaixo para reanálise imediata.</p>
      </div>

      <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
        ⚠️ {{ erro }}
      </p>
      <p v-if="sucesso" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
        ✅ {{ sucesso }}
      </p>

      <!-- Grid de Envio dos Documentos KYC -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Card 1: Foto do Rosto (Selfie) -->
        <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div class="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div class="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xl">
                📸
              </div>
              <div>
                <h3 class="font-black text-sm text-slate-900">1. Foto do Rosto (Selfie)</h3>
                <p class="text-[11px] text-slate-500">Tire uma foto nítida do seu rosto em local iluminado.</p>
              </div>
            </div>

            <!-- Preview Foto Rosto -->
            <div class="mt-4 flex flex-col items-center justify-center">
              <div v-if="fotoRostoUrlFormatted" class="relative overflow-hidden rounded-2xl border-2 border-indigo-100 bg-slate-50 p-2 shadow-xs">
                <img :src="fotoRostoUrlFormatted" alt="Foto do Rosto" class="h-44 w-44 rounded-xl object-cover" />
                <span class="absolute bottom-3 right-3 rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[9px] font-bold shadow">
                  ✅ Enviado
                </span>
              </div>
              <div v-else class="h-44 w-44 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-2 p-4 text-center">
                <span class="text-3xl">👤</span>
                <span class="text-xs font-bold text-slate-500">Nenhuma foto enviada</span>
              </div>
            </div>
          </div>

          <!-- Input Upload Foto Rosto -->
          <div class="space-y-3 pt-3 border-t border-slate-100">
            <input
              type="file"
              accept="image/*"
              class="block w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 py-1.5 file:py-2 file:text-xs file:font-bold file:text-slate-700 hover:file:bg-slate-200 transition"
              @change="onSelecionarFoto"
            />
            <button
              type="button"
              :disabled="!fotoArquivo || enviandoFoto"
              class="w-full rounded-xl bg-slate-900 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:bg-primary transition disabled:opacity-40"
              @click="onEnviarFotoRosto"
            >
              {{ enviandoFoto ? 'Enviando Selfie...' : '💾 Salvar Foto do Rosto' }}
            </button>
          </div>
        </div>

        <!-- Card 2: Documento de Identidade (RG ou CNH) -->
        <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div class="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div class="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 font-bold flex items-center justify-center text-xl">
                📄
              </div>
              <div>
                <h3 class="font-black text-sm text-slate-900">2. Documento Oficial (RG/CNH)</h3>
                <p class="text-[11px] text-slate-500">Envie foto da frente/verso ou PDF do documento.</p>
              </div>
            </div>

            <!-- Preview Documento -->
            <div class="mt-4 flex flex-col items-center justify-center">
              <div v-if="documentoUrlFormatted" class="relative overflow-hidden rounded-2xl border-2 border-amber-100 bg-slate-50 p-2 shadow-xs w-full flex justify-center">
                <a v-if="ehPdf" :href="documentoUrlFormatted" target="_blank" rel="noopener" class="h-44 w-full rounded-xl bg-amber-50 border border-amber-200 flex flex-col items-center justify-center text-amber-800 font-bold text-xs gap-2">
                  <span class="text-4xl">📄</span>
                  <span>Ver Documento em PDF</span>
                </a>
                <img v-else :src="documentoUrlFormatted" alt="Documento de Identidade" class="h-44 w-full rounded-xl object-contain bg-slate-900/5" />
                <span class="absolute bottom-3 right-3 rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[9px] font-bold shadow">
                  ✅ Enviado
                </span>
              </div>
              <div v-else class="h-44 w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-2 p-4 text-center">
                <span class="text-3xl">💳</span>
                <span class="text-xs font-bold text-slate-500">Nenhum documento enviado</span>
              </div>
            </div>
          </div>

          <!-- Input Upload Documento -->
          <div class="space-y-3 pt-3 border-t border-slate-100">
            <input
              type="file"
              accept="image/*,application/pdf"
              class="block w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 py-1.5 file:py-2 file:text-xs file:font-bold file:text-slate-700 hover:file:bg-slate-200 transition"
              @change="onSelecionarDocumento"
            />
            <button
              type="button"
              :disabled="!documentoArquivo || enviandoDoc"
              class="w-full rounded-xl bg-slate-900 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:bg-primary transition disabled:opacity-40"
              @click="onEnviarDocumento"
            >
              {{ enviandoDoc ? 'Enviando Documento...' : '💾 Salvar Documento Oficial' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
