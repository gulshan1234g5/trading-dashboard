import { useEffect, useState, type ReactNode } from 'react'
import { CheckSquare, Square } from 'lucide-react'
import { useLive } from '../lib/live'
import { PageHeader, Pill } from '../components/ui'

// Verbatim from /root/rlt/RUNBOOK.md (frozen 2026-10-22) and reports/live/state.json
// — read-only source of truth; this page renders it, it never edits it.

const RAILS: string[] = [
  'The script\'s output is the exact order list. No improvisation, no extra names.',
  'LTP more than 2% away from the decision price → skip that order and report.',
  'Rejection / mismatch / stale price → stop. Never substitute another stock.',
  'No rule changes, no manual exits, no intraday, no leverage, no F&O. CNC delivery only.',
  'Every order logged to reports/decisions.jsonl.',
  'Minimum equity ₹45,000 — below it the DP charge (₹15.34/sell) breaks the modelled cost. Below the ₹22,500 hard floor: skip the month, keep depositing.',
]

const KILL_CRITERIA: string[] = [
  'Equity drawdown exceeds −50%.',
  '36 consecutive months of underperformance vs a Nifty index fund.',
  'A rule is found to be implemented differently from the runbook.',
]

interface Step {
  id: string
  title: string
  body: ReactNode
}

const STEPS: Step[] = [
  {
    id: 'login',
    title: 'Last trading day of the month, evening — fresh Kite login',
    body: (
      <>
        The decision runs after close (~18:30 IST). Operator sends the go message and does a fresh Kite login (30 s).
        The access token expires ~06:00 IST daily — log in immediately before executing, never the night before.
      </>
    ),
  },
  {
    id: 'data',
    title: 'Agent refreshes data (~6 min)',
    body: (
      <>
        <code>fetch_bhavcopy.py --start {'<last+1>'} --end today</code> → <code>fetch_refs.py</code> (Nifty +
        industries) → <code>python3 -m src.panel --raw data/raw --out data/panel.parquet --report …</code>
        <br />
        Delete any stale <code>data/raw/&lt;date&gt;.full.csv.absent</code> marker first — it silently drops that day
        from the panel.
      </>
    ),
  },
  {
    id: 'decision',
    title: 'Agent runs the rebalance decision',
    body: (
      <code>
        python3 -m src.rebalance_now --cash &lt;cash&gt; --holdings "SYM:QTY,..." --record reports/decisions.jsonl
      </code>
    ),
  },
  {
    id: 'off',
    title: 'Gate disabled — every decision prints a buy list',
    body: <>SPEC_GATE_OFF_LIVE: the Nifty-200DMA gate no longer blocks entries at any level. The remaining brake is the capital floor — do <strong>not</strong> execute below ₹22,500 hard / ₹45,000 healthy equity.</>,
  },
  {
    id: 'on',
    title: 'Deposit the same evening, place orders next session',
    body: (
      <>
        Deposit the month&#39;s amount by UPI that evening. Next session at 09:15, place CNC <strong>market</strong>{' '}
        orders for the printed list only, then confirm fills against <code>get_orders</code>. Nothing intraday, ever.
      </>
    ),
  },
  {
    id: 'closeout',
    title: 'Close out the month',
    body: (
      <>
        Append the month to <code>reports/live/state.json</code> and report fills + slippage vs the decision price.
      </>
    ),
  },
]

const CHECK_KEY = 'gulshan-playbook-checks'

export function Playbook() {
  const live = useLive()
  const gate = live.status === 'ok' ? live.data.gate : null
  // Checks are keyed to the next decision date so they reset each month.
  const target = gate?.next_decision ?? ''
  const [done, setDone] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CHECK_KEY) ?? 'null') as { month?: string; done?: string[] } | null
      return raw?.month === target && Array.isArray(raw.done) ? raw.done : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(CHECK_KEY, JSON.stringify({ month: target, done }))
  }, [target, done])

  function toggle(id: string) {
    setDone((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const completeCount = STEPS.filter((step) => done.includes(step.id)).length

  return (
    <>
      <PageHeader
        eyebrow="Month-end operations runbook · /root/rlt (read-only)"
        title="Playbook"
        subtitle="The monthly playbook, execution rails and kill criteria, verbatim from the frozen RUNBOOK. Tick the steps as you go — checks reset for the next decision."
      />

      <section className="card" style={{ padding: 16 }} aria-label="Next decision">
        <div className="engine-head">
          <div>
            <div className="card-title-row">
              <h2 className="card-title">Next decision</h2>
              {gate ? (
                <Pill tone={gate.mode === 'off' ? 'neutral' : gate.filter === 'ON' ? 'lime' : 'amber'}>{gate.mode === 'off' ? 'Gate disabled' : `Filter ${gate.filter}`}</Pill>
              ) : (
                <Pill tone="amber">Loading</Pill>
              )}
            </div>
            <p className="card-sub">Last trading day of the month · evening (~18:30 IST)</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {gate?.next_decision ?? '—'}
            </div>
            <div className="mono" style={{ color: 'var(--muted-dim)', fontSize: 8.5 }}>
              {completeCount}/{STEPS.length} steps ticked this cycle
            </div>
          </div>
        </div>
        {gate ? (
          <div className="budget-row">
            <div className="budget-labels">
              <span>Last decision {gate.last_decision}</span>
              <strong>
                Nifty {gate.nifty_close.toLocaleString('en-IN', { minimumFractionDigits: 2 })} vs 200-DMA{' '}
                {gate.dma200.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({gate.gap_pct.toFixed(2)}%)
              </strong>
            </div>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 10 }}>
        <div className="card">
          <div className="section-head">
            <div>
              <h2>Monthly playbook</h2>
              <p>Twenty minutes, once a month. The script's output is the final word.</p>
            </div>
            {completeCount === STEPS.length && completeCount > 0 ? <Pill tone="lime">Cycle complete</Pill> : null}
          </div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {STEPS.map((step, index) => {
              const checked = done.includes(step.id)
              return (
                <li key={step.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    aria-pressed={checked}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      width: '100%',
                      padding: '11px 4px',
                      background: 'transparent',
                      border: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'inherit',
                    }}
                  >
                    <span style={{ flexShrink: 0, color: checked ? 'var(--lime, #c7f36b)' : 'var(--muted)', marginTop: 1 }}>
                      {checked ? <CheckSquare size={15} /> : <Square size={15} />}
                    </span>
                    <span style={{ opacity: checked ? 0.55 : 1 }}>
                      <strong style={{ fontSize: 10.5, textDecoration: checked ? 'line-through' : 'none' }}>
                        {index + 1}. {step.title}
                      </strong>
                      <span
                        style={{
                          display: 'block',
                          color: 'var(--muted)',
                          fontSize: 9.5,
                          marginTop: 3,
                          lineHeight: 1.55,
                        }}
                      >
                        {step.body}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section className="overview-bottom" style={{ marginTop: 10 }}>
        <div className="card">
          <div className="section-head">
            <div>
              <h2>Execution rails (non-negotiable)</h2>
              <p>From reports/live/state.json · a rejection is safe to retry once funded; an empty order book means the order never reached the exchange.</p>
            </div>
            <Pill tone="red">Hard rules</Pill>
          </div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {RAILS.map((rail, index) => (
              <li
                key={rail}
                className="cost-row"
                style={{ alignItems: 'baseline' }}
              >
                <span>
                  <span className="mono" style={{ color: 'var(--muted-dim)', marginRight: 7 }}>
                    R{index + 1}
                  </span>
                  {rail}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card">
          <div className="section-head">
            <div>
              <h2>Kill criteria</h2>
              <p>Decide now, not during a drawdown. Re-evaluate only at a calendar review, and only if one of these happens:</p>
            </div>
          </div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {KILL_CRITERIA.map((criterion, index) => (
              <li key={criterion} className="cost-row" style={{ alignItems: 'baseline' }}>
                <span>
                  <span className="mono" style={{ color: 'var(--muted-dim)', marginRight: 7 }}>
                    K{index + 1}
                  </span>
                  {criterion}
                </span>
              </li>
            ))}
          </ol>
          <p style={{ color: 'var(--muted-dim)', fontSize: 9, margin: '10px 0 0' }}>
            Anything else — a bad quarter, a hot stock missed, a friend's tip — is not a reason. Do not change a rule
            because of a bad month; changes only after a new pre-registration.
          </p>
        </div>
      </section>
    </>
  )
}
