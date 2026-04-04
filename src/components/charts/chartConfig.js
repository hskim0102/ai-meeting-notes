import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
)

export function getChartOptions(isDark, overrides = {}) {
  const textColor = isDark ? '#a1a1aa' : '#64748b'
  const gridColor = isDark ? '#27272a' : '#e2e8f0'

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 750, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        display: overrides.showLegend ?? false,
        position: 'bottom',
        labels: { color: textColor, padding: 16, usePointStyle: true, pointStyleWidth: 8 },
      },
      tooltip: {
        backgroundColor: isDark ? '#27272a' : '#ffffff',
        titleColor: isDark ? '#fafafa' : '#0f172a',
        bodyColor: isDark ? '#a1a1aa' : '#475569',
        borderColor: isDark ? '#3f3f46' : '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11 } },
        border: { display: false },
      },
      ...overrides.scales,
    },
    ...overrides,
  }
}

export const chartColors = {
  primary: 'rgb(59, 130, 246)',
  primaryLight: 'rgba(59, 130, 246, 0.15)',
  accent: 'rgb(139, 92, 246)',
  accentLight: 'rgba(139, 92, 246, 0.15)',
  success: 'rgb(34, 197, 94)',
  warning: 'rgb(245, 158, 11)',
  danger: 'rgb(239, 68, 68)',
  palette: [
    'rgb(59, 130, 246)',
    'rgb(139, 92, 246)',
    'rgb(34, 197, 94)',
    'rgb(245, 158, 11)',
    'rgb(239, 68, 68)',
    'rgb(6, 182, 212)',
  ],
}

export function createGradient(ctx, colorTop, colorBottom) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight)
  gradient.addColorStop(0, colorTop)
  gradient.addColorStop(1, colorBottom)
  return gradient
}
