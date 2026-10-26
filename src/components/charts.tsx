import { useId, useMemo, useState, type PointerEvent } from 'react'
import type { LiveSystem } from '../lib/live'
import { Segmented } from './ui'

const W = 860
const H = 242
const M = { top: 12, right: 8, bottom: 22, left: 47 }

const SYSTEM_RANGES = ['12M', '3Y', '5Y', 'ALL'] as const
type SystemRange = (typeof SYSTEM_RANGES)[number]
const RANGE_MONTHS: Record<SystemRange, number> = { '12M': 12, '3Y': 36, '5Y': 60, 'ALL': Number.POSITIVE_INFINITY }

const SYSTEM_COLORS: Record<string, string> = { CHAKRA: '#c7f36b', DHRUVA: '#63e6be' }

function monthLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export function SystemsChart({ systems }: { systems: LiveSystem[] }) {
  const [range, setRange] = useState<SystemRange>('ALL')
  const [hover, setHover] = useState<number | null>(null)
  const gradientId = useId().replace(/:/g, '')
  const full = useMemo(() => {
    const byMonth = new Map<string, { month: string; values: Record<string, number> }>()
    for (const system of systems) {
      for (const point of system.curve) {
        const entry = byMonth.get(point.month) ?? { month: point.month, values: {} }
        entry.values[system.name] = point.equity_index
        byMonth.set(point.month, entry)
      }
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [systems])
  const visible = useMemo(() => full.slice(-Math.min(full.length, RANGE_MONTHS[range])), [full, range])

  const chart = useMemo(() => {
    const series = systems.map((system) => visible.map((point) => point.values[system.name] ?? NaN))
    const values = series.flat().filter((value) => Number.isFinite(value))
    const min = Math.min(100, ...values)
    const max = Math.max(100, ...values)
    const padding = Math.max(5, (max - min) * 0.14)
    const lo = min - padding
    const hi = max + padding
    const innerW = W - M.left - M.right
    const innerH = H - M.top - M.bottom
    const x = (index: number) => M.left + (index / Math.max(1, visible.length - 1)) * innerW
    const y = (value: number) => M.top + ((hi - value) / Math.max(1, hi - lo)) * innerH
    const line = (numbers: number[]) =>
      numbers
        .map((value, index) => (Number.isFinite(value) ? `${index === 0 || !Number.isFinite(numbers[index - 1]) ? 'M' : 'L'}${x(index).toFixed(2)},${y(value).toFixed(2)}` : ''))
        .join(' ')
    const lastPoint = visible.length - 1
    const area = systems.map((_system, s) =>
      `${line(series[s])} L${x(lastPoint).toFixed(2)},${(H - M.bottom).toFixed(2)} L${M.left},${(H - M.bottom).toFixed(2)} Z`,
    )
    const grid = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
      value: hi - (hi - lo) * fraction,
      y: M.top + innerH * fraction,
    }))
    const tickCount = Math.min(5, visible.length)
    const ticks = Array.from({ length: tickCount }, (_, i) => {
      const index = Math.round((i / Math.max(1, tickCount - 1)) * (visible.length - 1))
      return { index, label: monthLabel(visible[index].month) }
    })
    return { series, line, area, grid, ticks, innerH, x, y, lastPoint }
  }, [systems, visible])

  const active = hover === null ? chart.lastPoint : hover
  const activePoint = visible[active]

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    const ratio = Math.max(0, Math.min(1, (px - M.left) / (W - M.left - M.right)))
    setHover(Math.round(ratio * (visible.length - 1)))
  }

  return (
    <>
      <div className="chart-toolbar">
        <div>
          <div className="chart-value-row">
            {systems.map((system) => {
              const value = activePoint?.values[system.name]
              return (
                <span className="chart-value" key={system.name} style={{ fontSize: 15, color: SYSTEM_COLORS[system.name] ?? 'var(--text)' }}>
                  {value !== undefined ? value.toFixed(1) : '—'}
                  <span style={{ fontSize: 8, color: 'var(--muted-dim)', marginLeft: 4 }}>{system.name}</span>
                </span>
              )
            })}
          </div>
          <div className="card-sub">
            {activePoint ? monthLabel(activePoint.month) : ''} · normalised index, base 100
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div className="chart-legend" aria-hidden="true">
            {systems.map((system) => (
              <span className="legend-key" key={system.name}>
                <i className="legend-line" style={{ background: SYSTEM_COLORS[system.name] ?? undefined }} /> {system.name}
              </span>
            ))}
          </div>
          <Segmented options={SYSTEM_RANGES} value={range} onChange={setRange} ariaLabel="Systems chart range" />
        </div>
      </div>
      <div className="equity-chart-wrap">
        <svg
          className="equity-chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="CHAKRA and DHRUVA system equity index curves, base 100"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            {systems.map((system) => (
              <linearGradient id={`system-fill-${gradientId}-${system.name}`} x1="0" y1="0" x2="0" y2="1" key={system.name}>
                <stop offset="0%" stopColor={SYSTEM_COLORS[system.name] ?? '#c7f36b'} stopOpacity="0.14" />
                <stop offset="100%" stopColor={SYSTEM_COLORS[system.name] ?? '#c7f36b'} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {chart.grid.map((line) => (
            <g key={line.y}>
              <line x1={M.left} x2={W - M.right} y1={line.y} y2={line.y} stroke="#1a2532" strokeWidth="1" strokeDasharray={line.y === chart.grid[4].y ? '0' : '2 4'} />
              <text x={M.left - 7} y={line.y + 3} fill="#5b6879" fontSize="8.4" fontFamily="JetBrains Mono Variable, monospace" textAnchor="end">
                {line.value.toFixed(0)}
              </text>
            </g>
          ))}
          {systems.map((system, s) => (
            <path key={system.name} d={chart.area[s]} fill={`url(#system-fill-${gradientId}-${system.name})`} />
          ))}
          {systems.map((system, s) => (
            <path
              key={system.name}
              d={chart.line(chart.series[s])}
              fill="none"
              stroke={SYSTEM_COLORS[system.name] ?? '#c7f36b'}
              strokeWidth="1.7"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {activePoint ? (
            <line x1={chart.x(active)} x2={chart.x(active)} y1={M.top} y2={H - M.bottom} stroke="#3b4b5e" strokeWidth="1" strokeDasharray="3 3" />
          ) : null}
          {chart.ticks.map((tick) => (
            <text
              key={tick.index}
              x={chart.x(tick.index)}
              y={H - 4}
              fill="#5b6879"
              fontSize="8"
              fontFamily="JetBrains Mono Variable, monospace"
              textAnchor={tick.index === 0 ? 'start' : tick.index === visible.length - 1 ? 'end' : 'middle'}
            >
              {tick.label}
            </text>
          ))}
        </svg>
        {hover !== null && activePoint ? (
          <div className="chart-tooltip" style={{ left: `${(chart.x(active) / W) * 100}%` }} role="status">
            <div className="chart-tooltip-date">{monthLabel(activePoint.month)}</div>
            {systems.map((system) => (
              <div className="chart-tooltip-row" key={system.name}>
                <span>{system.name}</span>
                <strong style={{ color: SYSTEM_COLORS[system.name] }}>
                  {activePoint.values[system.name] !== undefined ? activePoint.values[system.name].toFixed(1) : '—'}
                </strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}
