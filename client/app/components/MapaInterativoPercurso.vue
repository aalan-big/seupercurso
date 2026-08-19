<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  mapaPercursoUrl?: string | null
  mapaEmbedUrl?: string | null
  rotaGeoJson?: string | null
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
      const emojiMap: Record<string, string> = {
        LARGADA: '🟢',
        HIDRATACAO: '💧',
        RETORNO: '🔄',
        CHEGADA: '🏁'
      }

      rotaDados.value.marcadores.forEach((m) => {
        const emoji = emojiMap[m.tipo] || '📍'
        const iconHtml = `<div style="font-size: 22px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${emoji}</div>`
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
        <span class="text-lg">🗺️</span>
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-300">Mapa Interativo do Percurso</p>
          <p class="text-[11px] text-slate-400">Navegue no mapa, controle o zoom e veja os pontos de apoio.</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Alternador de Visão -->
        <div v-if="rotaGeoJson && (mapaEmbedUrl || imagemUrlFormatada)" class="flex bg-slate-800 rounded-xl p-1 text-xs font-bold">
          <button
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
            Iframe
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
          class="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
          @click="alternarTelaCheia"
        >
          {{ emTelaCheia ? '✕ Sair da Tela Cheia' : '⛶ Tela Cheia' }}
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
          <p class="font-black text-warning">🏃 Percurso Oficial de {{ rotaDados?.distanciaKm || '5' }} KM</p>
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
        <span class="text-4xl">🗺️</span>
        <p class="text-sm font-bold text-slate-300">Mapa do percurso em fase de definição pelo organizador.</p>
        <p class="text-xs text-slate-500">O traçado oficial com pontos de hidratação e altimetria será publicado em breve.</p>
      </div>

      <!-- Marcadores e legenda flutuante no mapa -->
      <div class="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 border border-slate-700/60 text-white flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-4 font-bold overflow-x-auto">
          <span class="flex items-center gap-1.5 text-emerald-400">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> 🟢 Largada
          </span>
          <span class="flex items-center gap-1.5 text-cyan-300">
            <span>💧</span> Hidratação (a cada 2,5km)
          </span>
          <span class="flex items-center gap-1.5 text-amber-300">
            <span>🔄</span> Retorno 5km
          </span>
          <span class="flex items-center gap-1.5 text-rose-400">
            <span>🏁</span> Chegada
          </span>
        </div>

        <a
          v-if="imagemUrlFormatada"
          :href="imagemUrlFormatada"
          target="_blank"
          download
          class="rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1 font-bold text-[11px] transition text-slate-200"
        >
          ⬇️ Baixar Imagem HD
        </a>
      </div>
    </div>
  </div>
</template>
