
import { useEffect, useMemo, useState } from 'react'
import AuthGate from '../components/AuthGate'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { fmt } from '../lib/money'

type Tx = {
  date: string
  type: 'income' | 'expense'
  category: string | null
  method: 'cash' | 'gcash' | 'bank'
  amount: number
}

function daysBetween(from?: string, to?: string) {
  if (!from || !to) return 0
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  const ms = b.getTime() - a.getTime()
  const d = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1
  return d > 0 ? d : 0
}
function pctDelta(a: number, b: number) {
  if (!isFinite(b) || b === 0) return 0
  return ((a - b) / b) * 100
}
function sum(ns: number[]) { return ns.reduce((x, y) => x + y, 0) }

function makeKPIs(rows: Tx[], from?: string, to?: string) {
  const revenue = sum(rows.filter(r => r.type === 'income').map(r => r.amount))
  const cogs = sum(rows.filter(r => (r.category || '').toLowerCase() === 'cogs').map(r => r.amount))
  const grossProfit = revenue - cogs
  const expense = sum(rows.filter(r => r.type === 'expense').map(r => r.amount))
  const net = revenue - expense
  const days = Math.max(1, daysBetween(from, to))
  const avgSales = revenue / days
  const avgGrossProfit = grossProfit / days
  return { revenue, cogs, grossProfit, expense, net, days, avgSales, avgGrossProfit }
}

export default function Comparison() {
  const [email, setEmail] = useState<string | null>(null)
  const [rangeA, setA] = useState<{ from?: string, to?: string }>({})
  const [rangeB, setB] = useState<{ from?: string, to?: string }>({})
  const [rowsA, setRowsA] = useState<Tx[]>([])
  const [rowsB, setRowsB] = useState<Tx[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(u => setEmail(u.data.user?.email ?? null))
  }, [])

  async function load(which: 'A' | 'B') {
    const r = which === 'A' ? rangeA : rangeB
    let q = supabase.from('transactions').select('*')
    if (r.from) q = q.gte('date', r.from)
    if (r.to) q = q.lte('date', r.to)
    const { data, error } = await q
    if (error) { alert('Load failed: ' + error.message); return }
    if (which === 'A') setRowsA((data || []) as Tx[])
    else setRowsB((data || []) as Tx[])
  }

  const A = useMemo(() => makeKPIs(rowsA, rangeA.from, rangeA.to), [rowsA, rangeA.from, rangeA.to])
  const B = useMemo(() => makeKPIs(rowsB, rangeB.from, rangeB.to), [rowsB, rangeB.from, rangeB.to])

  const salesGrowthPct = pctDelta(A.revenue, B.revenue)
  const avgSalesGrowthPct = pctDelta(A.avgSales, B.avgSales)
  const grossProfitGrowthPct = pctDelta(A.grossProfit, B.grossProfit)
  const avgGrossProfitGrowthPct = pctDelta(A.avgGrossProfit, B.avgGrossProfit)
  const netGrowthPct = pctDelta(A.net, B.net)

  const small = { fontSize: 12, opacity: 0.8 as const }

  return (
    <AuthGate>
      <Nav email={email} />
      <div className="container">
        <div className="card">
          <h2>Pick Two Ranges to Compare</h2>
          <div className="row">
            <div style={{ gridColumn: 'span 6' }}>
              <h3>Range A</h3>
              <label>From</label>
              <input className="input" type="date" value={rangeA.from || ''} onChange={e => setA({ ...rangeA, from: e.target.value })} />
              <label>To</label>
              <input className="input" type="date" value={rangeA.to || ''} onChange={e => setA({ ...rangeA, to: e.target.value })} />
              <div style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => load('A')}>Load A</button>
              </div>
            </div>
            <div style={{ gridColumn: 'span 6' }}>
              <h3>Range B</h3>
              <label>From</label>
              <input className="input" type="date" value={rangeB.from || ''} onChange={e => setB({ ...rangeB, from: e.target.value })} />
              <label>To</label>
              <input className="input" type="date" value={rangeB.to || ''} onChange={e => setB({ ...rangeB, to: e.target.value })} />
              <div style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => load('B')}>Load B</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>KPIs</h2>
          <div className="kpi">
            <div className="card">
              <h3>Average Sales (Daily)</h3>
              <div>{fmt(A.avgSales)} vs {fmt(B.avgSales)}</div>
              <div style={small}>Growth: {avgSalesGrowthPct.toFixed(1)}%</div>
            </div>
            <div className="card">
              <h3>Average Gross Profit (Daily)</h3>
              <div>{fmt(A.avgGrossProfit)} vs {fmt(B.avgGrossProfit)}</div>
              <div style={small}>Growth: {avgGrossProfitGrowthPct.toFixed(1)}%</div>
            </div>
            <div className="card">
              <h3>Total Sales (Revenue)</h3>
              <div>{fmt(A.revenue)} vs {fmt(B.revenue)}</div>
              <div style={small}>Growth: {salesGrowthPct.toFixed(1)}%</div>
            </div>
            <div className="card">
              <h3>Gross Profit</h3>
              <div>{fmt(A.grossProfit)} vs {fmt(B.grossProfit)}</div>
              <div style={small}>Growth: {grossProfitGrowthPct.toFixed(1)}%</div>
            </div>
            <div className="card">
              <h3>Net Profit</h3>
              <div>{fmt(A.net)} vs {fmt(B.net)}</div>
              <div style={small}>Growth: {netGrowthPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  )
}
