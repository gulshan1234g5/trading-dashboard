import { describe, expect, it } from 'vitest'
import type { Trade } from './trades'
import { buildAnalytics, dedupeTrades, parseLtpCsv, parseTradebookCsv } from './trades'

const HEADER =
  'symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time'

const buy = (over: Partial<Trade>): Trade => ({
  tradeId: 't',
  symbol: 'ACMEIND',
  date: '2025-01-02',
  exchange: 'NSE',
  side: 'BUY',
  qty: 100,
  price: 100,
  ...over,
})

describe('parseTradebookCsv', () => {
  it('parses RFC4180 quoted fields with commas and doubled quotes', () => {
    const csv = `${HEADER}\n"ACME,B""C",INE123,02-01-2025,NSE,EQ,EQ,BUY,N,100,100,T1,O1,2025-01-02 10:00:00\n`
    const res = parseTradebookCsv(csv)
    expect(res.errors).toEqual([])
    expect(res.trades).toHaveLength(1)
    expect(res.trades[0].symbol).toBe('ACME,B"C')
    expect(res.trades[0].date).toBe('2025-01-02')
  })

  it('parses DD-MM-YYYY and DD-MM-YYYY HH:MM:SS dates, buy/sell/B/S sides', () => {
    const csv = [
      HEADER,
      'ACMEIND,INE1,31-12-2024,NSE,EQ,EQ,S,N,10,50,T1,O1,31-12-2024 15:30:00',
      'ACMEIND,INE1,05-01-2025,NSE,EQ,EQ,B,N,10,60,T2,O2,05-01-2025',
      'ACMEIND,INE1,06-01-2025,NSE,EQ,EQ,sell,N,5,70,T3,O3,',
    ].join('\n')
    const res = parseTradebookCsv(csv)
    expect(res.errors).toEqual([])
    expect(res.trades.map((t) => t.date)).toEqual(['2024-12-31', '2025-01-05', '2025-01-06'])
    expect(res.trades.map((t) => t.side)).toEqual(['SELL', 'BUY', 'SELL'])
    expect(res.trades[0].ts).toBe('31-12-2024 15:30:00')
  })

  it('routes garbage rows to errors without throwing', () => {
    const csv = [
      HEADER,
      'ACMEIND,INE1,02-01-2025,NSE,EQ,EQ,HOBBIT,N,10,50,T1,O1,',
      'ACMEIND,INE1,45-13-2025,NSE,EQ,EQ,BUY,N,10,50,T2,O2,',
      'ACMEIND,INE1,03-01-2025,NSE,EQ,EQ,BUY,N,0,50,T3,O3,',
    ].join('\n')
    const res = parseTradebookCsv(csv)
    expect(res.trades).toHaveLength(0)
    expect(res.skipped).toBe(3)
    expect(res.errors.length).toBe(3)
    expect(res.errors[0]).toContain('Row 2')
    expect(res.errors[1]).toContain('Row 3')
    expect(res.errors[2]).toContain('Row 4')
  })

  it('returns empty result on empty input', () => {
    expect(parseTradebookCsv('')).toEqual({ trades: [], errors: [], skipped: 0 })
  })

  it('ignores extra unknown columns and is case/space/underscore tolerant', () => {
    const csv =
      'SYMBOL , Trade Date ,trade type,QUANTITY,price,trade id,INVALID COL\n' +
      'BLUESTEEL,02-01-2025,buy,10,50,X1,junk\n'
    const res = parseTradebookCsv(csv)
    expect(res.errors).toEqual([])
    expect(res.trades[0].symbol).toBe('BLUESTEEL')
    expect(res.trades[0].side).toBe('BUY')
  })
})

describe('dedupeTrades', () => {
  it('drops duplicate tradeIds keeping the first', () => {
    const t1 = buy({ tradeId: 'T1' })
    const t2 = buy({ tradeId: 'T1', price: 999 })
    const fallback = buy({ tradeId: '', price: 100 })
    const fallbackDup = buy({ tradeId: '', price: 100 })
    const res = dedupeTrades([t1, t2, fallback, fallbackDup])
    expect(res.trades).toHaveLength(2)
    expect(res.trades[0]).toBe(t1)
    expect(res.duplicates).toBe(2)
  })
})

describe('buildAnalytics FIFO matching', () => {
  it('matches a partial sell across multiple buy lots with exact numbers', () => {
    const trades = [
      buy({ tradeId: 'B1', qty: 100, price: 100, date: '2025-01-02' }),
      buy({ tradeId: 'B2', qty: 100, price: 110, date: '2025-01-05' }),
      buy({ tradeId: 'S1', side: 'SELL', qty: 150, price: 120, date: '2025-01-10' }),
    ]
    const a = buildAnalytics(trades)
    expect(a.pairs).toHaveLength(2)
    // Pair 1: 100 @100 -> 120: gross 2000, charges 0.0011*(10000+12000)=24.2
    expect(a.pairs[0]).toMatchObject({ qty: 100, buyPrice: 100, sellPrice: 120, grossPnl: 2000, charges: 24.2, netPnl: 1975.8, holdingDays: 8 })
    // Pair 2: 50 @110 -> 120: gross 500, charges 0.0011*(5500+6000)=12.65
    expect(a.pairs[1]).toMatchObject({ qty: 50, buyPrice: 110, grossPnl: 500, charges: 12.65, netPnl: 487.35, holdingDays: 5 })
    expect(a.realized).toBe(2463.15)
    expect(a.chargesTotal).toBe(36.85)
    // Open position: 50 left at avg cost 110
    expect(a.openQty).toBe(50)
    expect(a.positions).toEqual([
      { symbol: 'ACMEIND', qty: 50, avgCost: 110, invested: 5500, lastPrice: undefined, value: undefined, unrealized: undefined },
    ])
    expect(a.invested).toBe(5500)
    expect(a.profitFactor).toBe(Infinity)
    expect(a.maxDrawdownPct).toBe(0) // fewer than 2 equity points
  })

  it('skips a sell with no matching buy and does not corrupt other lots', () => {
    const trades = [
      buy({ tradeId: 'S0', side: 'SELL', qty: 10, price: 999, date: '2025-01-01' }),
      buy({ tradeId: 'B1', symbol: 'BLUESTEEL', qty: 10, price: 50, date: '2025-01-01' }),
      buy({ tradeId: 'S1', symbol: 'BLUESTEEL', side: 'SELL', qty: 5, price: 60, date: '2025-01-03' }),
    ]
    const a = buildAnalytics(trades)
    expect(a.pairs).toHaveLength(1)
    expect(a.pairs[0].symbol).toBe('BLUESTEEL')
    expect(a.pairs[0].netPnl).toBe(49.4) // gross 5*(60-50)=50 - charges 0.0011*(250+300)=0.605
    expect(a.openQty).toBe(5)
    expect(a.positions).toHaveLength(1)
  })

  it('applies charges on both legs at costPctPerLeg 0.11', () => {
    const a = buildAnalytics([
      buy({ tradeId: 'B1' }),
      buy({ tradeId: 'S1', side: 'SELL', qty: 100, price: 100, date: '2025-01-03' }),
    ])
    // charges = 0.0011 * (10000 + 10000) = 22
    expect(a.pairs[0].grossPnl).toBe(0)
    expect(a.pairs[0].charges).toBe(22)
    expect(a.pairs[0].netPnl).toBe(-22)
    expect(a.chargesTotal).toBe(22)
    expect(a.realized).toBe(-22)
    // custom cost percent
    const b = buildAnalytics(
      [
        buy({ tradeId: 'B1' }),
        buy({ tradeId: 'S1', side: 'SELL', qty: 100, price: 120, date: '2025-01-03' }),
      ],
      { costPctPerLeg: 0.5 },
    )
    expect(b.pairs[0].charges).toBe(110) // 0.005 * (10000 + 12000)
    expect(b.pairs[0].netPnl).toBe(1890)
  })
})

describe('buildAnalytics stats', () => {
  const trades = [
    // Win: buy 100@100 d1, sell@120 d2 -> gross 2000, charges 24.2, net 1975.8
    buy({ tradeId: 'B1' }),
    buy({ tradeId: 'S1', side: 'SELL', qty: 100, price: 120, date: '2025-01-03' }),
    // Loss: buy 100@100 d3, sell@90 d4 -> gross -1000, charges 20.9, net -1020.9
    buy({ tradeId: 'B2', date: '2025-01-06' }),
    buy({ tradeId: 'S2', side: 'SELL', qty: 100, price: 90, date: '2025-01-07' }),
  ]

  it('computes profit factor, expectancy, win rate on a known series', () => {
    const a = buildAnalytics(trades)
    expect(a.wins).toBe(1)
    expect(a.losses).toBe(1)
    expect(a.winRatePct).toBe(50)
    expect(a.avgWin).toBe(1975.8)
    expect(a.avgLoss).toBe(1020.9)
    expect(a.profitFactor).toBe(1.94) // 1975.8 / 1020.9 = 1.9354
    expect(a.expectancy).toBe(477.45) // (1975.8 - 1020.9) / 2
    expect(a.totalTrades).toBe(2)
  })

  it('computes max drawdown pct from the cumulative realized series', () => {
    const a = buildAnalytics(trades)
    // equity: 2025-01-03 -> 1975.8, 2025-01-07 -> 954.9 (after rounding each point)
    expect(a.equity).toEqual([
      { date: '2025-01-03', cumPnl: 1975.8 },
      { date: '2025-01-07', cumPnl: 954.9 },
    ])
    // dd = (1975.8 - 954.9) / 1975.8 = 51.67%
    expect(a.maxDrawdownPct).toBe(51.67)
  })

  it('groups monthly pnl ascending by sell month', () => {
    const a = buildAnalytics([
      buy({ tradeId: 'B1' }),
      buy({ tradeId: 'B2', date: '2025-01-05' }),
      buy({ tradeId: 'S2', side: 'SELL', qty: 100, price: 90, date: '2025-01-07' }),
      buy({ tradeId: 'S1', side: 'SELL', qty: 100, price: 120, date: '2025-02-03' }),
    ])
    // Matching is per symbol FIFO in date order; both sell into pairs regardless of array order.
    expect(a.monthly.map((m) => m.month)).toContain('2025-01')
    expect(a.monthly.map((m) => m.month)).toContain('2025-02')
    expect([...a.monthly.map((m) => m.month)].sort()).toEqual(a.monthly.map((m) => m.month))
  })
})

describe('buildAnalytics positions with ltp', () => {
  it('sets value/unrealized from ltp when provided, falls back to invested otherwise', () => {
    const trades = [
      buy({ tradeId: 'B1', symbol: 'ACMEIND', qty: 10, price: 100 }),
      buy({ tradeId: 'B2', symbol: 'BLUESTEEL', qty: 5, price: 200 }),
    ]
    const a = buildAnalytics(trades, { ltp: { ACMEIND: 120 } })
    expect(a.positions).toHaveLength(2)
    const acme = a.positions.find((p) => p.symbol === 'ACMEIND')!
    const blue = a.positions.find((p) => p.symbol === 'BLUESTEEL')!
    expect(acme.lastPrice).toBe(120)
    expect(acme.value).toBe(1200)
    expect(acme.unrealized).toBe(200)
    expect(blue.value).toBeUndefined()
    expect(blue.unrealized).toBeUndefined()
    // currentValue = 1200 (ltp) + 1000 (invested fallback)
    expect(a.currentValue).toBe(2200)
    expect(a.invested).toBe(2000)
    expect(a.unrealized).toBe(200)
    expect(a.netPnl).toBe(200)
    expect(a.returnPct).toBe(10) // 200 / 2000
  })
})

describe('buildAnalytics empty input', () => {
  it('returns zeros, not NaN', () => {
    const a = buildAnalytics([])
    expect(a.realized).toBe(0)
    expect(a.netPnl).toBe(0)
    expect(a.returnPct).toBe(0)
    expect(a.winRatePct).toBe(0)
    expect(a.avgWin).toBe(0)
    expect(a.avgLoss).toBe(0)
    expect(a.profitFactor).toBe(0)
    expect(a.expectancy).toBe(0)
    expect(a.maxDrawdownPct).toBe(0)
    expect(a.equity).toEqual([])
    expect(a.monthly).toEqual([])
    expect(a.symbols).toEqual([])
    expect(a.positions).toEqual([])
    expect(a.pairs).toEqual([])
  })
})

describe('parseLtpCsv', () => {
  it('parses SYMBOL,price lines and skips junk', () => {
    const ltp = parseLtpCsv('ACMEIND,120.50\nBLUESTEEL,88\n,Foo\nACMEIND,bad\n')
    expect(ltp).toEqual({ ACMEIND: 120.5, BLUESTEEL: 88 })
  })
})
