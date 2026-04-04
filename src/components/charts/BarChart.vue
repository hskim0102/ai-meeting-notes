<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { getChartOptions } from './chartConfig.js'

const props = defineProps({
  chartData: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 250 },
})

const mergedOptions = computed(() => getChartOptions(props.isDark, {
  ...props.options,
  scales: { ...props.options.scales, y: { ...props.options.scales?.y, beginAtZero: true } },
}))
</script>

<template>
  <div :style="{ height: height + 'px' }">
    <Bar :data="chartData" :options="mergedOptions" />
  </div>
</template>
