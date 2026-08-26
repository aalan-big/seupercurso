<script setup lang="ts">
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const props = defineProps<{
  titulo: string
  serie: { data: string; quantidade: number }[]
}>()

function formatarLabel(iso: string) {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

const dados = computed(() => ({
  labels: props.serie.map((p) => formatarLabel(p.data)),
  datasets: [
    {
      data: props.serie.map((p) => p.quantidade),
      borderColor: '#ff7202',
      borderWidth: 3,
      pointBackgroundColor: '#0F172A',
      pointBorderColor: '#ff7202',
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.4,
      fill: true,
      backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
        const { chart } = ctx
        const { chartArea } = chart
        if (!chartArea) return 'rgba(255, 114, 2, 0.15)'
        const gradiente = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradiente.addColorStop(0, 'rgba(255, 114, 2, 0.35)')
        gradiente.addColorStop(1, 'rgba(255, 114, 2, 0)')
        return gradiente
      }
    }
  ]
}))

const opcoes = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0F172A',
      titleColor: '#fff',
      bodyColor: '#ff7202',
      padding: 10,
      cornerRadius: 8,
      displayColors: false
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#64748B', font: { size: 11 } }
    },
    y: {
      beginAtZero: true,
      grid: { color: '#E2E8F0' },
      ticks: { color: '#94A3B8', font: { size: 11 }, precision: 0 }
    }
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">{{ titulo }}</h2>
    <div class="mt-4 h-56">
      <Line :data="dados" :options="opcoes" />
    </div>
  </div>
</template>
