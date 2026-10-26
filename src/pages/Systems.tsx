import { LineChart } from 'lucide-react'
import { useLive } from '../lib/live'
import { inr, pct } from '../lib/format'
import { EmptyState, PageHeader, Pill } from '../components/ui'
import { SystemsChart } from '../components/charts'

function monthLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const SYSTEM_COLORS: Record<string, string> = { CHAKRA: '#c7f36b', DHRUVA: '#63e6be' }

// Frozen allocation ladder (switch rule card). Hard thresholds: DHRUVA wakes at
// ₹4.5L capital, 50/50 split from ₹9L — see the switch-rule card on this page.
const LADDER = [
  { range: '< ₹4.5L', alloc: 'CHAKRA only' },
  { range: '₹4.5L – ₹9L', alloc: 'CHAKRA only' },
  { range: '≥ ₹9L', alloc: '50 / 50 both systems' },
]

function activeLadderRow(equity: number): number {
  return equity < 450_000 ? 0 : equity < 900_000 ? 1 : 2
}

export function Systems() {
  const live = useLive()

  return (
    <>
      <PageHeader
        eyebrow="Monthly momentum rotation · CHAKRA + DHRUVA"
        title="Systems"
        subtitle="Tracked monthly equity index, base 100, from the live export (live.json). Headline drawdowns are daily-basis — the month-end figure is shown beside them, never hidden."
      />

      {live.status === 'ok' ? (
        <>
          <section className="kpi-grid" aria-label="System summary">
            {live.data.systems.map((system) => {
              const finalIndex = system.curve[system.curve.length - 1]?.equity_index ?? NaN
              return (
                <div className="card kpi-card" key={system.name}>
                  <div className="kpi-label">
                    <LineChart />
                    <strong style={{ color: SYSTEM_COLORS[system.name], fontSize: 11 }}>{system.name}</strong>
                    <Pill tone={system.status === 'LIVE' ? 'lime' : 'amber'}>{system.status}</Pill>
                  </div>
                  <div className="kpi-value">{Number.isFinite(finalIndex) ? finalIndex.toFixed(1) : '—'}</div>
                  <div className="kpi-delta">
                    <span className="chip">live index from ₹10L</span>
                    <span>
                      {Number.isFinite(finalIndex)
                        ? `₹${((finalIndex / 100) * 10_00_000 / 100_000).toFixed(2)}L terminal value of a ₹10L start`
                        : 'curve unavailable'}
                    </span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className="cost-row">
                      <span>CAGR</span>
                      <strong>{pct(system.cagr_pct, 1)}</strong>
                    </div>
                    <div className="cost-row">
                      <span>Max drawdown (daily)</span>
                      <strong className="neg">{pct(system.max_dd_pct, 1)}</strong>
                    </div>
                    <div className="cost-row">
                      <span className="mono" style={{ color: 'var(--muted-dim)' }}>max DD month-end</span>
                      <strong className="neg" style={{ fontSize: 10 }}>{pct(system.max_dd_monthly_pct, 1)}</strong>
                    </div>
                    <div className="cost-row">
                      <span>Sharpe</span>
                      <strong>{system.sharpe.toFixed(1)}</strong>
                    </div>
                    <div className="cost-row">
                      <span>Positive months</span>
                      <strong>{system.positive_months} / {system.months}</strong>
                    </div>
                    <div className="cost-row">
                      <span>Best month</span>
                      <strong className="pos">{monthLabel(system.best_month.month)} · {pct(system.best_month.ret_pct, 1)}</strong>
                    </div>
                    <div className="cost-row">
                      <span>Worst month</span>
                      <strong className="neg">{monthLabel(system.worst_month.month)} · {pct(system.worst_month.ret_pct, 1)}</strong>
                    </div>
                  </div>
                  <div style={{ color: 'var(--muted-dim)', fontSize: 8.5, marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                    {system.status === 'PARKED'
                      ? `Parked · activates at ₹4.5L capital — see switch rule below${system.name === 'DHRUVA' && live.data.account.equity < 450_000 ? ` · now ${inr(live.data.account.equity)}` : ''}`
                      : 'Live allocation'}
                  </div>
                </div>
              )
            })}
          </section>

          <section style={{ marginTop: 10 }}>
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>Equity curves</h2>
                  <p>CHAKRA vs DHRUVA · normalised monthly index, base 100 · {live.data.systems[0]?.curve.length ?? 0} months</p>
                </div>
                <Pill tone="lime">Live</Pill>
              </div>
              <SystemsChart systems={live.data.systems} />
              <div className="chart-foot">
                <span>Backtested / tracked index · base 100 · not account equity</span>
                <span>Hover to read any month's index value</span>
              </div>
            </div>
          </section>

          <section className="overview-bottom" style={{ marginTop: 10 }}>
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>Switch rule</h2>
                  <p>Frozen 2026-10-22 · changed only at a DHRUVA rebalance (Jan / Jul), one-time</p>
                </div>
                <Pill tone="amber">Fixed spec</Pill>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Account equity</th>
                      <th>Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LADDER.map((rung, index) => (
                      <tr key={rung.range} className={index === activeLadderRow(live.data.account.equity) ? 'sw-active' : undefined}>
                        <td>{rung.range}</td>
                        <td>
                          {rung.alloc}
                          {index === activeLadderRow(live.data.account.equity) ? <Pill tone="lime" className="sw-current">Now</Pill> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ color: 'var(--muted-dim)', fontSize: 8.5, margin: '8px 17px 0' }}>
                Account equity today {inr(live.data.account.equity)} — the marked row applies. CHAKRA stays the only allocation until ₹9L.
              </p>
            </div>

            <div className="card">
              <div className="section-head">
                <div>
                  <h2>Recent months</h2>
                  <p>Monthly returns · negatives red, zeros muted</p>
                </div>
                <Pill tone="lime">Live</Pill>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>CHAKRA</th>
                      <th>DHRUVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...live.data.recent_months.slice(-12)].reverse().map((row) => (
                      <tr key={row.month}>
                        <td>{monthLabel(row.month)}</td>
                        <td
                          className={`num ${row.chakra_pct === 0 ? '' : row.chakra_pct < 0 ? 'neg' : 'pos'}`}
                          style={row.chakra_pct === 0 ? { color: 'var(--muted-dim)' } : undefined}
                        >
                          {pct(row.chakra_pct, 1)}
                        </td>
                        <td
                          className={`num ${row.dhruva_pct === 0 ? '' : row.dhruva_pct < 0 ? 'neg' : 'pos'}`}
                          style={row.dhruva_pct === 0 ? { color: 'var(--muted-dim)' } : undefined}
                        >
                          {pct(row.dhruva_pct, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section>
          <div style={{ padding: 18 }}>
            <EmptyState
              icon={<LineChart />}
              title={live.status === 'error' ? 'System data unavailable' : 'Loading system data…'}
              text={
                live.status === 'error'
                  ? `${live.error} — curves and stats appear once live.json is reachable.`
                  : 'Fetching exported engine data.'
              }
            />
          </div>
        </section>
      )}
    </>
  )
}
