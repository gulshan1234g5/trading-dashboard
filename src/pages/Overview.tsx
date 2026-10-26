import {
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  LineChart,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { PageId } from '../types'
import { useLive } from '../lib/live'
import { inr, pct } from '../lib/format'
import { EmptyState, PageHeader, Pill, ProgressBar } from '../components/ui'
import { SystemsChart } from '../components/charts'
import { DemoBanner } from '../components/layout'

// Habitual hard floor from the capital rail (reports/live/state.json): below it
// even ₹1,000 slots are a fee-paying experiment, not the modelled system.
const HARD_FLOOR = 22_500

export function Overview({ navigate }: { navigate: (page: PageId) => void }) {
  const live = useLive()
  const account = live.status === 'ok' ? live.data.account : null
  const gate = live.status === 'ok' ? live.data.gate : null
  const floorPct = account ? Math.min(100, (account.equity / account.capital_floor) * 100) : 0

  return (
    <>
      <PageHeader
        eyebrow="NSE · Monthly momentum rotation · Zerodha"
        title="Command overview"
        subtitle="Account capital, regime gate, system performance and the month-end runbook are live from the export (live.json) and the frozen RUNBOOK — no demo panels."
      />
      <DemoBanner onPlaybook={() => navigate('playbook')} />

      <section className="kpi-grid" aria-label="Account summary">
        <div className="card kpi-card featured">
          <div className="kpi-label">
            <Wallet /> Account equity {live.status === 'ok' ? <Pill tone="lime">Live</Pill> : <Pill tone="amber">{live.status === 'error' ? 'Demo · fetch failed' : 'Loading'}</Pill>}
          </div>
          <div className="kpi-value">{account ? inr(account.equity) : '—'}</div>
          <div className="kpi-delta">
            <span className="chip">{account ? account.broker.toLowerCase() : 'live.json'}</span>
            <span>
              {account
                ? account.floor_status === 'below'
                  ? `below the ${inr(account.capital_floor)} floor`
                  : `at or above the ${inr(account.capital_floor)} floor`
                : 'Fetching live snapshot…'}
            </span>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">
            <CircleDollarSign /> Free cash
          </div>
          <div className="kpi-value">{account ? inr(account.cash) : '—'}</div>
          <div className="kpi-delta">
            <span className="chip">settled &amp; available</span>
            <span>{account ? account.capital_plan_note : ''}</span>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">
            <BriefcaseBusiness /> Open positions
          </div>
          <div className="kpi-value">{account ? account.n_positions : '—'}</div>
          <div className="kpi-delta">
            <span className="chip">{account && account.holdings.length === 0 ? 'fully flat' : `${account?.holdings.length ?? 0} holdings`}</span>
            <span>live broker holdings · not a demo ledger</span>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">
            <ShieldAlert /> Market gate {gate ? <Pill tone={gate.mode === 'off' ? 'neutral' : gate.filter === 'ON' ? 'lime' : 'amber'}>{gate.mode === 'off' ? 'Disabled' : gate.filter === 'ON' ? 'In market' : 'Out of market'}</Pill> : null}
          </div>
          <div className="kpi-value">{gate ? pct(gate.gap_pct) : '—'}</div>
          <div className="kpi-delta">
            <span className="chip">NIFTY vs 200-DMA</span>
            <span>{gate ? `next decision ${gate.next_decision}` : ''}</span>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 10, padding: 16 }} aria-label="Capital floor progress">
        <div className="budget-row">
          <div className="budget-labels">
            <span>Capital floor</span>
            <strong>{account ? `${inr(account.equity)} of ${inr(account.capital_floor)}` : '—'}</strong>
          </div>
        </div>
        <ProgressBar value={floorPct} tone={floorPct >= 100 ? 'lime' : 'amber'} />
        <p style={{ color: 'var(--muted)', fontSize: 9.5, margin: '8px 0 0', lineHeight: 1.6 }}>
          Below {account ? inr(account.capital_floor) : '₹45,000'} the ₹15.34/slot DP charge breaks the modelled 0.22%
          round-trip cost. Hard floor {inr(HARD_FLOOR)}{gate?.mode === 'off' ? ' · gate disabled (override) — buy lists print every month-end, the floor is the only brake' : ' — below it, skip the month and keep depositing'}.
        </p>
      </section>

      <section className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-head" style={{ paddingBottom: 0 }}>
            <div>
              <div className="card-title-row">
                <LineChart className="icon-inline" />
                <h2 className="card-title">System performance</h2>
                {live.status === 'ok' ? <Pill tone="lime">Live</Pill> : <Pill tone="amber">Demo</Pill>}
              </div>
              <p className="card-sub">
                Monthly equity index, base 100 · 141 tracked months
              </p>
            </div>
            <button type="button" className="section-link" onClick={() => navigate('systems')}>
              Systems <ChevronRight />
            </button>
          </div>
          {live.status === 'ok' ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 0 0' }}>
                {live.data.systems.map((system) => (
                  <div
                    className="card"
                    key={system.name}
                    style={{ flex: '1 1 220px', minWidth: 200, padding: '10px 12px', background: 'rgba(13,18,25,0.55)' }}
                  >
                    <div className="card-title-row" style={{ fontSize: 10 }}>
                      <strong style={{ color: system.name === 'CHAKRA' ? '#c7f36b' : '#63e6be' }}>{system.name}</strong>
                      <Pill tone={system.status === 'LIVE' ? 'mint' : 'amber'}>{system.status}</Pill>
                    </div>
                    <div className="cost-row" style={{ border: 0 }}>
                      <span>CAGR</span>
                      <strong>{pct(system.cagr_pct, 1)}</strong>
                    </div>
                    <div className="cost-row" style={{ border: 0 }}>
                      <span>Max drawdown</span>
                      <strong className="neg">{pct(system.max_dd_pct, 1)} daily</strong>
                    </div>
                    <div className="cost-row" style={{ border: 0 }}>
                      <span className="mono" style={{ color: 'var(--muted-dim)' }}>month-end</span>
                      <strong className="neg" style={{ fontSize: 9 }}>{pct(system.max_dd_monthly_pct, 1)}</strong>
                    </div>
                    <div className="cost-row" style={{ border: 0 }}>
                      <span>Sharpe</span>
                      <strong>{system.sharpe.toFixed(1)}</strong>
                    </div>
                    <div className="cost-row" style={{ border: 0 }}>
                      <span>Positive months</span>
                      <strong>{system.positive_months} / {system.months}</strong>
                    </div>
                    <div style={{ color: 'var(--muted-dim)', fontSize: 8.5, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                      {system.status === 'PARKED' ? 'Parked · activates at ₹4.5L capital' : 'Live allocation'}
                    </div>
                  </div>
                ))}
              </div>
              <SystemsChart systems={live.data.systems} />
              <div className="chart-foot">
                <span>Max drawdown headlines are daily-basis; month-end closing figures are shown above.</span>
                <span>Backtested / tracked index · base 100 · not account equity</span>
              </div>
            </>
          ) : (
            <div style={{ padding: 18 }}>
              <EmptyState
                icon={<LineChart />}
                title={live.status === 'error' ? 'Live curves unavailable' : 'Loading system curves…'}
                text={live.status === 'error' ? `${live.error} — system performance will appear once live.json is reachable.` : 'Fetching exported engine data.'}
              />
            </div>
          )}
        </div>

        <div className="right-stack">
          <div className="card risk-card">
            <div className="engine-head">
              <div>
                <div className="card-title-row">
                  <ShieldCheck className="icon-inline" />
                  <h2 className="card-title">Regime gate</h2>
                </div>
                <p className="card-sub">{gate?.mode === 'off' ? '200-DMA filter disabled · user override (SPEC_GATE_OFF_LIVE)' : '200-DMA filter · monthly decision cycle'}</p>
              </div>
              {gate ? <Pill tone={gate.mode === 'off' ? 'neutral' : gate.filter === 'ON' ? 'lime' : 'amber'}>{gate.mode === 'off' ? 'Gate disabled' : `Filter ${gate.filter}`}</Pill> : <Pill tone="amber">Loading</Pill>}
            </div>
            {gate ? (
              <>
                <div className="budget-row">
                  <div className="budget-labels">
                    <span>NIFTY 50 / 200-DMA</span>
                    <strong>
                      {gate.nifty_close.toLocaleString('en-IN', { minimumFractionDigits: 2 })} /{' '}
                      {gate.dma200.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="budget-labels">
                    <span>Gap to 200-DMA</span>
                    <strong className={gate.gap_pct < 0 ? 'neg' : 'pos'}>{pct(gate.gap_pct)}</strong>
                  </div>
                  <div className="budget-labels">
                    <span>Last / next decision</span>
                    <strong>{gate.last_decision} → {gate.next_decision}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 13 }}>
                  <button type="button" className="section-link" onClick={() => navigate('playbook')}>
                    Month-end playbook <ChevronRight />
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: 18 }}>
                <EmptyState icon={<ShieldCheck />} title={live.status === 'error' ? 'Gate unavailable' : 'Loading gate…'} text="Gate status appears once live.json is reachable." />
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 10 }}>
        <div className="card">
          <div className="section-head">
            <div>
              <h2>Recent months</h2>
              <p>Monthly system returns · {live.status === 'ok' ? `${live.data.recent_months.length} months through ${live.data.recent_months[live.data.recent_months.length - 1].month}` : 'loading'}</p>
            </div>
            {live.status === 'ok' ? <Pill tone="lime">Live</Pill> : <Pill tone="amber">Loading</Pill>}
          </div>
          {live.status === 'ok' ? (
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
                  {[...live.data.recent_months].reverse().map((row) => (
                    <tr key={row.month}>
                      <td>{new Date(`${row.month}T12:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                      <td className={row.chakra_pct === 0 ? 'num' : `num ${row.chakra_pct < 0 ? 'neg' : 'pos'}`} style={row.chakra_pct === 0 ? { color: 'var(--muted-dim)' } : undefined}>{pct(row.chakra_pct, 1)}</td>
                      <td className={row.dhruva_pct === 0 ? 'num' : `num ${row.dhruva_pct < 0 ? 'neg' : 'pos'}`} style={row.dhruva_pct === 0 ? { color: 'var(--muted-dim)' } : undefined}>{pct(row.dhruva_pct, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 18 }}>
              <EmptyState icon={<TrendingUp />} title="No monthly data" text="Monthly returns appear once live.json is reachable." />
            </div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 10 }}>
        <div className="card">
          <div className="section-head">
            <div>
              <h2>Open positions</h2>
              <p>{account ? `${account.n_positions} live holdings · broker ${account.broker.toLowerCase()}` : 'loading live holdings'}</p>
            </div>
          </div>
          {account && account.holdings.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {account.holdings.map((holding) => (
                    <tr key={holding.symbol}>
                      <td className="symbol-name">{holding.symbol}</td>
                      <td className="num">{holding.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 18 }}>
              <EmptyState
                icon={<BriefcaseBusiness />}
                title={account ? 'No open positions' : 'Loading holdings…'}
                text={account ? 'The live account is fully flat — the regime gate is out of the market, so cash is the position.' : 'Fetching broker holdings.'}
              />
            </div>
          )}
        </div>
      </section>
    </>
  )
}
