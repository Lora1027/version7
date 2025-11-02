
import { useEffect, useMemo, useState } from 'react'
import AuthGate from '../components/AuthGate'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { fmt } from '../lib/money'

type Tx = {
  id: string
  user_id: string
  date: string
  type: 'income' | 'expense'
  category: string | null
  method: 'cash' | 'gcash' | 'bank'
  amount: number
  notes: string | null
}

type Balance = {
  id: string
  user_id: string
  label: string
  kind: 'cash' | 'bank'
  balance: number
  updated_at: string
}

export default function Dashboard() {
  const [email, setEmail] = useState<string | null>(null)
  const [tx, setTx] = useState<Tx[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [filters, setFilters] = useState({ type: 'all', method: 'all', q: '', from: '', to: '' })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    date: '',
    type: 'income' as 'income' | 'expense',
    category: '',
    method: 'cash' as 'cash' | 'gcash' | 'bank',
    amount: '',
    notes: ''
  })

  function resetForm() {
    setEditingId(null)
    setForm({ date: '', type: 'income', category: '', method: 'cash', amount: '', notes: '' })
  }

  async function load() {
    const me = await supabase.auth.getUser()
    setEmail(me.data.user?.email ?? null)

    let query = supabase.from('transactions').select('*').order('date', { ascending: false })
    if (filters.type !== 'all') query = query.eq('type', filters.type as any)
    if (filters.method !== 'all') query = query.eq('method', filters.method as any)
    if (filters.q) query = query.ilike('notes', `%${filters.q}%`)
    if (filters.from) query = query.gte('date', filters.from)
    if (filters.to) query = query.lte('date', filters.to)
    const { data: t, error: tErr } = await query
    if (tErr) { alert('Load failed: ' + tErr.message); return; }
    setTx((t as Tx[]) || [])

    const { data: b, error: bErr } = await supabase.from('balances').select('*').order('updated_at', { ascending: false })
    if (bErr) { alert('Load failed: ' + bErr.message); return; }
    setBalances((b as Balance[]) || [])
  }

  useEffect(() => { load() }, [filters.type, filters.method, filters.q, filters.from, filters.to])

  const totals = useMemo(() => {
    const income = tx.filter(x => x.type === 'income').reduce((a, b) => a + b.amount, 0)
    const expense = tx.filter(x => x.type === 'expense').reduce((a, b) => a + b.amount, 0)
    const net = income - expense
    const currentMoney = balances.reduce((a, b) => a + b.balance, 0)
    return { income, expense, net, currentMoney }
  }, [tx, balances])

  async function saveTx(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      date: form.date,
      type: form.type,
      category: form.category || null,
      method: form.method,
      amount: Number(form.amount || 0),
      notes: form.notes || null
    }
    if (!editingId) {
      const { error } = await supabase.from('transactions').insert(payload as any)
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('transactions').update(payload as any).eq('id', editingId)
      if (error) { alert('Update failed: ' + error.message); return; }
    }
    resetForm()
    load()
  }

  function startEdit(row: Tx) {
    setEditingId(row.id)
    setForm({
      date: row.date,
      type: row.type,
      category: row.category || '',
      method: row.method,
      amount: String(row.amount),
      notes: row.notes || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function removeTx(id: string) {
    if (!confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); return; }
    if (editingId === id) resetForm()
    load()
  }

  async function addBalance(e: React.FormEvent) {
    e.preventDefault()
    const f = new FormData(e.target as HTMLFormElement)
    const record = {
      label: String(f.get('label') || ''),
      kind: String(f.get('kind') || 'cash') as 'cash' | 'bank',
      balance: Number(f.get('balance') || 0)
    }
    const { error } = await supabase.from('balances').insert(record as any)
    if (error) { alert('Save failed: ' + error.message); return; }
    (e.target as HTMLFormElement).reset()
    load()
  }

  return (
    <AuthGate>
      <Nav email={email} />
      <div className="container">
        <div className="kpi">
          <div className="card"><h3>Total Income</h3><div>{fmt(totals.income)}</div></div>
          <div className="card"><h3>Total Expenses</h3><div>{fmt(totals.expense)}</div></div>
          <div className="card"><h3>Net Profit</h3><div>{fmt(totals.net)}</div></div>
          <div className="card"><h3>Money on Hand + Bank</h3><div>{fmt(totals.currentMoney)}</div></div>
        </div>

        <div className="card">
          <h2>Filters</h2>
          <div className="row">
            <div style={{ gridColumn: 'span 2' }}>
              <label>Type</label>
              <select className="input" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                <option value="all">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Method</label>
              <select className="input" value={filters.method} onChange={e => setFilters({ ...filters, method: e.target.value })}>
                <option value="all">All</option>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <label>Search notes</label>
              <input className="input" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>From</label>
              <input className="input" type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>To</label>
              <input className="input" type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card">
          <h2>{editingId ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <form className="row" onSubmit={saveTx}>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Type</label>
              <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} required>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <label>Category</label>
              <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Sales / Rent / COGS" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Method</label>
              <select className="input" value={form.method} onChange={e => setForm({ ...form, method: e.target.value as any })} required>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Amount</label>
              <input className="input" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div style={{ gridColumn: 'span 12' }}>
              <label>Notes</label>
              <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="optional" />
            </div>
            <div style={{ gridColumn: 'span 12', display: 'flex', gap: 8 }}>
              <button className="btn" type="submit">{editingId ? 'Update' : 'Save'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
        </div>

        <div className="card">
          <h2>Add Cash/Bank Balance</h2>
          <form className="row" onSubmit={addBalance}>
            <div style={{ gridColumn: 'span 4' }}><label>Label</label><input className="input" name="label" required /></div>
            <div style={{ gridColumn: 'span 2' }}><label>Kind</label><select className="input" name="kind"><option value="cash">Cash</option><option value="bank">Bank</option></select></div>
            <div style={{ gridColumn: 'span 3' }}><label>Balance</label><input className="input" name="balance" type="number" step="0.01" required /></div>
            <div style={{ gridColumn: 'span 3' }}><button className="btn">Save</button></div>
          </form>
        </div>

        <div className="card">
          <h2>Transactions</h2>
          <table className="table">
            <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Method</th><th>Amount</th><th>Notes</th><th className="no-print">Actions</th></tr></thead>
            <tbody>
              {tx.map(row => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.type}</td>
                  <td>{row.category}</td>
                  <td>{row.method}</td>
                  <td>{fmt(row.amount)}</td>
                  <td>{row.notes}</td>
                  <td className="no-print">
                    <button className="btn secondary" onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
                    <button className="btn" onClick={() => removeTx(row.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {tx.length === 0 && <tr><td colSpan={7} className="small">No transactions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGate>
  )
}
