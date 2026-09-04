<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Map, X, Maximize, Footprints, Download, Circle, Droplet, RefreshCw, Flag, Watch } from 'lucide-vue-next'

const props = defineProps<{
  mapaPercursoUrl?: string | null
  mapaEmbedUrl?: string | null
  rotaGeoJson?: string | null
  gpxUrl?: string | null
  cidade?: string
  estado?: string
}>()

const modoVisualizacao = ref<'desenhado' | 'embed' | 'imagem'>('desenhado')
const zoomNivel = ref(1)
const emTelaCheia = ref(false)

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

let leafletMapViewer: any = null
let polylineViewerLayer: any = null
let markersViewerLayerGroup: any = null

const rotaDados = computed(() => {
  if (!props.rotaGeoJson) return null
  try {
    return JSON.parse(props.rotaGeoJson) as {
      pontos: Array<{ lat: number; lng: number }>
      marcadores: Array<{ id: string; tipo: string; lat: number; lng: number; titulo: string }>
      distanciaKm?: string
    }
  } catch {
    return null
  }
})

watch(
  () => [props.rotaGeoJson, props.mapaEmbedUrl, props.mapaPercursoUrl],
  () => {
    if (props.rotaGeoJson) {
      modoVisualizacao.value = 'desenhado'
      nextTick(() => initLeafletViewer())
    } else if (props.mapaEmbedUrl) {
      modoVisualizacao.value = 'embed'
    } else {
      modoVisualizacao.value = 'imagem'
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    if (!(window as any).L) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)

      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => {
        initLeafletViewer()
      }
      document.head.appendChild(script)
    } else {
      initLeafletViewer()
    }
  }
})

function initLeafletViewer() {
  if (typeof window === 'undefined' || !(window as any).L) return
  const L = (window as any).L

  const container = document.getElementById('mapaLeafletViewer')
  if (!container) return

  if (!leafletMapViewer) {
    leafletMapViewer = L.map('mapaLeafletViewer', { zoomControl: true }).setView([-6.3592, -39.2974], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(leafletMapViewer)
    markersViewerLayerGroup = L.layerGroup().addTo(leafletMapViewer)
  }

  if (polylineViewerLayer) {
    leafletMapViewer.removeLayer(polylineViewerLayer)
    polylineViewerLayer = null
  }
  if (markersViewerLayerGroup) {
    markersViewerLayerGroup.clearLayers()
  }

  if (rotaDados.value?.pontos && rotaDados.value.pontos.length > 0) {
    const latLngs = rotaDados.value.pontos.map((p) => [p.lat, p.lng])
    polylineViewerLayer = L.polyline(latLngs, {
      color: '#f59e0b',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(leafletMapViewer)

    leafletMapViewer.fitBounds(polylineViewerLayer.getBounds(), { padding: [40, 40] })

    if (rotaDados.value.marcadores) {
      // Paths extraídos dos ícones lucide-vue-next equivalentes (Circle, Droplet, RefreshCw, Flag, MapPin),
      // usados aqui como markup SVG cru pois o Leaflet renderiza os marcadores fora da árvore do Vue.
      const svgIconMap: Record<string, { path: string; color: string }> = {
        LARGADA: { path: '<circle cx="12" cy="12" r="10"/>', color: '#10b981' },
        HIDRATACAO: { path: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>', color: '#22d3ee' },
        RETORNO: { path: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>', color: '#f59e0b' },
        CHEGADA: { path: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>', color: '#fb7185' }
      }
      const defaultSvgIcon = {
        path: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
        color: '#f59e0b'
      }

      rotaDados.value.marcadores.forEach((m) => {
        const { path, color } = svgIconMap[m.tipo] || defaultSvgIcon
        const iconHtml = `<div style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></div>`
        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-leaflet-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
        const marker = L.marker([m.lat, m.lng], { icon: customIcon })
        marker.bindPopup(`<b>${m.titulo}</b>`)
        markersViewerLayerGroup.addLayer(marker)
      })
    }
  }
}

const imagemUrlFormatada = computed(() => {
  if (!props.mapaPercursoUrl) return null
  if (props.mapaPercursoUrl.startsWith('http')) return props.mapaPercursoUrl
  return `${apiBase.replace(/\/$/, '')}/${props.mapaPercursoUrl.replace(/^\//, '')}`
})

const gpxUrlFormatada = computed(() => {
  if (!props.gpxUrl) return null
  if (props.gpxUrl.startsWith('http')) return props.gpxUrl
  return `${apiBase.replace(/\/$/, '')}/${props.gpxUrl.replace(/^\//, '')}`
})

/**
 * Visoes que esta modalidade realmente tem.
 *
 * O alternador so aparecia quando existia rota desenhada. Quem publicasse mapa
 * externo mais imagem ficava sem ele, travado na primeira visao — a imagem
 * estava salva e o atleta nao tinha como chegar nela. O que decide e haver mais
 * de uma opcao, nao qual delas existe.
 */
const modosDisponiveis = computed(() => {
  const modos: Array<'desenhado' | 'embed' | 'imagem'> = []
  if (props.rotaGeoJson) modos.push('desenhado')
  if (props.mapaEmbedUrl) modos.push('embed')
  if (imagemUrlFormatada.value) modos.push('imagem')
  return modos
})

function zoomIn() {
  if (zoomNivel.value < 2.5) zoomNivel.value += 0.25
}

function zoomOut() {
  if (zoomNivel.value > 0.75) zoomNivel.value -= 0.25
}

function resetZoom() {
  zoomNivel.value = 1
}

function alternarTelaCheia() {
  emTelaCheia.value = !emTelaCheia.value
  setTimeout(() => {
    if (leafletMapViewer) {
      leafletMapViewer.invalidateSize()
    }
  }, 200)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Barra Superior de Controles e Alternância de Visão -->
    <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white rounded-2xl p-3 shadow-md">
      <div class="flex items-center gap-2">
        <Map :size="20" />
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-300">Mapa Interativo do Percurso</p>
          <p class="text-[11px] text-slate-400">Navegue no mapa, controle o zoom e veja os pontos de apoio.</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Alternador de Visão -->
        <div v-if="modosDisponiveis.length > 1" class="flex bg-slate-800 rounded-xl p-1 text-xs font-bold">
          <button
            v-if="rotaGeoJson"
            type="button"
            class="px-3 py-1 rounded-lg transition"
            :class="modoVisualizacao === 'desenhado' ? 'bg-secondary text-white' : 'text-slate-400 hover:text-white'"
            @click="modoVisualizacao = 'desenhado'; nextTick(() => initLeafletViewer())"
          >
            Percurso 3D
          </button>
          <button
            v-if="mapaEmbedUrl"
            type="button"
            class="px-3 py-1 rounded-lg transition"
            :class="modoVisualizacao === 'embed' ? 'bg-secondary text-white' : 'text-slate-400 hover:text-white'"
            @click="modoVisualizacao = 'embed'"
          >
            Mapa externo
          </button>
          <button
            v-if="imagemUrlFormatada"
            type="button"
            class="px-3 py-1 rounded-lg transition"
            :class="modoVisualizacao === 'imagem' ? 'bg-secondary text-white' : 'text-slate-400 hover:text-white'"
            @click="modoVisualizacao = 'imagem'"
          >
            Imagem
          </button>
        </div>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
          @click="alternarTelaCheia"
        >
          <template v-if="emTelaCheia"><X :size="14" /> Sair da Tela Cheia</template>
          <template v-else><Maximize :size="14" /> Tela Cheia</template>
        </button>
      </div>
    </div>

    <!-- Container do Mapa -->
    <div
      class="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 transition-all flex flex-col justify-center items-center"
      :class="emTelaCheia ? 'fixed inset-4 z-[200] max-h-none h-auto shadow-2xl' : 'min-h-[400px] h-[420px]'"
    >
      <!-- Visão 0: OpenStreetMap Leaflet com Rota Desenhada -->
      <div
        v-if="modoVisualizacao === 'desenhado' && rotaDados"
        class="w-full h-full relative"
      >
        <div id="mapaLeafletViewer" class="w-full h-full min-h-[400px] rounded-3xl"></div>

        <div class="absolute top-4 left-14 z-[400] bg-slate-900/90 backdrop-blur-md rounded-xl p-3 border border-slate-800 text-white text-xs space-y-0.5 shadow-lg">
          <p class="flex items-center gap-1.5 font-black text-warning"><Footprints :size="14" /> Percurso Oficial de {{ rotaDados?.distanciaKm || '5' }} KM</p>
          <p class="text-[11px] text-slate-300">Traçado oficial em ruas reais definido pelo organizador.</p>
        </div>
      </div>

      <!-- Visão 1: Embed iFrame (Google Maps / Strava / Wikiloc) -->
      <iframe
        v-else-if="modoVisualizacao === 'embed' && mapaEmbedUrl"
        :src="mapaEmbedUrl"
        class="w-full h-full border-0 rounded-3xl"
        allowfullscreen
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>

      <!-- Visão 2: Imagem do Mapa com Zoom e Pan -->
      <div
        v-else-if="imagemUrlFormatada"
        class="w-full h-full overflow-auto flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
      >
        <img
          :src="imagemUrlFormatada"
          alt="Mapa do Percurso"
          class="max-w-none transition-transform duration-200 object-contain rounded-xl shadow-2xl"
          :style="{ transform: `scale(${zoomNivel})` }"
        />
      </div>

      <!-- Visão Sem Mapa Cadastrado -->
      <div v-else class="text-center p-8 text-slate-400 space-y-3">
        <Map :size="40" class="mx-auto" />
        <p class="text-sm font-bold text-slate-300">Mapa do percurso em fase de definição pelo organizador.</p>
        <p class="text-xs text-slate-500">O traçado oficial com pontos de hidratação e altimetria será publicado em breve.</p>
      </div>

      <!-- Marcadores e legenda flutuante no mapa -->
      <div class="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 border border-slate-700/60 text-white flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-4 font-bold overflow-x-auto">
          <span class="flex items-center gap-1.5 text-emerald-400">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> <Circle :size="12" /> Largada
          </span>
          <span class="flex items-center gap-1.5 text-cyan-300">
            <Droplet :size="12" /> Hidratação (a cada 2,5km)
          </span>
          <span class="flex items-center gap-1.5 text-amber-300">
            <RefreshCw :size="12" /> Retorno 5km
          </span>
          <span class="flex items-center gap-1.5 text-rose-400">
            <Flag :size="12" /> Chegada
          </span>
        </div>

        <div class="flex items-center gap-2">
          <!-- O GPX vem primeiro: e o que o atleta leva para a prova. -->
          <a
            v-if="gpxUrlFormatada"
            :href="gpxUrlFormatada"
            download
            class="flex items-center gap-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 px-3 py-1 font-bold text-[11px] transition text-emerald-300"
          >
            <Watch :size="12" /> Baixar GPX
          </a>

          <a
            v-if="imagemUrlFormatada"
            :href="imagemUrlFormatada"
            target="_blank"
            download
            class="flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1 font-bold text-[11px] transition text-slate-200"
          >
            <Download :size="12" /> Baixar Imagem HD
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
