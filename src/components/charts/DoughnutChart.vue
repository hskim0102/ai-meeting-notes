<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { getChartOptions } from './chartConfig.js'

const props = defineProps({
  chartData: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 250 },
})

const mergedOptions = computed(() => {
  const base = getChartOptions(props.isDark, { showLegend: true, ...props.options })
  delete base.scales
  return base
})
</script>

<template>
  <div :style="{ height: height + 'px' }">
    <Doughnut :data="chartData" :options="mergedOptions" />
  </div>
</template>
