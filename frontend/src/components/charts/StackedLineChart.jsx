import ReactECharts from 'echarts-for-react'

export default function StackedLineChart({ categories = [], series = [], height = 360 }) {
  const option = {
    color: ['#21735a', '#c45c26', '#0ea5e9', '#7c3aed', '#b45309', '#059669'],
    tooltip: { trigger: 'axis' },
    legend: { data: series.map((s) => s.name), bottom: 0 },
    grid: { left: 40, right: 20, top: 30, bottom: 50 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: categories,
      axisLabel: {
        formatter: (v) => String(v).slice(5),
      },
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      stack: s.stack || 'Total',
      areaStyle: { opacity: 0.35 },
      emphasis: { focus: 'series' },
      smooth: true,
      data: s.data,
    })),
  }

  return (
    <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
  )
}
