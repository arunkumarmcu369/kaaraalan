import ReactECharts from 'echarts-for-react'

export default function DonutChart({ data = [], height = 280, title }) {
  const option = {
    color: ['#21735a', '#c45c26', '#0ea5e9', '#7c3aed', '#b45309'],
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: title || 'Share',
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data,
      },
    ],
  }
  return <ReactECharts option={option} style={{ height, width: '100%' }} notMerge />
}
