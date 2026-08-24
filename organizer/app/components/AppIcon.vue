<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name:
      | 'dashboard'
      | 'eventos'
      | 'inscritos'
      | 'kits'
      | 'cronometragem'
      | 'resultados'
      | 'checkin'
      | 'financeiro'
      | 'verificacao'
      | 'camera'
      | 'documento'
      | 'user'
      | 'check'
      | 'warning'
      | 'whatsapp'
      | 'chevron'
      | 'lock'
      | 'logout'
      | 'menu'
      | 'close'
      | 'sparkles'
    size?: string | number
    class?: string
  }>(),
  {
    size: 20,
    class: ''
  }
)

const iconSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="iconSize"
    :height="iconSize"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="props.class"
    class="inline-block shrink-0 transition-colors"
  >
    <!-- Dashboard / Analytics -->
    <g v-if="name === 'dashboard'">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </g>

    <!-- Eventos / Calendar -->
    <g v-else-if="name === 'eventos'">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </g>

    <!-- Inscritos / Users -->
    <g v-else-if="name === 'inscritos'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </g>

    <!-- Kits / Package -->
    <g v-else-if="name === 'kits'">
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </g>

    <!-- Cronometragem / Timer / Stopwatch -->
    <g v-else-if="name === 'cronometragem'">
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="12" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </g>

    <!-- Resultados / Trophy -->
    <g v-else-if="name === 'resultados'">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </g>

    <!-- Check-in / QrCode -->
    <g v-else-if="name === 'checkin'">
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M3 12h.01" />
      <path d="M12 3h.01" />
      <path d="M12 16v.01" />
      <path d="M16 12h1" />
      <path d="M21 12v.01" />
      <path d="M12 21v-1" />
    </g>

    <!-- Financeiro / Wallet -->
    <g v-else-if="name === 'financeiro'">
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-0 4h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2V5" />
      <path d="M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </g>

    <!-- Verificacao / Shield Check -->
    <g v-else-if="name === 'verificacao'">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </g>

    <!-- Camera -->
    <g v-else-if="name === 'camera'">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </g>

    <!-- Documento / File Text -->
    <g v-else-if="name === 'documento'">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a1 1 0 0 0 1 1h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </g>

    <!-- User / Profile -->
    <g v-else-if="name === 'user'">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </g>

    <!-- Check Mark -->
    <g v-else-if="name === 'check'">
      <polyline points="20 6 9 17 4 12" />
    </g>

    <!-- Warning / Alert Triangle -->
    <g v-else-if="name === 'warning'">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </g>

    <!-- Whatsapp / Message -->
    <g v-else-if="name === 'whatsapp'">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </g>

    <!-- Chevron Right -->
    <g v-else-if="name === 'chevron'">
      <path d="m9 18 6-6-6-6" />
    </g>

    <!-- Lock -->
    <g v-else-if="name === 'lock'">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </g>

    <!-- Logout -->
    <g v-else-if="name === 'logout'">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </g>

    <!-- Menu -->
    <g v-else-if="name === 'menu'">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </g>

    <!-- Close / X -->
    <g v-else-if="name === 'close'">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </g>

    <!-- Sparkles -->
    <g v-else-if="name === 'sparkles'">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </g>
  </svg>
</template>
