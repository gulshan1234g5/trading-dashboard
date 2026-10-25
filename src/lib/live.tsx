import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export interface LiveCurvePoint {
  month: string
  equity_index: number
}

export interface LiveSystem {
  name: 'CHAKRA' | 'DHRUVA'
  code: string
  status: 'LIVE' | 'PARKED'
  cagr_pct: number
  max_dd_pct: number
  max_dd_monthly_pct: number
  sharpe: number
  positive_months: number
  months: number
  best_month: { month: string; ret_pct: number }
  worst_month: { month: string; ret_pct: number }
  total_return_pct: number
  curve: LiveCurvePoint[]
}

export interface LiveSnapshot {
  generated_at: string
  data_asof: string
  mode: 'REAL'
  account: {
    broker: string
    cash: number
    holdings: Array<{ symbol: string; qty: number }>
    n_positions: number
    equity: number
    capital_floor: number
    floor_status: 'below' | 'at_or_above'
    capital_plan_note: string
  }
  gate: {
    filter: 'ON' | 'OFF'
    nifty_close: number
    dma200: number
    gap_pct: number
    last_decision: string
    next_decision: string
  }
  systems: LiveSystem[]
  recent_months: Array<{ month: string; chakra_pct: number; dhruva_pct: number }>
}

export type LiveState =
  | { status: 'loading' }
  | { status: 'ok'; data: LiveSnapshot }
  | { status: 'error'; error: string }

const LiveContext = createContext<LiveState>({ status: 'loading' })

export const LIVE_URL = `${import.meta.env.BASE_URL}live.json`
// Runtime shape check: any missing/wrongly-typed field rejects the snapshot.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLive(raw: any): LiveSnapshot | null {
  if (raw === null || typeof raw !== 'object') return null
  if (raw.mode !== 'REAL') return null
  if (typeof raw.generated_at !== 'string' || typeof raw.data_asof !== 'string') return null

  const a = raw.account
  if (a === null || typeof a !== 'object') return null
  if (typeof a.broker !== 'string') return null
  if (typeof a.cash !== 'number' || typeof a.equity !== 'number' || typeof a.n_positions !== 'number') return null
  if (typeof a.capital_floor !== 'number') return null
  if (a.floor_status !== 'below' && a.floor_status !== 'at_or_above') return null
  if (typeof a.capital_plan_note !== 'string') return null
  if (!Array.isArray(a.holdings) || a.holdings.some((h: unknown) => h === null || typeof h !== 'object' || typeof (h as { symbol?: unknown }).symbol !== 'string')) return null

  const g = raw.gate
  if (g === null || typeof g !== 'object') return null
  if (g.filter !== 'ON' && g.filter !== 'OFF') return null
  if (typeof g.nifty_close !== 'number' || typeof g.dma200 !== 'number' || typeof g.gap_pct !== 'number') return null
  if (typeof g.last_decision !== 'string' || typeof g.next_decision !== 'string') return null

  if (!Array.isArray(raw.systems) || raw.systems.length === 0) return null
  for (const s of raw.systems) {
    if (s === null || typeof s !== 'object') return null
    if (s.name !== 'CHAKRA' && s.name !== 'DHRUVA') return null
    if (s.status !== 'LIVE' && s.status !== 'PARKED') return null
    if (
      typeof s.code !== 'string' ||
      typeof s.cagr_pct !== 'number' ||
      typeof s.max_dd_pct !== 'number' ||
      typeof s.max_dd_monthly_pct !== 'number' ||
      typeof s.sharpe !== 'number' ||
      typeof s.positive_months !== 'number' ||
      typeof s.months !== 'number' ||
      typeof s.total_return_pct !== 'number'
    ) return null
    if (!s.best_month || typeof s.best_month.month !== 'string' || typeof s.best_month.ret_pct !== 'number') return null
    if (!s.worst_month || typeof s.worst_month.month !== 'string' || typeof s.worst_month.ret_pct !== 'number') return null
    if (!Array.isArray(s.curve) || s.curve.some((p: unknown) => p === null || typeof p !== 'object' || typeof (p as { month?: unknown }).month !== 'string' || typeof (p as { equity_index?: unknown }).equity_index !== 'number')) return null
  }

  if (!Array.isArray(raw.recent_months)) return null
  for (const m of raw.recent_months) {
    if (m === null || typeof m !== 'object' || typeof m.month !== 'string' || typeof m.chakra_pct !== 'number' || typeof m.dhruva_pct !== 'number') return null
  }

  return raw as LiveSnapshot
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    async function load(): Promise<LiveSnapshot> {
      // First try the configured base URL. Dev servers SPA-fallback that path to
      // index.html, so a non-JSON response retries document-relative.
      for (const url of dedupe([LIVE_URL, 'live.json'])) {
        const response = await fetch(url, { headers: { Accept: 'application/json' } })
        if (!response.ok) continue
        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('text/html')) continue
        const parsed = parseLive(await response.json())
        if (!parsed) throw new Error('live.json has an unexpected shape')
        return parsed
      }
      throw new Error('not reachable')
    }
    load()
      .then((data) => {
        if (active) setState({ status: 'ok', data })
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'unknown error'
        if (active) setState({ status: 'error', error: message === 'not reachable' ? 'not reachable' : message })
      })
    return () => {
      active = false
    }
  }, [])

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>
}

function dedupe(urls: string[]): string[] {
  return [...new Set(urls)]
}

export function useLive(): LiveState {
  return useContext(LiveContext)
}
