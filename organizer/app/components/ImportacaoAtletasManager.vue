<script setup lang="ts">
import { AlertTriangle, CheckCircle, Download, FileSpreadsheet, History, Undo2, X } from 'lucide-vue-next'
import type { ImportacaoFeita, PreviaImportacao, LinhaImportacao } from '../composables/useImportacaoAtletas'

const props = defineProps<{ eventoId: string }>()

const { listar, previa, confirmar, desfazer, baixarModelo } = useImportacaoAtletas()
const { confirmar: confirmarDialogo } = useConfirmacao()

const historico = ref<ImportacaoFeita[]>([])
const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')

const arquivo = ref<File | null>(null)
const inputArquivoRef = ref<HTMLInputElement | null>(null)
const analise = ref<PreviaImportacao | null>(null)
const mapeamento = reactive<Record<string, string>>({})
const analisando = ref(false)
const importando = ref(false)
const siteOrigem = ref('')
const autorizacao = ref(false)
const soComProblema = ref(false)

const LIMITE_LINHAS_TELA = 300
const SITES_COMUNS = ['Ticket Sports', 'Sympla', 'Central da Corrida', 'Doity', 'Minhas Inscrições', 'Ativo.com']

async function carregarHistorico() {
  try {
    historico.value = (await listar(props.eventoId)).importacoes
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(carregarHistorico)

async function analisar() {
  if (!arquivo.value) return
  analisando.value = true
  erro.value = ''
  try {
    analise.value = await previa(props.eventoId, arquivo.value, { ...mapeamento })
  } catch (e) {
    analise.value = null
    erro.value = extrairErro(e)
  } finally {
    analisando.value = false
  }
}

async function onArquivoSelecionado(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  arquivo.value = file
  sucesso.value = ''
  autorizacao.value = false
  for (const chave of Object.keys(mapeamento)) delete mapeamento[chave]
  await analisar()
  if (inputArquivoRef.value) inputArquivoRef.value.value = ''
}

function escolherDestino(chave: string, valor: string) {
  if (valor) mapeamento[chave] = valor
  else delete mapeamento[chave]
  analisar()
}

function cancelarArquivo() {
  arquivo.value = null
  analise.value = null
  autorizacao.value = false
}

// Opcoes do select de cada grupo: por percurso, "automatico pela idade e sexo"
// e cada categoria. PCD e servidor ficam marcados para nao serem escolhidos
// por engano.
const opcoesPorModalidade = computed(() => {
  const mapa = new Map<string, { id: string; nome: string; categorias: { id: string; nome: string }[] }>()
  for (const c of analise.value?.categorias ?? []) {
    if (!mapa.has(c.modalidadeId)) mapa.set(c.modalidadeId, { id: c.modalidadeId, nome: c.modalidadeNome, categorias: [] })
    const sufixo = c.pcd ? ' (PCD)' : c.servidorPublico ? ' (servidor público)' : ''
    mapa.get(c.modalidadeId)!.categorias.push({ id: c.id, nome: c.nome + sufixo })
  }
  return [...mapa.values()]
})

const linhasVisiveis = computed<LinhaImportacao[]>(() => {
  const todas = analise.value?.linhas ?? []
  const filtradas = soComProblema.value ? todas.filter((l) => l.erros.length || l.avisos.length) : todas
  return filtradas.slice(0, LIMITE_LINHAS_TELA)
})

const totalFiltrado = computed(() => {
  const todas = analise.value?.linhas ?? []
  return soComProblema.value ? todas.filter((l) => l.erros.length || l.avisos.length).length : todas.length
})

const podeImportar = computed(
  () =>
    !!analise.value &&
    analise.value.resumo.validas > 0 &&
    autorizacao.value &&
    siteOrigem.value.trim().length > 0 &&
    !analisando.value &&
    !importando.value
)

async function onImportar() {
  if (!analise.value || !arquivo.value) return
  const { validas, comErro } = analise.value.resumo
  const ok = await confirmarDialogo({
    titulo: 'Importar atletas',
    mensagem:
      `${validas} atleta(s) vão entrar na lista de inscritos como "Importado – ${siteOrigem.value.trim()}".` +
      (comErro ? ` ${comErro} linha(s) com problema ficam de fora.` : '') +
      ' Eles ocupam vaga do evento. Se precisar, dá para desfazer depois (enquanto nenhum kit for entregue).',
    textoConfirmar: `Importar ${validas}`
  })
  if (!ok) return

  importando.value = true
  erro.value = ''
  try {
    const res = await confirmar(props.eventoId, arquivo.value, {
      siteOrigem: siteOrigem.value.trim(),
      mapeamento: { ...mapeamento },
      esperados: validas
    })
    sucesso.value = `${res.importados} atleta(s) importado(s) com sucesso!` +
      (res.ignorados ? ` ${res.ignorados} linha(s) com problema ficaram de fora.` : '')
    cancelarArquivo()
    await carregarHistorico()
  } catch (e: any) {
    erro.value = extrairErro(e)
    // A lista mudou desde a revisao (alguem comprou, acabou vaga): revisa de novo.
    if (e?.statusCode === 409 || e?.response?.status === 409) await analisar()
  } finally {
    importando.value = false
  }
}

async function onDesfazer(imp: ImportacaoFeita) {
  const ok = await confirmarDialogo({
    titulo: 'Desfazer importação',
    mensagem: `Os ${imp.ativos} atleta(s) desta importação (${imp.siteOrigem}) saem da lista de inscritos e as vagas voltam. Nada é apagado: as inscrições ficam como canceladas.`,
    textoConfirmar: 'Desfazer',
    perigo: true
  })
  if (!ok) return
  erro.value = ''
  try {
    const res = await desfazer(props.eventoId, imp.id)
    sucesso.value = `Importação desfeita: ${res.canceladas} inscrição(ões) cancelada(s).`
    await carregarHistorico()
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

function formatarCpf(val: string) {
  const d = (val || '').replace(/\D/g, '')
  if (d.length !== 11) return val || '-'
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatarNascimento(val: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : val || '-'
}

function formatarSexo(val: string) {
  return val === 'MASCULINO' ? 'M' : val === 'FEMININO' ? 'F' : val === 'OUTRO' ? 'Outro' : val || '-'
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Importar atletas de outro site</h2>
      <p class="mt-1 text-xs text-slate-400">
        Vendeu inscrições em outro site? Envie a planilha desses atletas e eles entram na sua lista de inscritos, junto com
        quem comprou aqui: entrega de kit, número de peito, chip, resultado e certificado. Não há pagamento nem taxa.
        Os importados ocupam vaga do evento.
      </p>

      <!-- Passo 1: arquivo -->
      <div v-if="!arquivo" class="mt-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 text-center">
        <input
          ref="inputArquivoRef"
          type="file"
          accept=".xlsx,.csv,.txt"
          class="hidden"
          @change="onArquivoSelecionado"
        />
        <div class="flex flex-col items-center justify-center gap-2">
          <FileSpreadsheet :size="30" class="text-slate-400" />
          <p class="text-xs font-bold text-slate-700">Selecione a planilha com os atletas (Excel .xlsx ou CSV)</p>
          <p class="text-[11px] text-slate-400">
            Precisa ter pelo menos as colunas Nome, CPF, Data de nascimento e Sexo. Modalidade, categoria, camisa,
            nº de peito e e-mail são opcionais. Pode ser a planilha exportada pelo outro site.
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              :disabled="analisando"
              class="rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition disabled:opacity-50"
              @click="inputArquivoRef?.click()"
            >
              {{ analisando ? 'Lendo planilha...' : 'Selecionar planilha' }}
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              @click="baixarModelo"
            >
              <Download :size="14" /> Baixar planilha modelo
            </button>
          </div>
        </div>
      </div>

      <!-- Passo 2: revisao -->
      <template v-else>
        <div class="mt-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span class="flex items-center gap-1.5 truncate text-xs font-bold text-slate-700">
            <FileSpreadsheet :size="14" class="shrink-0" /> {{ arquivo.name }}
          </span>
          <button type="button" class="text-[11px] font-bold text-slate-500 hover:text-slate-800" @click="cancelarArquivo">
            Trocar arquivo
          </button>
        </div>

        <p v-if="analisando && !analise" class="mt-4 text-sm text-slate-500">Lendo planilha...</p>

        <template v-if="analise">
          <div class="mt-4 grid grid-cols-3 gap-2" :class="{ 'opacity-60': analisando }">
            <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
              <p class="text-[10px] font-bold uppercase text-slate-400">Na planilha</p>
              <p class="text-lg font-black text-slate-800">{{ analise.resumo.total }}</p>
            </div>
            <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p class="text-[10px] font-bold uppercase text-emerald-700">Prontos</p>
              <p class="text-lg font-black text-emerald-700">{{ analise.resumo.validas }}</p>
            </div>
            <div class="rounded-xl bg-red-50 border border-red-200 p-3 text-center">
              <p class="text-[10px] font-bold uppercase text-red-700">Com problema</p>
              <p class="text-lg font-black text-red-700">{{ analise.resumo.comErro }}</p>
            </div>
          </div>

          <!-- Modalidade/categoria de cada grupo da planilha -->
          <div class="mt-5">
            <h3 class="text-xs font-bold uppercase tracking-wide text-slate-600">Percurso e categoria</h3>
            <p class="mt-0.5 text-[11px] text-slate-400">
              Diga para onde vai cada grupo da planilha. "Pela idade e sexo" escolhe a categoria de cada atleta sozinho.
            </p>
            <div class="mt-2 space-y-2">
              <div
                v-for="g in analise.grupos"
                :key="g.chave"
                class="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                :class="g.destino ? 'border-slate-200' : 'border-amber-300 bg-amber-50/60'"
              >
                <div class="min-w-0 text-xs">
                  <span class="font-bold text-slate-800">
                    {{ g.modalidade || '(sem modalidade)' }}{{ g.categoria ? ` / ${g.categoria}` : '' }}
                  </span>
                  <span class="text-slate-400"> · {{ g.quantidade }} atleta(s)</span>
                </div>
                <select
                  :value="g.destino ?? ''"
                  :disabled="analisando"
                  class="w-full sm:w-72 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                  @change="escolherDestino(g.chave, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Escolha...</option>
                  <optgroup v-for="m in opcoesPorModalidade" :key="m.id" :label="m.nome">
                    <option :value="`auto:${m.id}`">{{ m.nome }} · pela idade e sexo</option>
                    <option v-for="c in m.categorias" :key="c.id" :value="c.id">{{ m.nome }} · {{ c.nome }}</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          <!-- Linhas -->
          <div class="mt-5">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-xs font-bold uppercase tracking-wide text-slate-600">Atletas</h3>
              <label class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                <input v-model="soComProblema" type="checkbox" class="h-3.5 w-3.5 rounded" />
                Só os com problema
              </label>
            </div>
            <div class="mt-2 max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
              <table class="w-full text-left text-xs">
                <thead class="sticky top-0 bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                  <tr>
                    <th class="px-3 py-2">Linha</th>
                    <th class="px-3 py-2">Atleta</th>
                    <th class="px-3 py-2">Nasc. / Sexo</th>
                    <th class="px-3 py-2">Categoria</th>
                    <th class="px-3 py-2">Camisa / Peito</th>
                    <th class="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="l in linhasVisiveis" :key="l.linha" :class="l.erros.length ? 'bg-red-50/40' : ''">
                    <td class="px-3 py-2 font-mono text-slate-400">{{ l.linha }}</td>
                    <td class="px-3 py-2">
                      <div class="font-bold text-slate-800">{{ l.nome || '-' }}</div>
                      <div class="font-mono text-[11px] text-slate-500">{{ formatarCpf(l.cpf) }}</div>
                    </td>
                    <td class="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {{ formatarNascimento(l.dataNascimento) }} · {{ formatarSexo(l.genero) }}
                    </td>
                    <td class="px-3 py-2 text-slate-600">
                      {{ l.categoriaNome ? `${l.modalidadeNome} · ${l.categoriaNome}` : '-' }}
                    </td>
                    <td class="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {{ l.tamanhoCamisa || '-' }} / {{ l.numeroPeito || '-' }}
                    </td>
                    <td class="px-3 py-2">
                      <span
                        v-if="!l.erros.length"
                        class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                      >
                        <CheckCircle :size="11" /> Pronto
                      </span>
                      <ul v-if="l.erros.length" class="space-y-0.5 text-[11px] font-semibold text-red-700">
                        <li v-for="msg in l.erros" :key="msg">{{ msg }}</li>
                      </ul>
                      <ul v-if="l.avisos.length" class="mt-0.5 space-y-0.5 text-[11px] font-semibold text-amber-700">
                        <li v-for="msg in l.avisos" :key="msg">{{ msg }}</li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!linhasVisiveis.length" class="p-6 text-center text-xs text-slate-400">Nenhuma linha com problema.</p>
            </div>
            <p v-if="totalFiltrado > LIMITE_LINHAS_TELA" class="mt-1 text-[11px] text-slate-400">
              Mostrando {{ LIMITE_LINHAS_TELA }} de {{ totalFiltrado }} linhas. Todas são importadas.
            </p>
          </div>

          <!-- Confirmacao -->
          <div class="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5">
                Em qual site esses atletas compraram?
              </label>
              <input
                v-model="siteOrigem"
                list="sites-origem-importacao"
                type="text"
                maxlength="60"
                placeholder="Ex: Ticket Sports"
                class="w-full sm:w-72 rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <datalist id="sites-origem-importacao">
                <option v-for="s in SITES_COMUNS" :key="s" :value="s" />
              </datalist>
            </div>

            <label class="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
              <input v-model="autorizacao" type="checkbox" class="mt-0.5 h-4 w-4 rounded" />
              <span>
                Confirmo que estes atletas se inscreveram no meu evento e autorizaram o uso dos dados (nome, CPF,
                nascimento e e-mail) para a inscrição.
              </span>
            </label>

            <button
              type="button"
              :disabled="!podeImportar"
              class="w-full sm:w-auto rounded-xl bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:opacity-90 disabled:opacity-40"
              @click="onImportar"
            >
              {{ importando ? 'Importando...' : `Importar ${analise.resumo.validas} atleta(s)` }}
            </button>
          </div>
        </template>
      </template>

      <div v-if="sucesso" class="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center justify-between">
        <span class="flex items-center gap-1.5"><CheckCircle :size="14" class="shrink-0" /> {{ sucesso }}</span>
        <button type="button" class="text-emerald-600 hover:text-emerald-800" aria-label="Fechar" @click="sucesso = ''"><X :size="14" /></button>
      </div>
      <div v-if="erro" class="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800 flex items-center justify-between">
        <span class="flex items-center gap-1.5"><AlertTriangle :size="14" class="shrink-0" /> {{ erro }}</span>
        <button type="button" class="text-red-600 hover:text-red-800" aria-label="Fechar" @click="erro = ''"><X :size="14" /></button>
      </div>
    </div>

    <!-- Historico -->
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
        <History :size="16" /> Importações feitas
      </h2>
      <p v-if="carregando" class="mt-3 text-sm text-slate-500">Carregando...</p>
      <p v-else-if="!historico.length" class="mt-3 text-xs text-slate-400">Nenhuma importação neste evento ainda.</p>
      <div v-else class="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
        <div v-for="imp in historico" :key="imp.id" class="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 text-xs">
            <p class="font-bold text-slate-800">
              {{ imp.siteOrigem }} · {{ imp.totalAtletas }} atleta(s)
              <span v-if="imp.desfeitaEm" class="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Desfeita</span>
            </p>
            <p class="truncate text-slate-500">{{ imp.nomeArquivo }} · {{ formatarDataHora(imp.createdAt) }}</p>
            <p v-if="!imp.desfeitaEm" class="text-slate-500">
              Inscritos: {{ imp.ativos }} · Kits entregues: {{ imp.kitsEntregues }}
            </p>
          </div>
          <button
            v-if="imp.podeDesfazer"
            type="button"
            class="flex items-center gap-1 self-start rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 sm:self-auto"
            @click="onDesfazer(imp)"
          >
            <Undo2 :size="13" /> Desfazer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
