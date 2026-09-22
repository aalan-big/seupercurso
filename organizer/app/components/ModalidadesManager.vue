<script setup lang="ts">
import { Footprints, Plus, Accessibility, Pencil, ArrowRightLeft, Trophy } from 'lucide-vue-next'
import type { ModalidadeOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{
  eventoId: string
  cidade: string
  estado: string
  modalidades: ModalidadeOrganizador[]
  permiteServidorPublico?: boolean
  vagasServidorPublico?: number | null
}>()

const {
  criarModalidade,
  atualizarModalidade,
  removerModalidade,
  criarCategoria,
  atualizarCategoria,
  removerCategoria,
  migrarInscricoesCategoria,
  uploadListaServidores,
  obterServidoresPublicos,
  limparServidoresPublicos
} = useEventoOrganizador()

const generoOpcoes = [
  { valor: 'LIVRE' as const, label: 'Livre' },
  { valor: 'MASCULINO' as const, label: 'Masculino' },
  { valor: 'FEMININO' as const, label: 'Feminino' }
]

const erro = ref('')
const salvando = ref(false)

const mostrarFormModalidade = ref(false)
const novaModalidade = reactive({ nome: '', distanciaKm: '', descricao: '', idadeMinima: '', idadeMaxima: '', capacidade: '', valor: '' })

function normalizarDistancia(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return isNaN(val) ? null : val
  const limpo = String(val)
    .replace(/km/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.')
  if (!limpo) return null
  const num = parseFloat(limpo)
  return isNaN(num) ? null : Number(num.toFixed(2))
}

async function onCriarModalidade() {
  erro.value = ''
  if (!novaModalidade.nome?.trim()) {
    erro.value = 'Informe o nome da modalidade.'
    return
  }
  const distanciaKm = normalizarDistancia(novaModalidade.distanciaKm)
  if (distanciaKm !== null && distanciaKm <= 0) {
    erro.value = 'A distância deve ser maior que zero (ou deixe em branco caso não tenha distância fixa).'
    return
  }

  salvando.value = true
  try {
    await criarModalidade(props.eventoId, {
      nome: novaModalidade.nome.trim(),
      distanciaKm: distanciaKm !== null ? distanciaKm : undefined,
      descricao: novaModalidade.descricao || undefined,
      idadeMinima: novaModalidade.idadeMinima ? Number(novaModalidade.idadeMinima) : undefined,
      idadeMaxima: novaModalidade.idadeMaxima ? Number(novaModalidade.idadeMaxima) : undefined,
      capacidade: novaModalidade.capacidade ? Number(novaModalidade.capacidade) : undefined,
      valor: novaModalidade.valor ? Number(novaModalidade.valor) : undefined
    } as any)
    novaModalidade.nome = ''
    novaModalidade.distanciaKm = ''
    novaModalidade.descricao = ''
    novaModalidade.idadeMinima = ''
    novaModalidade.idadeMaxima = ''
    novaModalidade.capacidade = ''
    novaModalidade.valor = ''
    mostrarFormModalidade.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onRemoverModalidade(modalidadeId: string) {
  if (!confirm('Deseja realmente remover esta modalidade?')) return
  erro.value = ''
  salvando.value = true
  try {
    await removerModalidade(props.eventoId, modalidadeId)
  } catch (e) {
    const msg = extrairErro(e)
    erro.value = msg
    alert(msg)
  } finally {
    salvando.value = false
  }
}

async function onToggleAtivo(modalidade: ModalidadeOrganizador) {
  erro.value = ''
  try {
    await atualizarModalidade(props.eventoId, modalidade.id, { ativo: !modalidade.ativo })
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

const modalidadeEditandoId = ref<string | null>(null)
const edicaoModalidade = reactive({ nome: '', distanciaKm: '', descricao: '', idadeMinima: '', idadeMaxima: '', capacidade: '', valor: '' })

function abrirEdicao(modalidade: ModalidadeOrganizador) {
  modalidadeEditandoId.value = modalidade.id
  edicaoModalidade.nome = modalidade.nome
  edicaoModalidade.distanciaKm = modalidade.distanciaKm
  edicaoModalidade.descricao = modalidade.descricao || ''
  edicaoModalidade.idadeMinima = modalidade.idadeMinima ? String(modalidade.idadeMinima) : ''
  edicaoModalidade.idadeMaxima = modalidade.idadeMaxima ? String(modalidade.idadeMaxima) : ''
  edicaoModalidade.capacidade = modalidade.capacidade ? String(modalidade.capacidade) : ''
  edicaoModalidade.valor = ''
}

function cancelarEdicao() {
  modalidadeEditandoId.value = null
}

async function onSalvarEdicao(modalidadeId: string) {
  erro.value = ''
  if (!edicaoModalidade.nome?.trim()) {
    erro.value = 'Informe o nome da modalidade.'
    return
  }
  const distanciaKm = normalizarDistancia(edicaoModalidade.distanciaKm)
  if (distanciaKm !== null && distanciaKm <= 0) {
    erro.value = 'A distância deve ser maior que zero (ou deixe em branco caso não tenha distância fixa).'
    return
  }

  salvando.value = true
  try {
    await atualizarModalidade(props.eventoId, modalidadeId, {
      nome: edicaoModalidade.nome.trim(),
      distanciaKm: distanciaKm !== null ? distanciaKm : null,
      descricao: edicaoModalidade.descricao || undefined,
      idadeMinima: edicaoModalidade.idadeMinima ? Number(edicaoModalidade.idadeMinima) : undefined,
      idadeMaxima: edicaoModalidade.idadeMaxima ? Number(edicaoModalidade.idadeMaxima) : undefined,
      capacidade: edicaoModalidade.capacidade ? Number(edicaoModalidade.capacidade) : undefined,
      valor: edicaoModalidade.valor ? Number(edicaoModalidade.valor) : undefined
    } as any)
    modalidadeEditandoId.value = null
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

const modalidadeAbertaId = ref<string | null>(null)
const modalidadeMapaAbertaId = ref<string | null>(null)

function abrirMapa(modalidadeId: string) {
  modalidadeMapaAbertaId.value = modalidadeMapaAbertaId.value === modalidadeId ? null : modalidadeId
}
const novaCategoria = reactive({
  nome: '',
  idadeMinima: '',
  idadeMaxima: '',
  genero: 'LIVRE' as const,
  pcd: false,
  servidorPublico: false,
  capacidade: ''
})

function abrirCategorias(modalidadeId: string) {
  modalidadeAbertaId.value = modalidadeAbertaId.value === modalidadeId ? null : modalidadeId
}

async function onCriarCategoria(modalidadeId: string) {
  erro.value = ''
  if (!novaCategoria.nome) {
    erro.value = 'Informe o nome da categoria.'
    return
  }

  salvando.value = true
  try {
    await criarCategoria(props.eventoId, modalidadeId, {
      nome: novaCategoria.nome,
      idadeMinima: novaCategoria.idadeMinima ? Number(novaCategoria.idadeMinima) : undefined,
      idadeMaxima: novaCategoria.idadeMaxima ? Number(novaCategoria.idadeMaxima) : undefined,
      genero: novaCategoria.genero,
      pcd: novaCategoria.pcd,
      servidorPublico: novaCategoria.servidorPublico,
      capacidade: novaCategoria.capacidade ? Number(novaCategoria.capacidade) : undefined
    })
    novaCategoria.nome = ''
    novaCategoria.pcd = false
    novaCategoria.servidorPublico = false
    novaCategoria.idadeMinima = ''
    novaCategoria.idadeMaxima = ''
    novaCategoria.genero = 'LIVRE'
    novaCategoria.capacidade = ''
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

// Modal de Gestão da Lista de Servidores Públicos
const modalServidoresAberto = ref(false)
const categoriaServidorSelecionadaId = ref<string | null>(null)
const dadosServidores = ref<any>(null)
const carregandoServidores = ref(false)
const enviandoArquivo = ref(false)
const mensagemSucessoUpload = ref('')
const erroUpload = ref('')
const inputArquivoRef = ref<HTMLInputElement | null>(null)

async function abrirModalServidores(categoriaId?: string) {
  categoriaServidorSelecionadaId.value = categoriaId || null
  modalServidoresAberto.value = true
  mensagemSucessoUpload.value = ''
  erroUpload.value = ''
  await carregarServidores()
}

function fecharModalServidores() {
  modalServidoresAberto.value = false
}

async function carregarServidores() {
  carregandoServidores.value = true
  try {
    dadosServidores.value = await obterServidoresPublicos(props.eventoId)
  } catch (e) {
    erroUpload.value = extrairErro(e)
  } finally {
    carregandoServidores.value = false
  }
}

async function onArquivoSelecionado(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  enviandoArquivo.value = true
  mensagemSucessoUpload.value = ''
  erroUpload.value = ''
  try {
    const res = await uploadListaServidores(props.eventoId, file, categoriaServidorSelecionadaId.value || undefined)
    mensagemSucessoUpload.value = res.mensagem || 'Lista de servidores processada e importada com sucesso!'
    await carregarServidores()
    if (inputArquivoRef.value) {
      inputArquivoRef.value.value = ''
    }
  } catch (err) {
    erroUpload.value = extrairErro(err)
  } finally {
    enviandoArquivo.value = false
  }
}

async function onLimparServidores() {
  if (!confirm('Deseja realmente remover os servidores desta lista que ainda NÃO realizaram inscrição?')) return
  try {
    const res = await limparServidoresPublicos(props.eventoId)
    mensagemSucessoUpload.value = res.mensagem || 'Servidores não utilizados foram removidos.'
    await carregarServidores()
  } catch (err) {
    erroUpload.value = extrairErro(err)
  }
}

function formatarCpf(val: string | null | undefined) {
  if (!val) return ''
  const nums = val.replace(/\D/g, '').slice(0, 11)
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

const categoriaEditandoVagasId = ref<string | null>(null)
const vagasEditando = ref('')

function abrirEdicaoVagas(categoria: { id: string; capacidade: number | null }) {
  categoriaEditandoVagasId.value = categoria.id
  vagasEditando.value = categoria.capacidade ? String(categoria.capacidade) : ''
}

async function onSalvarVagas(modalidadeId: string, categoriaId: string) {
  erro.value = ''
  salvando.value = true
  try {
    await atualizarCategoria(props.eventoId, modalidadeId, categoriaId, {
      capacidade: vagasEditando.value ? Number(vagasEditando.value) : null
    })
    categoriaEditandoVagasId.value = null
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onToggleServidorPublico(modalidadeId: string, categoria: any) {
  erro.value = ''
  salvando.value = true
  try {
    await atualizarCategoria(props.eventoId, modalidadeId, categoria.id, {
      servidorPublico: !categoria.servidorPublico
    })
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

// Modal de Migração de Inscritos entre Categorias
const modalMigracaoAberto = ref(false)
const categoriaOrigemMigracao = ref<any>(null)
const modalidadeOrigemMigracaoId = ref<string>('')
const categoriaDestinoMigracaoId = ref<string>('')
const migrandoInscritos = ref(false)
const erroMigracao = ref('')
const excluirOrigemAposMigrar = ref(true)

function abrirModalMigracao(modalidadeId: string, categoria: any) {
  categoriaOrigemMigracao.value = categoria
  modalidadeOrigemMigracaoId.value = modalidadeId
  categoriaDestinoMigracaoId.value = ''
  erroMigracao.value = ''
  modalMigracaoAberto.value = true
}

function fecharModalMigracao() {
  modalMigracaoAberto.value = false
  categoriaOrigemMigracao.value = null
}

const todasOutrasCategorias = computed(() => {
  const lista: Array<{ id: string; nome: string; modalidadeNome: string; servidorPublico: boolean }> = []
  for (const mod of props.modalidades) {
    for (const cat of mod.categorias || []) {
      if (!categoriaOrigemMigracao.value || cat.id !== categoriaOrigemMigracao.value.id) {
        lista.push({
          id: cat.id,
          nome: cat.nome,
          modalidadeNome: mod.nome,
          servidorPublico: cat.servidorPublico || false
        })
      }
    }
  }
  return lista
})

async function onConfirmarMigracao() {
  if (!categoriaDestinoMigracaoId.value) {
    erroMigracao.value = 'Selecione a categoria de destino para onde os atletas irão.'
    return
  }
  erroMigracao.value = ''
  migrandoInscritos.value = true
  try {
    const res = await migrarInscricoesCategoria(
      props.eventoId,
      categoriaOrigemMigracao.value.id,
      categoriaDestinoMigracaoId.value
    )
    if (excluirOrigemAposMigrar.value) {
      await removerCategoria(
        props.eventoId,
        modalidadeOrigemMigracaoId.value,
        categoriaOrigemMigracao.value.id
      )
      alert(`${res.mensagem}\nA categoria antiga foi excluída com sucesso!`)
    } else {
      alert(res.mensagem)
    }
    fecharModalMigracao()
  } catch (err: any) {
    erroMigracao.value = extrairErro(err)
  } finally {
    migrandoInscritos.value = false
  }
}

async function onRemoverCategoria(modalidadeId: string, categoria: any) {
  if (!confirm(`Deseja realmente remover a categoria "${categoria.nome}"?`)) return
  erro.value = ''
  salvando.value = true
  try {
    await removerCategoria(props.eventoId, modalidadeId, categoria.id)
  } catch (e) {
    const msg = extrairErro(e)
    erro.value = msg
    if (msg.includes('já existe inscrição')) {
      if (confirm(`Não é possível excluir diretamente porque já existem atletas inscritos na categoria "${categoria.nome}".\n\nDeseja migrar esses atletas para outra categoria (ex: Servidor Público Afiliado) agora mesmo?`)) {
        abrirModalMigracao(modalidadeId, categoria)
      }
    } else {
      alert(msg)
    }
  } finally {
    salvando.value = false
  }
}

async function onCriarCategoriasPcdPadrao(modalidadeId: string) {
  erro.value = ''
  salvando.value = true
  try {
    await criarCategoria(props.eventoId, modalidadeId, {
      nome: 'PCD - Geral',
      genero: 'LIVRE',
      pcd: true
    })
    await criarCategoria(props.eventoId, modalidadeId, {
      nome: 'PCD - Cadeirantes',
      genero: 'LIVRE',
      pcd: true
    })
    await criarCategoria(props.eventoId, modalidadeId, {
      nome: 'PCD - Deficiente Visual',
      genero: 'LIVRE',
      pcd: true
    })
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

function preencherPreset(nome: string, distanciaKm: string, descricao?: string) {
  novaModalidade.nome = nome
  novaModalidade.distanciaKm = distanciaKm
  novaModalidade.descricao = descricao || ''
}

const sugestoesModalidades = [
  { nome: 'Corrida', km: '5' },
  { nome: 'Caminhada', km: '3' },
  { nome: 'Meia Maratona', km: '21' },
  { nome: 'Maratona', km: '42' },
  { nome: 'MTB Pro', km: '50' },
  { nome: 'MTB Sport', km: '25' },
  { nome: 'Ciclismo Estrada', km: '80' },
  { nome: 'Ciclismo 100k', km: '100' },
  { nome: 'Ciclismo 150k', km: '150' },
  { nome: 'Ciclismo 200k', km: '200' },
  { nome: 'Desafio 100k', km: '100' },
  { nome: 'Desafio 150k', km: '150' },
  { nome: 'Desafio 200k', km: '200' },
  { nome: 'Ultramaratona', km: '100' },
  { nome: 'Motocross MX1', km: '12' },
  { nome: 'Motocross MX2', km: '10' },
  { nome: 'Enduro Pro', km: '40' },
  { nome: 'Veloterra Nacional', km: '8' },
  { nome: 'Natação Mar Aberto', km: '1.5' },
  { nome: 'Triathlon Sprint', km: '25.75' },
  { nome: 'PCD', km: '5' }
]

const menuSugestoesAberto = ref(false)

const sugestoesFiltradas = computed(() => {
  const busca = novaModalidade.nome.trim().toLowerCase()
  if (!busca) return sugestoesModalidades
  return sugestoesModalidades.filter((s) => s.nome.toLowerCase().includes(busca))
})

function selecionarSugestao(sug: { nome: string; km: string }) {
  novaModalidade.nome = sug.nome
  novaModalidade.distanciaKm = sug.km
  menuSugestoesAberto.value = false
}

function fecharMenuComDelay() {
  setTimeout(() => {
    menuSugestoesAberto.value = false
  }, 200)
}

function faixaEtaria(min: number | null, max: number | null) {
  if (!min && !max) return 'Todas as idades'
  if (min && max) return `${min} a ${max} anos`
  if (min) return `A partir de ${min} anos`
  return `Até ${max} anos`
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
      <AppIcon name="warning" size="16" class="inline mr-1" /> {{ erro }}
    </p>

    <!-- Banner de Gestão de Servidores Públicos se liberado pelo Admin -->
    <div
      v-if="props.permiteServidorPublico"
      class="rounded-3xl border border-amber-300 bg-amber-50/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
    >
      <div class="flex items-start sm:items-center gap-3">
        <span class="text-3xl">🏛️</span>
        <div>
          <h4 class="text-xs font-black uppercase tracking-wider text-amber-950">
            Categoria Servidor Público Liberada pelo Admin
          </h4>
          <p class="text-xs text-amber-900 mt-0.5 font-medium">
            Limite contratado: <strong>{{ props.vagasServidorPublico ? `${props.vagasServidorPublico} vagas gratuitas` : 'Ilimitado' }}</strong>. Faça o upload do PDF (72+ páginas) ou planilha com as matrículas e CPFs autorizados.
          </p>
        </div>
      </div>
      <button
        type="button"
        class="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider transition shadow-sm shrink-0 flex items-center justify-center gap-1.5"
        @click="abrirModalServidores()"
      >
        <span>Gerenciar Lista de Servidores</span>
      </button>
    </div>

    <!-- Estado Vazio -->
    <div v-if="modalidades.length === 0" class="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3 shadow-xs">
      <div class="h-12 w-12 rounded-2xl bg-amber-50 text-warning flex items-center justify-center mx-auto">
        <AppIcon name="eventos" size="24" />
      </div>
      <h3 class="font-bold text-sm text-slate-800">Nenhuma modalidade cadastrada</h3>
      <p class="text-xs text-slate-500 max-w-sm mx-auto">
        Adicione os percursos da sua prova (ex.: Corrida 5km, Caminhada 3km, 21km Meia Maratona) para liberar a criação de lotes de inscrição.
      </p>
    </div>

    <!-- Lista de Modalidades -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="modalidade in modalidades"
        :key="modalidade.id"
        class="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden transition hover:border-slate-300"
      >
        <!-- Form de Edição da Modalidade -->
        <div v-if="modalidadeEditandoId === modalidade.id" class="p-4 sm:p-5 bg-slate-50/50 space-y-3">
          <h4 class="text-xs font-black uppercase tracking-wider text-slate-700">Editar Modalidade</h4>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nome da Modalidade</label>
              <input
                v-model="edicaoModalidade.nome"
                type="text"
                placeholder="Ex.: Corrida 10km"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[11px] font-bold text-slate-500 uppercase">Distância (km) <span class="text-[10px] font-normal text-slate-400 lowercase">(opcional)</span></label>
                <span class="text-[10px] text-slate-400 font-medium">Aceita 100, 150, 200 km...</span>
              </div>
              <input
                v-model="edicaoModalidade.distanciaKm"
                type="text"
                inputmode="decimal"
                placeholder="Ex.: 10 ou deixe em branco"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
              <p class="text-[10px] text-slate-400 mt-1">Opcional: preencha para percurso fixo ou deixe vazio para desafio/livre.</p>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Idade Mínima</label>
              <input
                v-model="edicaoModalidade.idadeMinima"
                type="number"
                min="0"
                placeholder="Opcional"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Idade Máxima</label>
              <input
                v-model="edicaoModalidade.idadeMaxima"
                type="number"
                min="0"
                placeholder="Opcional"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Vagas do Percurso</label>
              <input
                v-model="edicaoModalidade.capacidade"
                type="number"
                min="1"
                placeholder="Sem limite"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Valor da Inscrição (R$)</label>
              <input
                v-model="edicaoModalidade.valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex.: 50,00"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Descrição do Percurso</label>
              <textarea
                v-model="edicaoModalidade.descricao"
                placeholder="Detalhes adicionais (opcional)"
                rows="2"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
              ></textarea>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button
              type="button"
              :disabled="salvando"
              class="rounded-xl bg-warning px-5 py-2.5 text-xs font-black uppercase tracking-wider text-primary transition hover:brightness-95 disabled:opacity-50 flex items-center gap-1.5"
              @click="onSalvarEdicao(modalidade.id)"
            >
              <AppIcon name="check" size="14" /> {{ salvando ? 'Salvando...' : 'Salvar Alterações' }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              @click="cancelarEdicao"
            >
              Cancelar
            </button>
          </div>
        </div>

        <!-- Cabeçalho do Card da Modalidade (Mobile Friendly) -->
        <div v-else class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span v-if="modalidade.distanciaKm" class="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1">
                <Footprints :size="14" class="text-amber-950" /> {{ modalidade.distanciaKm }} km
              </span>
              <span v-else class="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                <Trophy :size="14" class="text-amber-800" /> Desafio / Livre
              </span>
              <h3 class="font-extrabold text-base text-slate-900">{{ modalidade.nome }}</h3>
            </div>
            <p class="text-xs text-slate-500 font-medium">
              Faixa etária geral: <strong>{{ faixaEtaria(modalidade.idadeMinima, modalidade.idadeMaxima) }}</strong>
            </p>
            <p class="text-xs text-slate-500 font-medium">
              Vagas do percurso: <strong>{{ modalidade.capacidade ?? 'Sem limite' }}</strong>
            </p>
          </div>

          <div class="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-between sm:justify-end">
            <button
              type="button"
              class="rounded-xl px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition flex items-center gap-1"
              :class="modalidade.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'"
              @click="onToggleAtivo(modalidade)"
            >
              <AppIcon name="check" size="12" /> {{ modalidade.ativo ? 'Ativa' : 'Inativa' }}
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition flex items-center gap-1"
                @click="abrirEdicao(modalidade)"
              >
                Editar
              </button>
              <button
                type="button"
                class="rounded-xl bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-600 transition flex items-center gap-1"
                @click="onRemoverModalidade(modalidade.id)"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>

        <!-- Seção Expansível de Categorias -->
        <div class="border-t border-slate-100 bg-slate-50/50 p-4 sm:px-5 sm:py-4">
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="text-xs font-black uppercase tracking-wider text-slate-700 hover:text-primary flex items-center gap-1.5"
              @click="abrirCategorias(modalidade.id)"
            >
              <span>Categorias Especificas ({{ modalidade.categorias.length }})</span>
              <AppIcon name="chevron" size="14" :class="modalidadeAbertaId === modalidade.id ? 'rotate-180 transition' : 'transition'" />
            </button>
          </div>

          <div v-if="modalidadeAbertaId === modalidade.id" class="mt-4 space-y-4">
            <div v-if="modalidade.categorias.length === 0" class="text-xs italic text-slate-400">
              Nenhuma categoria específica cadastrada para esta modalidade.
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="categoria in modalidade.categorias"
                :key="categoria.id"
                class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xs"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-extrabold text-slate-800">{{ categoria.nome }}</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      <span v-if="categoria.pcd" class="ml-1 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">PCD</span>
                      <button
                        v-if="props.permiteServidorPublico"
                        type="button"
                        :disabled="salvando"
                        class="ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-0.5"
                        :class="categoria.servidorPublico ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'"
                        :title="categoria.servidorPublico ? 'Clique para desmarcar categoria de servidor público' : 'Clique para marcar esta categoria como Servidor Público (Isenção)'"
                        @click="onToggleServidorPublico(modalidade.id, categoria)"
                      >
                        <span>🏛️ {{ categoria.servidorPublico ? 'Servidor Público ✓' : '+ Marcar Servidor' }}</span>
                      </button>
                    </p>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class="text-blue-500 hover:text-blue-700 font-bold p-1 rounded-lg hover:bg-blue-50 transition"
                      title="Migrar atletas desta categoria para outra"
                      @click="abrirModalMigracao(modalidade.id, categoria)"
                    >
                      <ArrowRightLeft class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      class="text-red-500 hover:text-red-700 font-bold p-1 rounded-lg hover:bg-red-50 transition"
                      title="Remover Categoria"
                      @click="onRemoverCategoria(modalidade.id, categoria)"
                    >
                      <AppIcon name="close" size="14" />
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between border-t border-slate-100 pt-2">
                  <template v-if="categoriaEditandoVagasId === categoria.id">
                    <div class="flex items-center gap-1.5">
                      <input
                        v-model="vagasEditando"
                        type="number"
                        min="1"
                        placeholder="Sem limite"
                        class="w-24 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold focus:border-warning focus:outline-none"
                      />
                      <button
                        type="button"
                        :disabled="salvando"
                        class="rounded-lg bg-warning px-2 py-1 text-[10px] font-black uppercase text-primary hover:brightness-95 disabled:opacity-50"
                        @click="onSalvarVagas(modalidade.id, categoria.id)"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        class="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                        @click="categoriaEditandoVagasId = null"
                      >
                        Cancelar
                      </button>
                    </div>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="text-[11px] font-bold text-slate-500 hover:text-primary flex items-center gap-1"
                    @click="abrirEdicaoVagas(categoria)"
                  >
                    Vagas: <span class="font-black text-slate-800">{{ categoria.capacidade ?? 'Sem limite' }}</span>
                    <Pencil :size="11" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Form de Adicionar Nova Categoria -->
            <div class="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h5 class="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <Plus :size="14" class="text-slate-700" /> <span>Adicionar Categoria para {{ modalidade.nome }}</span>
                </h5>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-if="props.permiteServidorPublico"
                    type="button"
                    class="rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 text-xs font-extrabold text-amber-900 transition flex items-center gap-1 self-start sm:self-auto"
                    @click="abrirModalServidores()"
                  >
                    <span>🏛️ Lista de Servidores (PDF/Planilha)</span>
                  </button>

                  <button
                    type="button"
                    :disabled="salvando"
                    class="rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 text-xs font-extrabold text-indigo-700 transition flex items-center gap-1 self-start sm:self-auto"
                    @click="onCriarCategoriasPcdPadrao(modalidade.id)"
                  >
                    <Accessibility :size="14" class="text-indigo-700" /> <span>+ Auto-Criar Categorias PCD Padrão</span>
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nome</label>
                  <input
                    v-model="novaCategoria.nome"
                    type="text"
                    placeholder="Ex.: PCD Geral ou 18 a 29 Anos"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Idade Mín.</label>
                  <input
                    v-model="novaCategoria.idadeMinima"
                    type="number"
                    min="0"
                    placeholder="Ex.: 18"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Idade Máx.</label>
                  <input
                    v-model="novaCategoria.idadeMaxima"
                    type="number"
                    min="0"
                    placeholder="Ex.: 29"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Gênero</label>
                  <select
                    v-model="novaCategoria.genero"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none bg-white"
                  >
                    <option v-for="opcao in generoOpcoes" :key="opcao.valor" :value="opcao.valor">{{ opcao.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Vagas (opcional)</label>
                  <input
                    v-model="novaCategoria.capacidade"
                    type="number"
                    min="1"
                    placeholder="Sem limite"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
                  />
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div class="flex flex-wrap items-center gap-2">
                  <label class="flex items-center gap-2 text-xs font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 cursor-pointer transition hover:bg-indigo-100">
                    <input v-model="novaCategoria.pcd" type="checkbox" class="h-4 w-4 rounded accent-indigo-600" />
                    <Accessibility :size="14" class="text-indigo-700" /> <span>Marcar Categoria PCD</span>
                  </label>

                  <label
                    v-if="props.permiteServidorPublico"
                    class="flex items-center gap-2 text-xs font-extrabold text-amber-950 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 cursor-pointer transition hover:bg-amber-100"
                  >
                    <input v-model="novaCategoria.servidorPublico" type="checkbox" class="h-4 w-4 rounded accent-amber-600" />
                    <span>🏛️ Marcar Categoria Servidor Público (Isenção 100%)</span>
                  </label>

                  <span
                    v-else
                    class="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl cursor-not-allowed"
                    title="A liberação de categorias de servidor público com taxa pré-paga é feita pela administração"
                  >
                    <span>🔒 Categoria Servidor Público (Bloqueado)</span>
                  </span>
                </div>

                <button
                  type="button"
                  :disabled="salvando || !novaCategoria.nome"
                  class="w-full sm:w-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-xs hover:bg-primary disabled:opacity-50 transition"
                  @click="onCriarCategoria(modalidade.id)"
                >
                  + Salvar Categoria
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Seção Expansível de Percurso/Mapa -->
        <div class="border-t border-slate-100 bg-slate-50/50 p-4 sm:px-5 sm:py-4">
          <button
            type="button"
            class="text-xs font-black uppercase tracking-wider text-slate-700 hover:text-primary flex items-center gap-1.5"
            @click="abrirMapa(modalidade.id)"
          >
            <span>Percurso / Mapa {{ modalidade.rotaGeoJson || modalidade.mapaEmbedUrl || modalidade.mapaPercursoUrl ? '✓' : '' }}</span>
            <AppIcon name="chevron" size="14" :class="modalidadeMapaAbertaId === modalidade.id ? 'rotate-180 transition' : 'transition'" />
          </button>

          <div v-if="modalidadeMapaAbertaId === modalidade.id" class="mt-4">
            <ModalidadeMapa :evento-id="eventoId" :cidade="cidade" :estado="estado" :modalidade="modalidade" />
          </div>
        </div>
      </div>
    </div>

    <!-- Botão de Nova Modalidade -->
    <div class="pt-2">
      <button
        v-if="!mostrarFormModalidade"
        type="button"
        class="w-full sm:w-auto rounded-2xl bg-warning px-5 py-3 text-xs font-black uppercase tracking-wider text-primary shadow hover:brightness-95 transition flex items-center justify-center gap-2"
        @click="mostrarFormModalidade = true"
      >
        <AppIcon name="eventos" size="16" /> + Adicionar Nova Modalidade
      </button>

      <div v-else class="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Footprints :size="16" class="text-slate-800" /> Cadastrar Novo Percurso / Modalidade da Prova
          </h4>
        </div>


        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="relative">
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nome da Modalidade *</label>
            <input
              v-model="novaModalidade.nome"
              type="text"
              placeholder="Ex.: Corrida, MTB Pro, Caminhada..."
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
              @focus="menuSugestoesAberto = true"
              @input="menuSugestoesAberto = true"
              @blur="fecharMenuComDelay"
            />

            <!-- Menu de sugestões posicionado EXATAMENTE abaixo do campo -->
            <div
              v-if="menuSugestoesAberto && sugestoesFiltradas.length > 0"
              class="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <button
                v-for="sug in sugestoesFiltradas"
                :key="sug.nome"
                type="button"
                class="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-amber-50 hover:text-amber-950 flex items-center justify-between"
                @mousedown.prevent="selecionarSugestao(sug)"
              >
                <span>{{ sug.nome }}</span>
                <span class="text-[10px] text-slate-400 font-normal">Sugerir {{ sug.km }}km</span>
              </button>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-slate-700 uppercase">Distância (em km) <span class="text-[10px] font-normal text-slate-400 lowercase">(opcional)</span></label>
              <span class="text-[10px] text-slate-400 font-medium">Aceita 100, 150, 200 km...</span>
            </div>
            <input
              v-model="novaModalidade.distanciaKm"
              type="text"
              inputmode="decimal"
              placeholder="Ex.: 10 ou deixe vazio se não houver"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
            <p class="text-[10px] text-slate-400 mt-1">Opcional: preencha para percursos com KM fixo ou deixe vazio para desafios e percursos livres.</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Idade Mínima Permitida</label>
            <input
              v-model="novaModalidade.idadeMinima"
              type="number"
              min="0"
              placeholder="Ex.: 16 (Opcional)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Idade Máxima Permitida</label>
            <input
              v-model="novaModalidade.idadeMaxima"
              type="number"
              min="0"
              placeholder="Ex.: 80 (Opcional)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Vagas do Percurso (opcional)</label>
            <input
              v-model="novaModalidade.capacidade"
              type="number"
              min="1"
              placeholder="Sem limite"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Valor da Inscrição (R$)</label>
            <input
              v-model="novaModalidade.valor"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex.: 50,00"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Descrição Breve do Percurso</label>
            <textarea
              v-model="novaModalidade.descricao"
              placeholder="Descrição do percurso ou altimetria (opcional)"
              rows="2"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button
            type="button"
            :disabled="salvando || !novaModalidade.nome?.trim()"
            class="rounded-xl bg-warning px-6 py-3 text-xs font-black uppercase tracking-wider text-primary shadow hover:brightness-95 disabled:opacity-50 flex items-center gap-1.5"
            @click="onCriarModalidade"
          >
            <AppIcon name="check" size="14" /> {{ salvando ? 'Salvando...' : 'Salvar Modalidade' }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
            @click="mostrarFormModalidade = false"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Gestão da Lista de Servidores Públicos -->
    <Teleport to="body">
      <div
        v-if="modalServidoresAberto"
        class="fixed inset-0 z-[130] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" @click="fecharModalServidores"></div>
        <div class="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white p-6 shadow-2xl overflow-hidden">
          <!-- Header -->
          <div class="flex items-start justify-between border-b border-slate-100 pb-4">
            <div class="flex items-center gap-3">
              <span class="text-3xl">🏛️</span>
              <div>
                <h3 class="text-base font-extrabold text-slate-900">
                  Lista de Servidores Públicos Autorizados
                </h3>
                <p class="text-xs text-slate-500 mt-0.5">
                  Faça o upload do PDF (suporta 70+ páginas) ou Planilha Excel/CSV com as matrículas e CPFs.
                </p>
              </div>
            </div>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              @click="fecharModalServidores"
            >
              ✕
            </button>
          </div>

          <!-- Conteúdo rolável -->
          <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            <!-- Resumo das Vagas -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                <p class="text-[10px] font-bold uppercase text-slate-400">Total na Lista</p>
                <p class="text-lg font-black text-slate-800">{{ dadosServidores?.totalCadastrados ?? 0 }}</p>
              </div>
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                <p class="text-[10px] font-bold uppercase text-slate-400">Limite Contratado</p>
                <p class="text-lg font-black text-amber-600">{{ dadosServidores?.vagasServidorPublico ?? 'Sem limite' }}</p>
              </div>
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                <p class="text-[10px] font-bold uppercase text-slate-400">Inscrições Usadas</p>
                <p class="text-lg font-black text-emerald-600">{{ dadosServidores?.totalUtilizados ?? 0 }}</p>
              </div>
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                <p class="text-[10px] font-bold uppercase text-slate-400">Vagas Restantes</p>
                <p class="text-lg font-black text-slate-800">{{ dadosServidores?.vagasRestantesVagasEvento ?? '-' }}</p>
              </div>
            </div>

            <!-- Upload Box -->
            <div class="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-5 text-center">
              <input
                ref="inputArquivoRef"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.txt"
                class="hidden"
                @change="onArquivoSelecionado"
              />
              <div class="flex flex-col items-center justify-center gap-2">
                <span class="text-3xl">📄</span>
                <p class="text-xs font-bold text-slate-700">
                  Clique para selecionar o PDF (suporta arquivos extensos de 70+ páginas) ou Planilha
                </p>
                <p class="text-[11px] text-slate-400">
                  Formatos aceitos: PDF, Excel (.xlsx, .xls), CSV ou TXT
                </p>
                <button
                  type="button"
                  :disabled="enviandoArquivo"
                  class="mt-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition disabled:opacity-50 flex items-center gap-2 shadow-xs"
                  @click="inputArquivoRef?.click()"
                >
                  <span v-if="enviandoArquivo" class="animate-spin">⏳</span>
                  <span>{{ enviandoArquivo ? 'Processando arquivo (extraindo dados)...' : 'Selecionar Arquivo da Lista' }}</span>
                </button>
              </div>
            </div>

            <!-- Mensagens de Alerta -->
            <div v-if="mensagemSucessoUpload" class="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center justify-between">
              <span>✅ {{ mensagemSucessoUpload }}</span>
              <button type="button" class="text-emerald-600 hover:underline" @click="mensagemSucessoUpload = ''">✕</button>
            </div>

            <div v-if="erroUpload" class="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800 flex items-center justify-between">
              <span>⚠️ {{ erroUpload }}</span>
              <button type="button" class="text-red-600 hover:underline" @click="erroUpload = ''">✕</button>
            </div>

            <!-- Tabela dos Servidores Importados -->
            <div class="border border-slate-200 rounded-xl overflow-hidden">
              <div class="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Servidores Cadastrados ({{ dadosServidores?.servidores?.length || 0 }})
                </span>
                <button
                  v-if="dadosServidores?.servidores?.length > 0"
                  type="button"
                  class="text-[11px] font-bold text-red-600 hover:underline"
                  @click="onLimparServidores"
                >
                  Remover não utilizados
                </button>
              </div>

              <div class="max-h-60 overflow-y-auto">
                <table v-if="dadosServidores?.servidores?.length > 0" class="w-full text-left text-xs">
                  <thead class="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                    <tr>
                      <th class="px-3 py-2">Matrícula</th>
                      <th class="px-3 py-2">CPF</th>
                      <th class="px-3 py-2">Nome</th>
                      <th class="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="s in dadosServidores.servidores" :key="s.id" class="hover:bg-slate-50/80">
                      <td class="px-3 py-2 font-mono font-bold text-slate-800">{{ s.matricula }}</td>
                      <td class="px-3 py-2 font-mono text-slate-600">{{ formatarCpf(s.cpf) }}</td>
                      <td class="px-3 py-2 font-medium text-slate-700 truncate max-w-[150px]">{{ s.nome || '-' }}</td>
                      <td class="px-3 py-2 text-right">
                        <span
                          v-if="s.inscricaoId"
                          class="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold"
                        >
                          Inscrito
                        </span>
                        <span
                          v-else
                          class="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold"
                        >
                          Disponível
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="p-6 text-center text-xs text-slate-400">
                  Nenhum servidor público cadastrado para este evento ainda.
                </div>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div class="border-t border-slate-100 pt-4 flex justify-end">
            <button
              type="button"
              class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-slate-800 transition"
              @click="fecharModalServidores"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal de Migração de Categoria -->
    <Teleport to="body">
      <div
        v-if="modalMigracaoAberto"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      >
        <div class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5">
          <!-- Cabeçalho -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🔄</span>
              <div>
                <h3 class="text-base font-extrabold text-slate-900">
                  Migrar Atletas de Categoria
                </h3>
                <p class="text-xs text-slate-500">
                  Transfira todos os inscritos da categoria atual para outra categoria.
                </p>
              </div>
            </div>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 p-1"
              @click="fecharModalMigracao"
            >
              <AppIcon name="close" size="18" />
            </button>
          </div>

          <!-- Conteúdo -->
          <div class="space-y-4">
            <div class="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
              <p><strong>Categoria Atual (Origem):</strong> {{ categoriaOrigemMigracao?.nome }}</p>
              <p class="text-[11px] text-amber-700 mt-1">
                Todos os atletas atualmente vinculados nesta categoria serão transferidos para a nova categoria escolhida.
              </p>
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Selecione a Categoria de Destino:
              </label>
              <select
                v-model="categoriaDestinoMigracaoId"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-warning focus:outline-none"
              >
                <option value="" disabled>Escolha a categoria...</option>
                <option
                  v-for="cat in todasOutrasCategorias"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.modalidadeNome }} — {{ cat.nome }} {{ cat.servidorPublico ? '🏛️ (Servidor Público)' : '' }}
                </option>
              </select>
            </div>

            <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                v-model="excluirOrigemAposMigrar"
                type="checkbox"
                class="rounded border-slate-300 text-warning focus:ring-warning"
              />
              <span>Excluir a categoria antiga automaticamente após transferir todos os atletas</span>
            </label>

            <p v-if="erroMigracao" class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
              {{ erroMigracao }}
            </p>
          </div>

          <!-- Footer -->
          <div class="border-t border-slate-100 pt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50 transition"
              @click="fecharModalMigracao"
            >
              Cancelar
            </button>
            <button
              type="button"
              :disabled="migrandoInscritos || !categoriaDestinoMigracaoId"
              class="rounded-xl bg-orange-600 px-5 py-2 text-xs font-bold uppercase text-white hover:bg-orange-700 transition disabled:opacity-50 flex items-center gap-2"
              @click="onConfirmarMigracao"
            >
              <span v-if="migrandoInscritos">Migrando...</span>
              <span v-else>Confirmar Migração</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
