// Pure tradebook parsing + FIFO analytics. No DOM, no fetch, no React.

export type Side = 'BUY' | 'SELL'

export interface Trade {
  tradeId: string
  orderId?: string
  symbol: string
  isin?: string
  date: string // YYYY-MM-DD
  ts?: string // raw order_execution_time if present
  exchange: string
  segment?: string
  side: Side
  qty: number // always positive
  price: number
}

export interface Pair {
  symbol: string
  qty: number
  buyDate: string
  buyPrice: number
  sellDate: string
  sellPrice: number
  grossPnl: number
  charges: number
  netPnl: number
  holdingDays: number
}

export interface Position {
  symbol: string
  qty: number
  avgCost: number
  invested: number
  lastPrice?: number
  value?: number
  unrealized?: number
}

export interface SymbolSummary {
  symbol: string
  buyQty: number
  sellQty: number
  avgBuy: number
  avgSell: number
  realized: number
  trades: number
  wins: number
  losses: number
  winRatePct: number
  bestNet: number
  worstNet: number
  avgHoldDays: number
}

export interface MonthPnl {
  month: string
  pnl: number
} // month = YYYY-MM
export interface EquityPoint {
  date: string
  cumPnl: number
}

export interface Analytics {
  invested: number
  currentValue: number
  realized: number
  unrealized: number
  netPnl: number
  returnPct: number
  totalTrades: number
  wins: number
  losses: number
  winRatePct: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  expectancy: number
  maxDrawdownPct: number
  chargesTotal: number
  openQty: number
  monthly: MonthPnl[]
  equity: EquityPoint[]
  symbols: SymbolSummary[]
  positions: Position[]
  pairs: Pair[]
}

export interface ParseResult {
  trades: Trade[]
  errors: string[]
  skipped: number
}

const r2 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 100) / 100 : 0)

// ---- RFC4180 CSV row splitting ----

function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let any = false
  const n = text.length
  let i = 0
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += c
        i++
      }
    } else if (c === '"') {
      inQuotes = true
      any = true
      i++
    } else if (c === ',') {
      row.push(field)
      field = ''
      any = true
      i++
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      any = false
      i++
    } else {
      field += c
      if (c !== ' ' && c !== '\t') any = true
      i++
    }
  }
  if (any || field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const normKey = (s: string): string => s.toLowerCase().replace(/[\s_-]/g, '')

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const t = raw.trim()
  if (t === '') return null
  const v = Number(t.replace(/,/g, ''))
  return Number.isFinite(v) ? v : null
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

function normalizeDate(raw: string | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (m) {
    const mo = Number(m[2])
    const d = Number(m[3])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    return `${m[1]}-${pad2(mo)}-${pad2(d)}`
  }
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(t)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    return `${m[3]}-${pad2(mo)}-${pad2(d)}`
  }
  return null
}

function parseSide(raw: string | undefined): Side | null {
  const t = (raw ?? '').trim().toLowerCase()
  if (t === 'buy' || t === 'b') return 'BUY'
  if (t === 'sell' || t === 's') return 'SELL'
  return null
}

const REQUIRED_COLS = ['symbol', 'tradedate', 'quantity', 'price', 'tradetype'] as const

export function parseTradebookCsv(text: string): ParseResult {
  const errors: string[] = []
  const rows = splitCsv(text).filter((r) => r.some((f) => f.trim() !== ''))
  if (rows.length === 0) return { trades: [], errors: [], skipped: 0 }

  const header = rows[0].map(normKey)
  const col = (name: string): number => header.indexOf(normKey(name))
  const missing = REQUIRED_COLS.filter((c) => col(c) < 0)
  if (missing.length > 0) {
    return {
      trades: [],
      errors: [`Row 1: header missing required column(s): ${missing.join(', ')}`],
      skipped: 0,
    }
  }

  const trades: Trade[] = []
  for (let i = 1; i < rows.length; i++) {
    const rowNo = i + 1
    const f = rows[i]
    const get = (name: string): string | undefined => {
      const idx = col(name)
      return idx >= 0 ? f[idx]?.trim() : undefined
    }

    const symbol = get('symbol')
    if (!symbol) {
      errors.push(`Row ${rowNo}: missing symbol`)
      continue
    }
    const date = normalizeDate(get('tradedate') || get('date'))
    if (!date) {
      errors.push(`Row ${rowNo}: bad trade_date "${get('tradedate') ?? ''}"`)
      continue
    }
    const side = parseSide(get('tradetype') || get('side'))
    if (!side) {
      errors.push(`Row ${rowNo}: bad trade_type "${get('tradetype') ?? ''}"`)
      continue
    }
    const qty = toNumber(get('quantity') || get('qty'))
    if (qty === null || qty <= 0) {
      errors.push(`Row ${rowNo}: bad quantity`)
      continue
    }
    const price = toNumber(get('price'))
    if (price === null || price < 0) {
      errors.push(`Row ${rowNo}: bad price`)
      continue
    }

    trades.push({
      tradeId: get('tradeid') || get('orderid') || '',
      orderId: get('orderid') || undefined,
      symbol: symbol.toUpperCase(),
      isin: get('isin') || undefined,
      date,
      ts: get('orderexecutiontime') || undefined,
      exchange: get('exchange') || '',
      segment: get('segment') || undefined,
      side,
      qty,
      price,
    })
  }

  return { trades, errors, skipped: errors.length }
}

export function dedupeTrades(trades: Trade[]): { trades: Trade[]; duplicates: number } {
  const seen = new Set<string>()
  const out: Trade[] = []
  let duplicates = 0
  for (const t of trades) {
    const key = t.tradeId ? t.tradeId : `${t.symbol}|${t.date}|${t.side}|${t.qty}|${t.price}`
    if (seen.has(key)) {
      duplicates++
      continue
    }
    seen.add(key)
    out.push(t)
  }
  return { trades: out, duplicates }
}

export function parseLtpCsv(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t === '') continue
    const parts = t.split(',')
    if (parts.length < 2) continue
    const price = toNumber(parts[parts.length - 1])
    const symbol = parts[0].trim()
    if (price === null || price < 0 || symbol === '') continue
    out[symbol] = price
  }
  return out
}

// ---- Analytics ----

const DAY_MS = 86_400_000

function utcDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function holdingDays(buyDate: string, sellDate: string): number {
  return Math.round((utcDay(sellDate) - utcDay(buyDate)) / DAY_MS)
}

export function buildAnalytics(
  trades: Trade[],
  opts?: { costPctPerLeg?: number; ltp?: Record<string, number> },
): Analytics {
  const costPct = opts?.costPctPerLeg ?? 0.11
  const ltp = opts?.ltp

  // Sort: date, then ts, then original order (stable).
  const sorted = trades
    .map((t, i) => ({ t, i }))
    .sort(
      (a, b) =>
        a.t.date.localeCompare(b.t.date) ||
        (a.t.ts || '').localeCompare(b.t.ts || '') ||
        a.i - b.i,
    )

  const lotsBySymbol = new Map<string, { qty: number; price: number; date: string }[]>()
  const pairs: Pair[] = []

  for (const { t } of sorted) {
    let lots = lotsBySymbol.get(t.symbol)
    if (!lots) {
      lots = []
      lotsBySymbol.set(t.symbol, lots)
    }

    if (t.side === 'BUY') {
      lots.push({ qty: t.qty, price: t.price, date: t.date })
      continue
    }

    // SELL: match oldest buys first. No lots -> skip entirely.
    let remaining = t.qty
    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0]
      const take = Math.min(lot.qty, remaining)
      const buyValue = take * lot.price
      const sellValue = take * t.price
      const gross = sellValue - buyValue
      const charges = (costPct / 100) * (buyValue + sellValue)
      pairs.push({
        symbol: t.symbol,
        qty: take,
        buyDate: lot.date,
        buyPrice: lot.price,
        sellDate: t.date,
        sellPrice: t.price,
        grossPnl: gross,
        charges,
        netPnl: gross - charges,
        holdingDays: holdingDays(lot.date, t.date),
      })
      remaining -= take
      lot.qty -= take
      if (lot.qty <= 0) lots.shift()
    }
    // If remaining > 0, no matching buy lot; ignore without touching other lots.
  }

  // Totals
  let realized = 0
  let grossProfit = 0
  let grossLoss = 0
  let wins = 0
  let losses = 0
  let chargesTotal = 0
  for (const p of pairs) {
    realized += p.netPnl
    chargesTotal += p.charges
    if (p.netPnl > 0) {
      wins++
      grossProfit += p.netPnl
    } else if (p.netPnl < 0) {
      losses++
      grossLoss += -p.netPnl
    }
  }
  const totalTrades = pairs.length

  // Open positions from remaining lots.
  const positions: Position[] = []
  let invested = 0
  let openQty = 0
  let unrealized = 0
  let currentValue = 0
  for (const [symbol, lots] of lotsBySymbol) {
    if (lots.length === 0) continue
    let qty = 0
    let cost = 0
    for (const lot of lots) {
      qty += lot.qty
      cost += lot.qty * lot.price
    }
    if (qty <= 0) continue
    const pos: Position = {
      symbol,
      qty,
      avgCost: cost / qty,
      invested: cost,
    }
    invested += cost
    openQty += qty
    const last = ltp?.[symbol]
    if (last !== undefined && Number.isFinite(last)) {
      pos.lastPrice = last
      pos.value = qty * last
      pos.unrealized = pos.value - cost
      currentValue += pos.value
      unrealized += pos.unrealized
    } else {
      currentValue += cost // falls back to invested when no ltp
    }
    positions.push(pos)
  }

  const netPnl = realized + unrealized
  const returnPct = invested > 0 ? ((netPnl / invested) * 100) : 0

  // Equity curve: cumulative net realized by sell date.
  const byDate = new Map<string, number>()
  const byMonth = new Map<string, number>()
  const bySymbol = new Map<
    string,
    {
      buyQty: number
      sellQty: number
      gQtyCost: number
      gQtySell: number
      gHold: number
      realized: number
      trades: number
      wins: number
      losses: number
      bestNet: number
      worstNet: number
    }
  >()
  for (const p of pairs) {
    byDate.set(p.sellDate, (byDate.get(p.sellDate) ?? 0) + p.netPnl)
    const month = p.sellDate.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + p.netPnl)

    let s = bySymbol.get(p.symbol)
    if (!s) {
      s = {
        buyQty: 0,
        sellQty: 0,
        gQtyCost: 0,
        gQtySell: 0,
        gHold: 0,
        realized: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        bestNet: Number.POSITIVE_INFINITY,
        worstNet: Number.NEGATIVE_INFINITY,
      }
      bySymbol.set(p.symbol, s)
    }
    s.buyQty += p.qty
    s.sellQty += p.qty
    s.gQtyCost += p.qty * p.buyPrice
    s.gQtySell += p.qty * p.sellPrice
    s.gHold += p.qty * p.holdingDays
    s.realized += p.netPnl
    s.trades++
    if (p.netPnl > 0) s.wins++
    else if (p.netPnl < 0) s.losses++
    s.bestNet = Math.min(s.bestNet, p.netPnl)
    s.worstNet = Math.max(s.worstNet, p.netPnl)
  }

  let cum = 0
  const equity: EquityPoint[] = [...byDate.keys()]
    .sort()
    .map((date) => {
      cum += byDate.get(date) ?? 0
      return { date, cumPnl: r2(cum) }
    })

  const monthly: MonthPnl[] = [...byMonth.keys()].sort().map((month) => ({
    month,
    pnl: r2(byMonth.get(month) ?? 0),
  }))

  const symbols: SymbolSummary[] = [...bySymbol.entries()]
    .map(([symbol, s]) => ({
      symbol,
      buyQty: s.buyQty,
      sellQty: s.sellQty,
      avgBuy: s.buyQty > 0 ? r2(s.gQtyCost / s.buyQty) : 0,
      avgSell: s.sellQty > 0 ? r2(s.gQtySell / s.sellQty) : 0,
      realized: r2(s.realized),
      trades: s.trades,
      wins: s.wins,
      losses: s.losses,
      winRatePct: s.trades > 0 ? r2((s.wins / s.trades) * 100) : 0,
      bestNet: s.bestNet === Number.POSITIVE_INFINITY ? 0 : r2(s.bestNet),
      worstNet: s.worstNet === Number.NEGATIVE_INFINITY ? 0 : r2(s.worstNet),
      avgHoldDays: s.sellQty > 0 ? r2(s.gHold / s.sellQty) : 0,
    }))
    .sort((a, b) => b.realized - a.realized)

  // Max drawdown % of the cumulative realized series (peak-to-trough).
  let maxDrawdownPct = 0
  let peak = 0
  let hasPeak = false
  for (const pt of equity) {
    if (!hasPeak || pt.cumPnl > peak) {
      peak = pt.cumPnl
      hasPeak = true
    }
    if (peak > 0) {
      const dd = ((peak - pt.cumPnl) / peak) * 100
      if (dd > maxDrawdownPct) maxDrawdownPct = dd
    }
  }

  return {
    invested: r2(invested),
    currentValue: r2(currentValue),
    realized: r2(realized),
    unrealized: r2(unrealized),
    netPnl: r2(netPnl),
    returnPct: r2(returnPct),
    totalTrades,
    wins,
    losses,
    winRatePct: totalTrades > 0 ? r2((wins / totalTrades) * 100) : 0,
    avgWin: wins > 0 ? r2(grossProfit / wins) : 0,
    avgLoss: losses > 0 ? r2(grossLoss / losses) : 0,
    profitFactor: grossLoss > 0 ? r2(grossProfit / grossLoss) : wins > 0 ? Infinity : 0,
    expectancy: totalTrades > 0 ? r2(realized / totalTrades) : 0,
    maxDrawdownPct: r2(maxDrawdownPct),
    chargesTotal: r2(chargesTotal),
    openQty: r2(openQty),
    monthly,
    equity,
    symbols,
    positions: positions.map((p) => ({
      ...p,
      avgCost: r2(p.avgCost),
      invested: r2(p.invested),
      lastPrice: p.lastPrice,
      value: p.value !== undefined ? r2(p.value) : undefined,
      unrealized: p.unrealized !== undefined ? r2(p.unrealized) : undefined,
    })),
    pairs: pairs.map((p) => ({
      ...p,
      grossPnl: r2(p.grossPnl),
      charges: r2(p.charges),
      netPnl: r2(p.netPnl),
    })),
  }
}
