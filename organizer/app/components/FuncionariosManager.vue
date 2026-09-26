<script setup lang="ts">
import { CheckCircle, AlertTriangle, FileText, X } from 'lucide-vue-next'
import type { ResumoFuncionarios } from '../composables/useFuncionariosOrganizador'

const props = defineProps<{ eventoId: string }>()

const { obterFuncionarios, uploadListaFuncionarios, limparFuncionariosNaoUtilizados } = useFuncionariosOrganizador()
const { confirmar } = useConfirmacao()

const dados = ref<ResumoFuncionarios | null>(null)
const carregando = ref(true)
const enviando = ref(false)
const erro = ref('')
const sucesso = ref('')
const amostra = ref<{ cpf: string; matricula: string; nome?: string }[]>([])
const inputArquivoRef = ref<HTMLInputElement | null>(null)

async function carregar() {
  carregando.value = true
  try {
    dados.value = await obterFuncionarios(props.eventoId)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

async function onArquivoSelecionado(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  enviando.value = true
  erro.value = ''
  sucesso.value = ''
  amostra.value = []
  try {
    const res = await uploadListaFuncionarios(props.eventoId, file)
    sucesso.value = res.mensagem
    // Primeiras linhas lidas, pra conferir se CPF e matricula sairam certos
    amostra.value = res.amostra || []
    await carregar()
  } catch (err) {
    erro.value = extrairErro(err)
  } finally {
    enviando.value = false
    if (inputArquivoRef.value) inputArquivoRef.value.value = ''
  }
}

async function onLimpar() {
  const ok = await confirmar({
    titulo: 'Limpar lista de funcionários',
    mensagem: 'Deseja remover os funcionários desta lista que ainda NÃO se inscreveram? Quem já se inscreveu continua na lista.',
    textoConfirmar: 'Remover',
    perigo: true
  })
  if (!ok) return
  erro.value = ''
  try {
    const res = await limparFuncionariosNaoUtilizados(props.eventoId)
    sucesso.value = res.mensagem
    amostra.value = []
    await carregar()
  } catch (err) {
    erro.value = extrairErro(err)
  }
}

function formatarCpf(val: string | null | undefined) {
  if (!val) return ''
  return val
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Desconto para funcionários</h2>
    <p class="mt-1 text-xs text-slate-400">
      Suba a lista de funcionários (CPF e matrícula). Na inscrição, o funcionário informa a matrícula e recebe o desconto.
      O percentual é definido pela equipe do Seu Percurso e não soma com cupom nem com desconto de idoso.
    </p>

    <p v-if="carregando" class="mt-4 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="dados">
      <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <p class="text-[10px] font-bold uppercase text-slate-400">Desconto</p>
          <p class="text-lg font-black text-emerald-700">{{ dados.percentualFuncionarios ?? '-' }}%</p>
        </div>
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <p class="text-[10px] font-bold uppercase text-slate-400">Na lista</p>
          <p class="text-lg font-black text-slate-800">{{ dados.totalCadastrados }}</p>
        </div>
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <p class="text-[10px] font-bold uppercase text-slate-400">Inscritos</p>
          <p class="text-lg font-black text-emerald-600">{{ dados.totalUtilizados }}</p>
        </div>
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <p class="text-[10px] font-bold uppercase text-slate-400">Vagas restantes</p>
          <p class="text-lg font-black text-slate-800">{{ dados.vagasRestantes ?? 'Sem limite' }}</p>
        </div>
      </div>

      <div class="mt-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-5 text-center">
        <input
          ref="inputArquivoRef"
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.txt"
          class="hidden"
          @change="onArquivoSelecionado"
        />
        <div class="flex flex-col items-center justify-center gap-2">
          <FileText :size="30" class="text-slate-400" />
          <p class="text-xs font-bold text-slate-700">Selecione o PDF ou a planilha com a lista de funcionários</p>
          <p class="text-[11px] text-slate-400">Formatos aceitos: PDF, Excel (.xlsx, .xls), CSV ou TXT</p>
          <button
            type="button"
            :disabled="enviando"
            class="mt-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition disabled:opacity-50"
            @click="inputArquivoRef?.click()"
          >
            {{ enviando ? 'Processando arquivo...' : 'Selecionar arquivo da lista' }}
          </button>
        </div>
      </div>

      <div v-if="sucesso" class="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center justify-between">
        <span class="flex items-center gap-1.5"><CheckCircle :size="14" class="shrink-0" /> {{ sucesso }}</span>
        <button type="button" class="text-emerald-600 hover:text-emerald-800" aria-label="Fechar" @click="sucesso = ''"><X :size="14" /></button>
      </div>

      <div v-if="amostra.length" class="mt-3 rounded-xl border border-slate-200 p-3 text-xs">
        <p class="font-bold text-slate-700">Confira as primeiras linhas lidas do arquivo:</p>
        <ul class="mt-1 font-mono text-slate-600">
          <li v-for="a in amostra" :key="a.cpf">{{ formatarCpf(a.cpf) }} · matrícula {{ a.matricula }}{{ a.nome ? ` · ${a.nome}` : '' }}</li>
        </ul>
      </div>

      <div class="mt-4 border border-slate-200 rounded-xl overflow-hidden">
        <div class="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-700">
            Funcionários cadastrados ({{ dados.totalCadastrados }})
          </span>
          <button
            v-if="dados.funcionarios.length > 0"
            type="button"
            class="text-[11px] font-bold text-red-600 hover:underline"
            @click="onLimpar"
          >
            Remover não inscritos
          </button>
        </div>

        <div class="max-h-60 overflow-y-auto">
          <table v-if="dados.funcionarios.length > 0" class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
              <tr>
                <th class="px-3 py-2">Matrícula</th>
                <th class="px-3 py-2">CPF</th>
                <th class="px-3 py-2">Nome</th>
                <th class="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="f in dados.funcionarios" :key="f.id">
                <td class="px-3 py-2 font-mono font-bold text-slate-800">{{ f.matricula }}</td>
                <td class="px-3 py-2 font-mono text-slate-600">{{ formatarCpf(f.cpf) }}</td>
                <td class="px-3 py-2 text-slate-700 truncate max-w-[150px]">{{ f.nome || '-' }}</td>
                <td class="px-3 py-2 text-right">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="f.emUso ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'"
                  >
                    {{ f.emUso ? 'Inscrito' : 'Disponível' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="p-6 text-center text-xs text-slate-400">Nenhum funcionário cadastrado ainda.</div>
        </div>
      </div>
    </template>

    <div v-if="erro" class="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800 flex items-center justify-between">
      <span class="flex items-center gap-1.5"><AlertTriangle :size="14" class="shrink-0" /> {{ erro }}</span>
      <button type="button" class="text-red-600 hover:text-red-800" aria-label="Fechar" @click="erro = ''"><X :size="14" /></button>
    </div>
  </div>
</template>
