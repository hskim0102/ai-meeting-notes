<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { getChartOptions } from './chartConfig.js'

const props = defineProps({
  chartData: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 250 },
})

const mergedOptions = computed(() => getChartOptions(props.isDark, props.options))
</script>

<template>
  <div :style="{ height: height + 'px' }">
    <Line :data="chartData" :options="mergedOptions" />
  </div>
</template>
