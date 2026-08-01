import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { LABEL_GLASS, LABEL_PET_300, LABEL_PET_220 } from '../../constants/labels'

/** Eight clearly distinguishable colours for the fixed flavour set. */
export const FLAVOUR_CHART_COLORS = [
  '#0F766E', // Paneer — teal
  '#CA8A04', // Lemon — gold
  '#EA580C', // Orange — orange
  '#4F46E5', // Blueberry — indigo
  '#B45309', // Ginger — amber
  '#BE185D', // Nannari — rose
  '#7C3AED', // Grape — violet
  '#16A34A', // Pineapple — green
]

function displayFlavour(name) {
  if (name === 'BlueBerry') return 'Blueberry'
  return name
}

export default function FlavourTrendChart({
  categories = [],
  flavourSeries = [],
  height = 360,
}) {
  const legendItems = useMemo(
    () =>
      flavourSeries.map((s, index) => ({
        key: s.name,
        label: displayFlavour(s.name),
        color: FLAVOUR_CHART_COLORS[index % FLAVOUR_CHART_COLORS.length],
      })),
    [flavourSeries]
  )

  const [hidden, setHidden] = useState({})

  useEffect(() => {
    setHidden((prev) => {
      const next = { ...prev }
      let changed = false
      for (const item of legendItems) {
        if (!(item.label in next)) {
          next[item.label] = false
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [legendItems])

  const option = useMemo(() => {
    const breakdownByFlavour = {}
    for (const s of flavourSeries) {
      breakdownByFlavour[displayFlavour(s.name)] = s.breakdown || []
    }

    const selected = {}
    for (const item of legendItems) {
      selected[item.label] = !hidden[item.label]
    }

    return {
      color: FLAVOUR_CHART_COLORS,
      tooltip: {
        trigger: 'axis',
        confine: true,
        appendToBody: false,
        formatter: (params) => {
          if (!params?.length) return ''
          const dataIndex = params[0].dataIndex
          const date = categories[dataIndex] || params[0].axisValueLabel || ''
          const lines = [`<div style="font-weight:700;margin-bottom:6px">${date}</div>`]
          for (const p of params) {
            if (p.value == null) continue
            const name = p.seriesName
            const bd = breakdownByFlavour[name]?.[dataIndex] || {}
            const glass = Number(bd.glass || 0)
            const pet300 = Number(bd.pet_300 || 0)
            const pet220 = Number(bd.pet_220 || 0)
            const total = Number(bd.total ?? p.value ?? 0)
            const marker = p.marker || ''
            lines.push(
              `<div style="margin-top:8px">${marker}<span style="font-weight:700">${name}</span></div>` +
                `<div style="padding-left:18px">${LABEL_GLASS}: <b>${glass}</b></div>` +
                `<div style="padding-left:18px">${LABEL_PET_300}: <b>${pet300}</b></div>` +
                `<div style="padding-left:18px">${LABEL_PET_220}: <b>${pet220}</b></div>` +
                `<div style="padding-left:18px">Total: <b>${total}</b></div>`
            )
          }
          return lines.join('')
        },
      },
      legend: {
        show: false,
        selected,
      },
      grid: { left: 12, right: 12, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLabel: {
          formatter: (v) => String(v).slice(5),
        },
      },
      yAxis: { type: 'value', minInterval: 1 },
      series: flavourSeries.map((s) => ({
        name: displayFlavour(s.name),
        type: 'line',
        areaStyle: { opacity: 0.25 },
        emphasis: { focus: 'series' },
        smooth: true,
        data: s.data,
      })),
    }
  }, [categories, flavourSeries, legendItems, hidden])

  const toggleFlavour = (label) => {
    setHidden((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-full overflow-hidden">
      <div className="w-full min-w-0 overflow-hidden">
        <ReactECharts
          option={option}
          style={{ height, width: '100%' }}
          className="!w-full"
          notMerge
          lazyUpdate
          opts={{ renderer: 'canvas' }}
        />
      </div>

      <ul className="mt-3 flex w-full min-w-0 flex-wrap items-center justify-center gap-2">
        {legendItems.map((item) => {
          const isOn = !hidden[item.label]
          return (
            <li key={item.key} className="min-w-0">
              <button
                type="button"
                onClick={() => toggleFlavour(item.label)}
                aria-pressed={isOn}
                title={isOn ? `Hide ${item.label}` : `Show ${item.label}`}
                className={`inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold ring-1 transition ${
                  isOn
                    ? 'bg-white text-ink ring-brand-100 hover:bg-brand-50/60'
                    : 'bg-slate-50 text-muted ring-slate-200 line-through opacity-70'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: isOn ? item.color : '#94a3b8' }}
                  aria-hidden
                />
                <span>{item.label}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  {isOn ? 'Hide' : 'Show'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
