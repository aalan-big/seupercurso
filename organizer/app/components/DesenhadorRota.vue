<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

export interface PontoRota {
  lat: number
  lng: number
}

export interface MarcadorRota {
  id: string
  tipo: 'LARGADA' | 'HIDRATACAO' | 'RETORNO' | 'CHEGADA'
  lat: number
  lng: number
  titulo: string
}

const props = defineProps<{
  aberto: boolean
  rotaGeoJson?: string | null
  cidade?: string
  estado?: string
}>()

const emit = defineEmits<{
  (e: 'fechar'): void
  (e: 'salvar', payload: string): void
}>()

const pontos = ref<PontoRota[]>([])
const marcadores = ref<MarcadorRota[]>([])
const modoAtual = ref<'linha' | 'largada' | 'hidratacao' | 'retorno' | 'chegada'>('linha')
const salvando = ref(false)

const centroGeocodificado = ref<{ lat: number; lng: number }>({ lat: -6.3592, lng: -39.2974 })

// Geocodificação automática para QUALQUER cidade/estado do Brasil
async function buscarCoordenadasCidade() {
  if (!props.cidade) return
  try {
    const q = encodeURIComponent(`${props.cidade}, ${props.estado || ''}, Brasil`)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`)
    const data = await res.json()
    if (data && data.length > 0) {
      centroGeocodificado.value = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
    }
  } catch (e) {
    console.error('Erro na geocodificação da cidade:', e)
  }
}

let leafletMap: any = null
let polylineLayer: any = null
let markersLayerGroup: any = null

onMounted(() => {
  carregarLeafletScript()
})

function carregarLeafletScript() {
  if (typeof window === 'undefined') return

  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }

  if (!document.getElementById('leaflet-js')) {
    const script = document.createElement('script')
    script.id = 'leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      if (props.aberto) {
        nextTick(() => inicializarMapaLeaflet())
      }
    }
    document.head.appendChild(script)
  }
}

watch(
  () => props.aberto,
  async (val) => {
    if (val) {
      await buscarCoordenadasCidade()
      if (props.rotaGeoJson) {
        try {
          const parsed = JSON.parse(props.rotaGeoJson)
          pontos.value = parsed.pontos || []
          marcadores.value = parsed.marcadores || []
        } catch {
          pontos.value = []
          marcadores.value = []
        }
      }
      await nextTick()
      setTimeout(() => inicializarMapaLeaflet(), 100)
    } else {
      destruirMapa()
    }
  }
)

function inicializarMapaLeaflet() {
  if (typeof window === 'undefined' || !(window as any).L) return
  const L = (window as any).L

  const container = document.getElementById('leaflet-map-canvas')
  if (!container) return

  destruirMapa()

  const startLat = pontos.value.length > 0 ? pontos.value[0].lat : centroGeocodificado.value.lat
  const startLng = pontos.value.length > 0 ? pontos.value[0].lng : centroGeocodificado.value.lng

  leafletMap = L.map('leaflet-map-canvas', {
    center: [startLat, startLng],
    zoom: 15,
    zoomControl: true
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(leafletMap)

  markersLayerGroup = L.layerGroup().addTo(leafletMap)

  leafletMap.on('click', (e: any) => {
    const lat = e.latlng.lat
    const lng = e.latlng.lng

    if (modoAtual.value === 'linha') {
      pontos.value.push({ lat, lng })
    } else {
      let titulo = 'Ponto de Apoio'
      if (modoAtual.value === 'largada') titulo = '🟢 Largada'
      if (modoAtual.value === 'hidratacao') titulo = '💧 Hidratação'
      if (modoAtual.value === 'retorno') titulo = '🔄 Retorno'
      if (modoAtual.value === 'chegada') titulo = '🏁 Chegada'

      marcadores.value.push({
        id: Date.now().toString(),
        tipo: modoAtual.value.toUpperCase() as any,
        lat,
        lng,
        titulo
      })
      modoAtual.value = 'linha'
    }
    atualizarDesenhoMapaLeaflet()
  })

  atualizarDesenhoMapaLeaflet()
}

function atualizarDesenhoMapaLeaflet() {
  if (!leafletMap || typeof window === 'undefined' || !(window as any).L) return
  const L = (window as any).L

  if (polylineLayer) {
    leafletMap.removeLayer(polylineLayer)
    polylineLayer = null
  }
  if (markersLayerGroup) {
    markersLayerGroup.clearLayers()
  }

  if (pontos.value.length > 0) {
    const latLngs = pontos.value.map((p) => [p.lat, p.lng])
    polylineLayer = L.polyline(latLngs, {
      color: '#f59e0b',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(leafletMap)
  }

  marcadores.value.forEach((m) => {
    const iconHtml = `<div class="rounded-full bg-slate-900 border-2 border-amber-400 text-white font-black text-xs px-2.5 py-1 shadow-2xl flex items-center gap-1 whitespace-nowrap">
      <span>${m.tipo === 'LARGADA' ? '🟢' : m.tipo === 'HIDRATACAO' ? '💧' : m.tipo === 'RETORNO' ? '🔄' : '🏁'}</span>
      <span>${m.titulo}</span>
    </div>`
    const customIcon = L.divIcon({
      html: iconHtml,
      className: 'custom-leaflet-marker',
      iconSize: [120, 30],
      iconAnchor: [60, 15]
    })
    L.marker([m.lat, m.lng], { icon: customIcon }).addTo(markersLayerGroup)
  })
}

function destruirMapa() {
  if (leafletMap) {
    leafletMap.remove()
    leafletMap = null
  }
}

// Cálculo da distância em KM (Fórmula Haversine)
const distanciaTotalKm = computed(() => {
  if (pontos.value.length < 2) return '0.00'
  let totalMeters = 0
  for (let i = 0; i < pontos.value.length - 1; i++) {
    totalMeters += haversineDistance(pontos.value[i], pontos.value[i + 1])
  }
  return (totalMeters / 1000).toFixed(2)
})

function haversineDistance(coords1: PontoRota, coords2: PontoRota) {
  function toRad(x: number) {
    return (x * Math.PI) / 180
  }
  const R = 6371e3
  const dLat = toRad(coords2.lat - coords1.lat)
  const dLon = toRad(coords2.lng - coords1.lng)
  const lat1 = toRad(coords1.lat)
  const lat2 = toRad(coords2.lat)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function desfazerUltimoPonto() {
  pontos.value.pop()
  atualizarDesenhoMapaLeaflet()
}

function limparTudo() {
  if (confirm('Tem certeza que deseja limpar todo o traçado do percurso?')) {
    pontos.value = []
    marcadores.value = []
    atualizarDesenhoMapaLeaflet()
  }
}

function confirmarSalvar() {
  salvando.value = true
  const payload = JSON.stringify({
    pontos: pontos.value,
    marcadores: marcadores.value,
    distanciaKm: distanciaTotalKm.value
  })
  emit('salvar', payload)
  salvando.value = false
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="aberto"
      class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <!-- Backdrop escuro -->
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-md" @click="emit('fechar')"></div>

      <!-- Modal do Desenhador -->
      <div class="relative z-[121] w-full max-w-4xl rounded-3xl bg-slate-900 text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <!-- Cabeçalho -->
        <div class="flex items-center justify-between border-b border-slate-800 p-5 bg-slate-950">
          <div>
            <h2 class="text-xl font-black tracking-tight flex items-center gap-2 text-warning">
              <span>🎨</span> Desenhador de Rota Interativo (OpenStreetMap)
            </h2>
            <p class="text-xs text-slate-400">
              Clique nas ruas reais da cidade para traçar a rota. Adicione marcadores de hidratação e largada.
            </p>
          </div>
          <button type="button" class="rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white" @click="emit('fechar')">
            ✕
          </button>
        </div>

        <!-- Barra de Ferramentas de Desenho -->
        <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-3 border-b border-slate-800">
          <!-- Ferramenta Ativa -->
          <div class="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              :class="modoAtual === 'linha' ? 'bg-primary text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
              @click="modoAtual = 'linha'"
            >
              ✏️ Traçar Rota
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              :class="modoAtual === 'largada' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
              @click="modoAtual = 'largada'"
            >
              🟢 + Largada
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              :class="modoAtual === 'hidratacao' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
              @click="modoAtual = 'hidratacao'"
            >
              💧 + Hidratação
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              :class="modoAtual === 'chegada' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
              @click="modoAtual = 'chegada'"
            >
              🏁 + Chegada
            </button>
          </div>

          <!-- Ações Desfazer / Limpar -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="pontos.length === 0"
              class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              @click="desfazerUltimoPonto"
            >
              ↩️ Desfazer
            </button>
            <button
              type="button"
              :disabled="pontos.length === 0 && marcadores.length === 0"
              class="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-950 text-red-400 hover:bg-red-900 disabled:opacity-50"
              @click="limparTudo"
            >
              🗑️ Limpar
            </button>
          </div>
        </div>

        <!-- Canvas do Mapa Leaflet / OpenStreetMap com Ruas Reais -->
        <div class="relative flex-1 min-h-[420px] bg-slate-950 overflow-hidden">
          <div id="leaflet-map-canvas" class="w-full h-full min-h-[420px] z-0"></div>

          <!-- Orientação da Cidade -->
          <div class="absolute top-4 left-4 z-10 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 text-xs text-slate-300 shadow pointer-events-none">
            <p class="font-bold text-white">📍 Cidade: {{ cidade || 'Iguatu' }}/{{ estado || 'CE' }}</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Clique nas ruas reais para traçar a rota.</p>
          </div>
        </div>

        <!-- Rodapé com Contador de KM e Botão Salvar -->
        <div class="flex items-center justify-between border-t border-slate-800 p-5 bg-slate-950">
          <div class="flex items-center gap-4">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Distância Total Calculada:</p>
              <p class="text-2xl font-black text-warning font-mono">
                🏃 {{ distanciaTotalKm }} <span class="text-sm font-sans text-slate-300">km</span>
              </p>
            </div>
            <div class="text-xs text-slate-400 border-l border-slate-800 pl-4">
              <p>Pontos traçados: <strong class="text-white">{{ pontos.length }}</strong></p>
              <p>Marcadores criados: <strong class="text-white">{{ marcadores.length }}</strong></p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              @click="emit('fechar')"
            >
              Cancelar
            </button>
            <button
              type="button"
              :disabled="salvando || pontos.length === 0"
              class="rounded-xl bg-secondary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:brightness-95 disabled:opacity-50"
              @click="confirmarSalvar"
            >
              {{ salvando ? 'Salvando...' : '💾 Salvar Rota no Evento' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
