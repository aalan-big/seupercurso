<script setup lang="ts">
import { CheckCircle, XCircle, Circle, Clock, Lock } from 'lucide-vue-next'

const { organizador, fetchMe, uploadFotoRosto, uploadDocumentoIdentidade } = useOrganizador()
const config = useRuntimeConfig()

const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const enviandoFoto = ref(false)
const enviandoDoc = ref(false)

const fotoArquivo = ref<File | null>(null)
const documentoArquivo = ref<File | null>(null)
const mostrarLiveness = ref(false)

onMounted(async () => {
  try {
    await fetchMe()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

const statusInfo: Record<string, { texto: string; classe: string; icone: any }> = {
  PENDENTE: { texto: 'Em Análise', classe: 'bg-amber-50 text-amber-800 border-amber-200', icone: Clock },
  APROVADO: { texto: 'Perfil Aprovado', classe: 'bg-emerald-50 text-emerald-800 border-emerald-200', icone: CheckCircle },
  REJEITADO: { texto: 'Documentos Rejeitados', classe: 'bg-red-50 text-red-800 border-red-200', icone: XCircle },
  SUSPENSO: { texto: 'Perfil Suspenso', classe: 'bg-slate-100 text-slate-700 border-slate-200', icone: Circle }
}

const fotoRostoUrlFormatted = computed(() => {
  return urlFoto(organizador.value?.fotoRostoUrl, config.public.apiBase as string)
})

const documentoUrlFormatted = computed(() => {
  return urlFoto(organizador.value?.documentoIdentidadeUrl, config.public.apiBase as string)
})


const ehPdf = computed(() => documentoUrlFormatted.value?.toLowerCase().endsWith('.pdf'))

const bloqueadoParaEnvio = computed(() => {
  if (!organizador.value) return false
  if (organizador.value.status === 'APROVADO') return true
  if (organizador.value.status === 'REJEITADO') return false
  return !!(organizador.value.fotoRostoUrl && organizador.value.documentoIdentidadeUrl)
})


function onSelecionarDocumento(e: Event) {
  const input = e.target as HTMLInputElement
  documentoArquivo.value = input.files?.[0] ?? null
}

function onFotoLivenessCapturada(file: File) {
  fotoArquivo.value = file
  mostrarLiveness.value = false
  sucesso.value = 'Selfie biométrica capturada com sucesso!'
}

async function onEnviarFotoRosto() {
  if (!fotoArquivo.value) return
  erro.value = ''
  sucesso.value = ''
  enviandoFoto.value = true
  try {
    await uploadFotoRosto(fotoArquivo.value)
    fotoArquivo.value = null
    sucesso.value = 'Foto do rosto enviada para análise!'
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
  <div class="space-y-6 max-w-3xl mx-auto pb-12">
    <!-- Cabeçalho Clean & Bancário -->
    <div class="space-y-2 border-b border-slate-200/80 pb-5">
      <div class="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600 border border-amber-500/20">
        <AppIcon name="verificacao" size="14" class="text-amber-600" /> Segurança & Proteção de Dados
      </div>

      <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Verificação de Identidade (KYC)</h1>
      <p class="text-xs text-slate-500 leading-relaxed max-w-xl">
        Conclua a validação do seu perfil enviando a foto do seu rosto e documento oficial para liberação de criação de eventos.
      </p>
    </div>

    <!-- State: Carregando -->
    <div v-if="carregando" class="py-12 text-center text-xs text-slate-400 animate-pulse">
      Carregando status de verificação...
    </div>

    <template v-else-if="organizador">
      <!-- Status Card Clean -->
      <div class="rounded-2xl border bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        :class="statusInfo[organizador.status]?.classe || 'border-slate-200'"
      >
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold shrink-0">
            <component :is="statusInfo[organizador.status]?.icone" v-if="statusInfo[organizador.status]?.icone" :size="20" />
            <AppIcon v-else name="verificacao" size="20" class="text-slate-700" />
          </div>
          <div>
            <p class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Status do Cadastro</p>
            <p class="text-sm font-black text-slate-900">
              {{ statusInfo[organizador.status]?.texto || organizador.status }}
            </p>
          </div>
        </div>

        <div v-if="organizador.status === 'APROVADO'" class="text-emerald-700 text-xs font-bold bg-emerald-100/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
          <AppIcon name="check" size="14" /> Perfil Ativo & Liberado
        </div>
        <div v-else-if="organizador.fotoRostoUrl && organizador.documentoIdentidadeUrl" class="text-amber-800 text-xs font-bold bg-amber-100/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
          <AppIcon name="documento" size="14" /> Documentos sob análise
        </div>
        <div v-else class="text-slate-600 text-xs font-semibold bg-slate-100 px-3 py-1.5 rounded-xl">
          Aguardando envio dos documentos
        </div>
      </div>

      <!-- Alerta de Revisão se Rejeitado -->
      <div v-if="organizador.motivoRevisao" class="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-900 space-y-1">
        <p class="font-black text-sm flex items-center gap-1.5">
          <AppIcon name="warning" size="16" class="text-red-600" /> Necessário Reenviar Documentação
        </p>
        <p><span class="font-bold">Observação do Administrador:</span> {{ organizador.motivoRevisao }}</p>
      </div>

      <!-- Alerta de Bloqueio de Reenvio enquanto em Análise -->
      <div v-if="bloqueadoParaEnvio && organizador.status !== 'APROVADO'" class="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
        <p class="font-black text-sm flex items-center gap-2 text-amber-950">
          <AppIcon name="lock" size="16" class="text-amber-700" /> Documentação Protocolada em Análise
        </p>
        <p class="text-[11px] text-amber-800 leading-relaxed">
          Seus documentos já foram recebidos com sucesso e estão em análise pela Administração Master. O envio de novos arquivos fica bloqueado a menos que o Administrador solicite alguma correção.
        </p>
      </div>

      <!-- Alertas de Feedback -->
      <div v-if="erro" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
        <AppIcon name="warning" size="16" class="text-red-600" /> {{ erro }}
      </div>
      <div v-if="sucesso" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
        <AppIcon name="check" size="16" class="text-emerald-600" /> {{ sucesso }}
      </div>

      <!-- Seção de Uploads (Grid Responsivo Clean) -->
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">

        <!-- Card 1: Reconhecimento Facial (Selfie) -->
        <div class="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between space-y-5">
          <div class="space-y-4">
            <div class="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div class="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-lg shrink-0">
                <AppIcon name="user" size="18" class="text-indigo-600" />
              </div>
              <div>
                <h3 class="font-bold text-sm text-slate-900">1. Foto do Rosto (Selfie)</h3>
                <p class="text-[11px] text-slate-500">Validação biométrica ao vivo pela câmera.</p>
              </div>
            </div>

            <!-- Frame / Preview da Foto -->
            <div class="flex flex-col items-center justify-center py-2">
              <!-- Se foto já salva no servidor -->
              <div v-if="fotoRostoUrlFormatted && !fotoArquivo" class="relative group">
                <img :src="fotoRostoUrlFormatted" alt="Foto do Rosto" class="h-36 w-36 rounded-full object-cover border-4 border-indigo-50 shadow-md" />
                <span class="absolute bottom-1 right-1 rounded-full bg-emerald-500 text-white p-1 shadow-md text-xs">
                  <AppIcon name="check" size="12" />
                </span>
              </div>

              <!-- Se foto capturada agora mas não salva -->
              <div v-else-if="fotoArquivo" class="flex flex-col items-center space-y-2">
                <div class="h-36 w-36 rounded-full bg-indigo-50 border-4 border-emerald-400 flex items-center justify-center text-emerald-600 shadow-md">
                  <AppIcon name="camera" size="32" class="text-indigo-600" />
                </div>
                <span class="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <AppIcon name="check" size="12" /> Selfie Capturada
                </span>
              </div>

              <!-- Se nada enviado ainda -->
              <div v-else class="h-36 w-36 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-1 text-center p-3">
                <AppIcon name="user" size="32" class="text-slate-300" />
                <span class="text-[11px] font-medium text-slate-400">Nenhuma selfie</span>
              </div>
            </div>
          </div>

          <!-- Ação Única e Limpa para Selfie -->
          <div class="space-y-2 pt-3 border-t border-slate-100">
            <!-- Botão de Abertura da Câmera -->
            <button
              v-if="!bloqueadoParaEnvio"
              type="button"
              class="w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:brightness-105 active:scale-[0.99] py-3.5 px-4 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition-all flex items-center justify-center gap-2.5"
              @click="mostrarLiveness = true"
            >
              <AppIcon name="camera" size="18" class="text-white" /> {{ (fotoRostoUrlFormatted || fotoArquivo) ? 'Refazer Selfie Ao Vivo' : 'Tirar Selfie Ao Vivo' }}
            </button>

            <!-- Botão de Salvar Foto se houver nova captura -->
            <button
              v-if="fotoArquivo && !bloqueadoParaEnvio"
              type="button"
              :disabled="enviandoFoto"
              class="w-full rounded-2xl bg-slate-900 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:bg-primary transition disabled:opacity-40"
              @click="onEnviarFotoRosto"
            >
              {{ enviandoFoto ? 'Enviando Selfie...' : 'Enviar Selfie para Análise' }}
            </button>

            <div v-if="bloqueadoParaEnvio" class="text-center py-2 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center justify-center gap-1.5">
              <Lock :size="14" class="text-slate-500" /> Envio bloqueado (em análise)
            </div>
          </div>
        </div>

        <!-- Card 2: Documento Oficial (RG / CNH) -->
        <div class="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between space-y-5">
          <div class="space-y-4">
            <div class="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div class="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 font-bold flex items-center justify-center text-lg shrink-0">
                <AppIcon name="documento" size="18" class="text-amber-600" />
              </div>
              <div>
                <h3 class="font-bold text-sm text-slate-900">2. Documento Oficial (RG/CNH)</h3>
                <p class="text-[11px] text-slate-500">Foto da frente/verso ou arquivo PDF.</p>
              </div>
            </div>

            <!-- Preview do Documento -->
            <div class="flex flex-col items-center justify-center py-2">
              <div v-if="documentoUrlFormatted && !documentoArquivo" class="w-full">
                <a v-if="ehPdf" :href="documentoUrlFormatted" target="_blank" rel="noopener" class="h-36 w-full rounded-2xl bg-amber-50 border border-amber-200 flex flex-col items-center justify-center text-amber-800 font-bold text-xs gap-1.5 hover:bg-amber-100/60 transition">
                  <AppIcon name="documento" size="28" class="text-amber-700" />
                  <span>Ver Documento (PDF)</span>
                </a>
                <div v-else class="relative h-36 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img :src="documentoUrlFormatted" alt="Documento" class="h-full w-full object-contain p-2" />
                  <span class="absolute bottom-2 right-2 rounded-full bg-emerald-500 text-white p-1 shadow">
                    <AppIcon name="check" size="10" />
                  </span>
                </div>
              </div>

              <div v-else-if="documentoArquivo" class="h-36 w-full rounded-2xl bg-amber-50 border border-amber-300 flex flex-col items-center justify-center text-amber-900 text-xs font-bold space-y-1 p-3 text-center">
                <AppIcon name="documento" size="28" class="text-amber-700" />
                <span class="truncate max-w-full">{{ documentoArquivo.name }}</span>
                <span class="text-[10px] text-amber-700 font-normal">Pronto para enviar</span>
              </div>

              <div v-else class="h-36 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-1 text-center p-3">
                <AppIcon name="documento" size="32" class="text-slate-300" />
                <span class="text-[11px] font-medium text-slate-400">Nenhum documento</span>
              </div>
            </div>
          </div>

          <!-- Input Upload Documento -->
          <div class="space-y-2 pt-3 border-t border-slate-100">
            <label v-if="!bloqueadoParaEnvio" class="w-full cursor-pointer rounded-2xl bg-slate-100 py-3 text-center text-xs font-bold text-slate-700 hover:bg-slate-200 transition flex items-center justify-center gap-2">
              <AppIcon name="documento" size="16" /> {{ documentoArquivo ? 'Alterar Documento' : 'Selecionar Foto ou PDF' }}
              <input
                type="file"
                accept="image/*,application/pdf"
                class="hidden"
                @change="onSelecionarDocumento"
              />
            </label>

            <button
              v-if="documentoArquivo && !bloqueadoParaEnvio"
              type="button"
              :disabled="enviandoDoc"
              class="w-full rounded-2xl bg-slate-900 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:bg-primary transition disabled:opacity-40"
              @click="onEnviarDocumento"
            >
              {{ enviandoDoc ? 'Enviando Documento...' : 'Enviar Documento Oficial' }}
            </button>

            <div v-if="bloqueadoParaEnvio" class="text-center py-2 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center justify-center gap-1.5">
              <Lock :size="14" class="text-slate-500" /> Envio bloqueado (em análise)
            </div>
          </div>
        </div>




      </div>
    </template>

    <!-- Componente de Prova de Vida 3D Ao Vivo -->
    <LivenessCamera
      v-if="mostrarLiveness"
      @capturado="onFotoLivenessCapturada"
      @fechar="mostrarLiveness = false"
    />
  </div>
</template>
