import { useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  LineChart,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { PageId, Signal } from '../types'
import { DATA_AS_OF, SIGNALS } from '../data/market'
import { useApp } from '../lib/store'
import { useLive } from '../lib/live'
import { inr, pct, shortDateTime, timeAgo } from '../lib/format'
import { Button, EmptyState, MiniSparkline, PageHeader, Pill, StatusDot } from '../components/ui'
import { SystemsChart } from '../components/charts'
import { DemoBanner } from '../components/layout'

export function Overview({
  navigate,
  openSignal,
}: {
  navigate: (page: PageId) => void
  openSignal: (signal: Signal) => void
}) {
  const { state, runScan, addToast } = useApp()
  const live = useLive()
  const [scanning, setScanning] = useState(false)

  const topSignals = [...SIGNALS].sort((a, b) => b.score - a.score).slice(0, 4)
  const account = live.status === 'ok' ? live.data.account : null
  const gate = live.status === 'ok' ? live.data.gate : null

  async function scan() {
    setScanning(true)
    await runScan()
    setScanning(false)
  }

  return (
    <>
      <PageHeader
        eyebrow="NSE · Swing desk · Zerodha account"
        title="Command overview"
        subtitle="Capital and system performance come from the live export (live.json). Scanner, journal, orders and execution panels remain demo fixtures."
        actions={
          <>
            <Button variant="ghost" onClick={() => addToast({ tone: 'info', title: 'Snapshot pinned', message: 'Overview snapshot prepared for review.' })}>
              <BarChart3 /> Snapshot
            </Button>
            <Button variant="primary" onClick={scan} disabled={scanning}>
              {scanning ? <RefreshCw className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Play />}
              {scanning ? 'Scanning…' : 'Run demo scan'}
            </Button>
          </>
        }
      />
      <DemoBanner onSystem={() => navigate('system')} />

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
            <span>live broker holdings · not the demo ledger</span>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">
            <ShieldAlert /> Market gate {gate ? <Pill tone={gate.filter === 'ON' ? 'lime' : 'amber'}>{gate.filter === 'ON' ? 'In market' : 'Out of market'}</Pill> : null}
          </div>
          <div className="kpi-value">{gate ? pct(gate.gap_pct) : '—'}</div>
          <div className="kpi-delta">
            <span className="chip">NIFTY vs 200-DMA</span>
            <span>{gate ? `next decision ${gate.next_decision}` : ''}</span>
          </div>
        </div>
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
            <button type="button" className="section-link" onClick={() => navigate('research')}>
              Research <ChevronRight />
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
                <p className="card-sub">200-DMA filter · monthly decision cycle</p>
              </div>
              {gate ? <Pill tone={gate.filter === 'ON' ? 'lime' : 'amber'}>Filter {gate.filter}</Pill> : <Pill tone="amber">Loading</Pill>}
            </div>
            <div className="risk-gauge-row">
              <div className="risk-metrics">
                <div className="risk-metric">
                  <span>NIFTY 50 close</span>
                  <strong>{gate ? gate.nifty_close.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</strong>
                </div>
                <div className="risk-metric">
                  <span>200-DMA</span>
                  <strong>{gate ? gate.dma200.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</strong>
                </div>
                <div className="risk-metric">
                  <span>Gap to 200-DMA</span>
                  <strong className={gate && gate.gap_pct < 0 ? 'neg' : 'pos'}>{gate ? pct(gate.gap_pct) : '—'}</strong>
                </div>
                <div className="risk-metric">
                  <span>Last decision</span>
                  <strong>{gate ? gate.last_decision : '—'}</strong>
                </div>
                <div className="risk-metric">
                  <span>Next decision</span>
                  <strong>{gate ? gate.next_decision : '—'}</strong>
                </div>
              </div>
            </div>
            <div className="budget-row">
              <div className="budget-labels">
                <span>Capital plan</span>
                <strong>
                  {account
                    ? account.floor_status === 'below'
                      ? `Building toward ${inr(account.capital_floor)} floor`
                      : `Floor of ${inr(account.capital_floor)} met`
                    : '—'}
                </strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 13 }}>
              <button type="button" className="section-link" onClick={() => navigate('risk')}>
                Risk center <ChevronRight />
              </button>
            </div>
          </div>

          <div className="card engine-card">
            <div className="engine-head">
              <div className="card-title-row">
                <Activity className="icon-inline" />
                <h2 className="card-title">System health</h2>
              </div>
              <span className="live-tag">
                <StatusDot tone="warn" pulse /> Fixture
              </span>
            </div>
            <div className="health-list">
              <div className="health-row">
                <span>Scheduler</span>
                <span className="health-state">
                  <StatusDot tone="warn" /> Awaiting bridge
                </span>
              </div>
              <div className="health-row">
                <span>Last demo scan</span>
                <span className="health-state">{shortDateTime(state.lastScanAt)}</span>
              </div>
              <div className="health-row">
                <span>Market data</span>
                <span className="health-state">
                  <StatusDot tone={live.status === 'ok' ? 'good' : 'warn'} /> {live.status === 'ok' ? `live.json · ${live.data.data_asof}` : 'live.json unreachable'}
                </span>
              </div>
              <div className="health-row">
                <span>Kite session</span>
                <span className="health-state">
                  <StatusDot tone="bad" /> Not connected
                </span>
              </div>
              <div className="health-row">
                <span>Telegram alerts</span>
                <span className="health-state">
                  <StatusDot tone="warn" /> Not configured
                </span>
              </div>
            </div>
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

      <section className="overview-bottom">
        <div className="card table-card">
          <div className="section-head">
            <div>
              <h2>Open positions</h2>
              <p>{account ? `${account.n_positions} live holdings · broker ${account.broker.toLowerCase()}` : 'loading live holdings'}</p>
            </div>
            <button type="button" className="section-link" onClick={() => navigate('positions')}>
              Positions <ChevronRight />
            </button>
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
                text={account ? 'The live account is fully flat. Workflows below and demo ledger positions are on the Positions page.' : 'Fetching broker holdings.'}
              />
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-head">
            <div>
              <h2>Scanner pulse</h2>
              <p>
                <Pill tone="amber">Demo</Pill> Top-ranked demo setups · {shortDateTime(DATA_AS_OF)}
              </p>
            </div>
            <button type="button" className="section-link" onClick={() => navigate('scanner')}>
              Scanner <ChevronRight />
            </button>
          </div>
          <div>
            {topSignals.map((signal) => (
              <button
                type="button"
                key={signal.id}
                className="signal-row"
                onClick={() => openSignal(signal)}
                style={{ width: '100%', borderLeft: 0, borderRight: 0, background: 'transparent', textAlign: 'left' }}
              >
                <span className="signal-score">{signal.score}</span>
                <span className="signal-main">
                  <span className="signal-name-row">
                    <span className="signal-symbol">{signal.symbol}</span>
                    <Pill tone={signal.setup === 'Breakout' ? 'lime' : signal.setup === 'Pullback' ? 'cyan' : 'violet'}>
                      {signal.setup}
                    </Pill>
                  </span>
                  <span className="signal-desc">{signal.strategy} · RS {signal.rsRank}</span>
                </span>
                <MiniSparkline data={signal.spark} positive={signal.changePct >= 0} width={47} height={19} />
                <span className="signal-price">
                  {inr(signal.price, 1)}
                  <span className={signal.changePct >= 0 ? 'pos' : 'neg'}>{pct(signal.changePct)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="page-grid grid-main-side" style={{ marginTop: 10 }}>
        <div className="card">
          <div className="section-head">
            <div>
              <h2>Recent activity</h2>
              <div className="card-sub">Browser demo ledger · latest events · <span className="mono" style={{ color: 'var(--muted-dim)' }}>DEMO</span></div>
            </div>
            <button type="button" className="section-link" onClick={() => navigate('system')}>
              System logs <ChevronRight />
            </button>
          </div>
          <div className="feed">
            {state.logs.slice(0, 4).map((log) => {
              const tone = log.level === 'SUCCESS' ? 'good' : log.level === 'WARN' ? 'warn' : log.level === 'ERROR' ? 'bad' : ''
              const Icon = log.source === 'scanner' ? Target : log.source === 'market-data' ? Database : log.source === 'kite' ? ShieldAlert : log.source === 'risk' ? ShieldCheck : log.source === 'orders' ? CircleDollarSign : Clock3
              return (
                <div className="feed-row" key={log.id}>
                  <div className={`feed-icon ${tone}`}>
                    <Icon />
                  </div>
                  <div className="feed-main">
                    <div className="feed-title">
                      <strong>{log.source}</strong> · {log.message}
                    </div>
                    <div className="feed-meta">{timeAgo(log.at)} · {shortDateTime(log.at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title-row">
            <Target className="icon-inline" />
            <h2 className="card-title">Today's discipline</h2>
            <Pill tone="amber">Demo</Pill>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Trades inside risk plan', value: '—' },
              { label: 'Stop-losses attached', value: '—' },
              { label: 'Revenge-trade flags', value: '—' },
              { label: 'Daily loss budget used', value: '—' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 9, borderBottom: '1px solid var(--line-soft)' }}>
                <span style={{ color: 'var(--muted)', fontSize: 9.5 }}>{item.label}</span>
                <span className="mono dim" style={{ fontSize: 10 }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, marginBottom: 12 }}>
            <ArrowDownRight size={12} color="var(--amber)" aria-hidden="true" />
            <span style={{ color: 'var(--muted-dim)', fontSize: 8.5 }}>
              Discipline tracking has no live source yet. System max drawdown headlines are daily-basis — check the month-end figure too.
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
