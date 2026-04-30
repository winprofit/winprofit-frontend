import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import API from './api';
import Pricing from './Pricing';
import './App.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const fmt = n => '$' + Math.round(n).toLocaleString();
const pct = n => (parseFloat(n) || 0).toFixed(1) + '%';
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

function statusClass(val, goodMax, warnMax) {
  if (val <= goodMax) return 'ok';
  if (val <= warnMax) return 'warn';
  return 'bad';
}

// Popup Modal
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 420,
        maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let result;
      if (isSignup) {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }
      if (result.error) throw result.error;
      const session = result.data.session;
      localStorage.setItem('winprofit_session', JSON.stringify(session));
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand-lg">Win<span>Profit</span></div>
        <p className="auth-sub">Restaurant P&L and AI Advisor</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@restaurant.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="password" />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="auth-toggle">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          <button className="link-btn" onClick={() => { setIsSignup(!isSignup); setError(''); }}>
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}

function exportSales(entries, month) {
  const data = entries.map(e => ({
    'Date': e.date,
    'Food Sales ($)': (e.food_sales / 100).toFixed(2),
    'Beverage Sales ($)': (e.beverage_sales / 100).toFixed(2),
    'Total ($)': ((e.food_sales + e.beverage_sales) / 100).toFixed(2),
    'Covers': e.covers,
    'Avg Check ($)': e.covers > 0 ? ((e.food_sales + e.beverage_sales) / e.covers / 100).toFixed(2) : '0.00',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `WinProfit_Sales_${month}.xlsx`);
}

function exportExpenses(expenses, month) {
  const catLabels = {
    food_cost: 'Food cost', beverage_cost: 'Bev cost', labor: 'Labor',
    rent: 'Rent', utilities: 'Utilities', marketing: 'Marketing',
    maintenance: 'Maintenance', other: 'Other'
  };
  const data = expenses.map(e => ({
    'Date': e.date,
    'Category': catLabels[e.category] || e.category,
    'Description': e.description || '',
    'Amount ($)': (e.amount / 100).toFixed(2),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `WinProfit_Expenses_${month}.xlsx`);
}

function exportPL(pl) {
  const data = [
    { 'Category': 'REVENUE', 'Item': '', 'Amount ($)': '' },
    { 'Category': '', 'Item': 'Food sales', 'Amount ($)': pl.food_sales.toFixed(2) },
    { 'Category': '', 'Item': 'Beverage sales', 'Amount ($)': pl.beverage_sales.toFixed(2) },
    { 'Category': '', 'Item': 'TOTAL REVENUE', 'Amount ($)': pl.total_revenue.toFixed(2) },
    { 'Category': '', 'Item': '', 'Amount ($)': '' },
    { 'Category': 'COSTS', 'Item': '', 'Amount ($)': '' },
    { 'Category': '', 'Item': 'Food cost', 'Amount ($)': pl.food_cost.toFixed(2) },
    { 'Category': '', 'Item': 'Beverage cost', 'Amount ($)': pl.bev_cost.toFixed(2) },
    { 'Category': '', 'Item': 'Labor', 'Amount ($)': pl.labor.toFixed(2) },
    { 'Category': '', 'Item': 'Rent', 'Amount ($)': pl.rent.toFixed(2) },
    { 'Category': '', 'Item': 'Utilities', 'Amount ($)': pl.utilities.toFixed(2) },
    { 'Category': '', 'Item': 'Other', 'Amount ($)': pl.other.toFixed(2) },
    { 'Category': '', 'Item': 'TOTAL COSTS', 'Amount ($)': pl.total_expenses.toFixed(2) },
    { 'Category': '', 'Item': '', 'Amount ($)': '' },
    { 'Category': 'PROFIT', 'Item': 'NET PROFIT', 'Amount ($)': pl.net_profit.toFixed(2) },
    { 'Category': '', 'Item': '', 'Amount ($)': '' },
    { 'Category': 'RATIOS', 'Item': '', 'Amount ($)': '' },
    { 'Category': '', 'Item': 'Food cost %', 'Amount ($)': pl.food_cost_pct + '%' },
    { 'Category': '', 'Item': 'Labor %', 'Amount ($)': pl.labor_pct + '%' },
    { 'Category': '', 'Item': 'Prime cost %', 'Amount ($)': pl.prime_cost_pct + '%' },
    { 'Category': '', 'Item': 'Net margin %', 'Amount ($)': pl.net_margin_pct + '%' },
    { 'Category': '', 'Item': 'Beverage mix %', 'Amount ($)': pl.bev_mix_pct + '%' },
    { 'Category': '', 'Item': 'Avg check', 'Amount ($)': '$' + pl.avg_check },
    { 'Category': '', 'Item': 'Covers', 'Amount ($)': pl.covers },
    { 'Category': '', 'Item': 'Days tracked', 'Amount ($)': pl.days_tracked },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'P&L');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `WinProfit_PL_${pl.month}.xlsx`);
}

function Dashboard({ pl, loading }) {
  if (loading) return <div className="loading">Loading your P&L...</div>;
  if (!pl || pl.total_revenue === 0) return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <p>No data yet for this month.</p>
      <p>Go to <strong>Enter data</strong> to add your first sales entry.</p>
    </div>
  );

  const fcStatus = statusClass(pl.food_cost_pct, 32, 36);
  const labStatus = statusClass(pl.labor_pct, 35, 40);
  const marginStatus = pl.net_margin_pct >= 10 ? 'ok' : pl.net_margin_pct >= 5 ? 'warn' : 'bad';

  return (
    <div>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total revenue</div>
          <div className="metric-value">{fmt(pl.total_revenue)}</div>
          <div className="metric-sub">{pl.days_tracked} days tracked</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Food cost %</div>
          <div className={`metric-value ${fcStatus}`}>{pct(pl.food_cost_pct)}</div>
          <div className={`metric-sub ${fcStatus}`}>Target: 28-32%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Labor cost %</div>
          <div className={`metric-value ${labStatus}`}>{pct(pl.labor_pct)}</div>
          <div className={`metric-sub ${labStatus}`}>Target: 28-35%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net profit</div>
          <div className={`metric-value ${marginStatus}`}>{fmt(pl.net_profit)}</div>
          <div className={`metric-sub ${marginStatus}`}>Margin: {pct(pl.net_margin_pct)}</div>
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-title">P and L summary</div>
          <div className="pl-line sub"><span>Food sales</span><span>{fmt(pl.food_sales)}</span></div>
          <div className="pl-line sub"><span>Beverage sales</span><span>{fmt(pl.beverage_sales)}</span></div>
          <div className="pl-line total"><span>Total revenue</span><span>{fmt(pl.total_revenue)}</span></div>
          <div className="pl-spacer" />
          <div className="pl-line sub"><span>Food cost</span><span>{fmt(pl.food_cost)}</span></div>
          <div className="pl-line sub"><span>Beverage cost</span><span>{fmt(pl.bev_cost)}</span></div>
          <div className="pl-line sub"><span>Labor</span><span>{fmt(pl.labor)}</span></div>
          <div className="pl-line sub"><span>Rent</span><span>{fmt(pl.rent)}</span></div>
          <div className="pl-line sub"><span>Utilities</span><span>{fmt(pl.utilities)}</span></div>
          <div className="pl-line sub"><span>Other</span><span>{fmt(pl.other)}</span></div>
          <div className={`pl-line total ${pl.net_profit >= 0 ? 'profit-pos' : 'profit-neg'}`}>
            <span>Net profit</span><span>{fmt(pl.net_profit)}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Cost breakdown</div>
          {[
            { label: 'Food cost', val: pl.food_cost_pct, color: '#E24B4A' },
            { label: 'Labor', val: pl.labor_pct, color: '#378ADD' },
            { label: 'Prime cost', val: pl.prime_cost_pct, color: '#7F77DD' },
            { label: 'Bev mix', val: pl.bev_mix_pct, color: '#1D9E75' },
          ].map(({ label, val, color }) => (
            <div className="bar-row" key={label}>
              <div className="bar-label">{label}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(100, val)}%`, background: color }} />
              </div>
              <div className="bar-val">{pct(val)}</div>
            </div>
          ))}
          <div className="card-stats">
            <div className="stat-row"><span>Avg check</span><span>${(pl.avg_check || 0).toFixed(2)}</span></div>
            <div className="stat-row"><span>Total covers</span><span>{pl.covers}</span></div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="secondary-btn" onClick={() => exportPL(pl)} style={{ flex: 1 }}>
          Download P&L report (Excel)
        </button>
      </div>
    </div>
  );
}

function EntryTab({ onSaved }) {
  const [date, setDate] = useState(today());
  const [food, setFood] = useState('');
  const [bev, setBev] = useState('');
  const [covers, setCovers] = useState('');
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [editEntry, setEditEntry] = useState(null);
  const [editFood, setEditFood] = useState('');
  const [editBev, setEditBev] = useState('');
  const [editCovers, setEditCovers] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { loadEntries(); }, []); // eslint-disable-line

  async function loadEntries() {
    try {
      const month = thisMonth();
      const lastDay = new Date(month.split("-")[0], month.split("-")[1], 0).getDate();
      const res = await API.get(`/entries?from=${month}-01&to=${month}-${lastDay}`);
      setEntries(res.data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) { console.error(e); }
  }

  async function save() {
    if (!date || (!food && !bev)) { setMsg('Please enter a date and at least one sales amount.'); return; }
    setSaving(true); setMsg('');
    try {
      await API.post('/entries', {
        date,
        food_sales: parseFloat(food) || 0,
        beverage_sales: parseFloat(bev) || 0,
        covers: parseInt(covers) || 0,
      });
      setFood(''); setBev(''); setCovers('');
      setMsg('Saved!');
      await loadEntries();
      onSaved();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg('Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await API.delete(`/entries/${id}`);
      await loadEntries();
      onSaved();
    } catch (e) { console.error(e); }
  }

  function openEdit(e) {
    setEditEntry(e);
    setEditFood(e.food_sales / 100);
    setEditBev(e.beverage_sales / 100);
    setEditCovers(e.covers);
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      await API.post('/entries', {
        date: editEntry.date,
        food_sales: parseFloat(editFood) || 0,
        beverage_sales: parseFloat(editBev) || 0,
        covers: parseInt(editCovers) || 0,
      });
      setEditEntry(null);
      await loadEntries();
      onSaved();
    } catch (e) { console.error(e); } finally {
      setEditSaving(false);
    }
  }

  return (
    <div>
      {editEntry && (
        <Modal title={`Edit entry — ${editEntry.date}`} onClose={() => setEditEntry(null)}>
          <div className="field-grid">
            <div className="field"><label>Food sales ($)</label><input type="number" value={editFood} onChange={e => setEditFood(e.target.value)} min="0" /></div>
            <div className="field"><label>Beverage sales ($)</label><input type="number" value={editBev} onChange={e => setEditBev(e.target.value)} min="0" /></div>
            <div className="field"><label>Covers (guests)</label><input type="number" value={editCovers} onChange={e => setEditCovers(e.target.value)} min="0" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="primary-btn" onClick={saveEdit} disabled={editSaving} style={{ flex: 1 }}>
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
            <button onClick={() => setEditEntry(null)} style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, padding: 10, cursor: 'pointer', fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Add or update daily sales</div>
        <div className="field-grid">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field"><label>Covers (guests)</label><input type="number" value={covers} onChange={e => setCovers(e.target.value)} placeholder="e.g. 52" min="0" /></div>
          <div className="field"><label>Food sales ($)</label><input type="number" value={food} onChange={e => setFood(e.target.value)} placeholder="e.g. 1200" min="0" /></div>
          <div className="field"><label>Beverage sales ($)</label><input type="number" value={bev} onChange={e => setBev(e.target.value)} placeholder="e.g. 380" min="0" /></div>
        </div>
        {msg && <div className={`msg ${msg === 'Saved!' ? 'msg-ok' : 'msg-err'}`}>{msg}</div>}
        <button className="primary-btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save entry'}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>This month ({entries.length} entries)</div>
        {entries.length > 0 && (
          <button onClick={() => exportSales(entries, thisMonth())} style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}>
            Download Excel
          </button>
        )}
      </div>
      {entries.length === 0
        ? <div className="empty-state"><p>No entries yet this month.</p></div>
        : entries.map(e => (
          <div className="list-item" key={e.id}>
            <span className="list-date">{e.date}</span>
            <div className="list-vals">
              <span>Food: {fmt(e.food_sales / 100)}</span>
              <span>Bev: {fmt(e.beverage_sales / 100)}</span>
              <span>Covers: {e.covers}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(e)} style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}>Edit</button>
              <button className="del-btn" onClick={() => del(e.id)}>x</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function ExpensesTab({ onSaved }) {
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('food_cost');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [editExp, setEditExp] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('food_cost');
  const [editSaving, setEditSaving] = useState(false);

  const catLabels = {
    food_cost: 'Food cost', beverage_cost: 'Bev cost', labor: 'Labor',
    rent: 'Rent', utilities: 'Utilities', marketing: 'Marketing',
    maintenance: 'Maintenance', other: 'Other'
  };

  useEffect(() => { loadExpenses(); }, []); // eslint-disable-line

  async function loadExpenses() {
    try {
      const month = thisMonth();
      const lastDay2 = new Date(month.split("-")[0], month.split("-")[1], 0).getDate();
      const res = await API.get(`/expenses?from=${month}-01&to=${month}-${lastDay2}`);
      setExpenses(res.data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) { console.error(e); }
  }

  async function save() {
    if (!date || !amount) { setMsg('Please enter a date and amount.'); return; }
    setSaving(true); setMsg('');
    try {
      await API.post('/expenses', { date, category, amount: parseFloat(amount), description: desc });
      setAmount(''); setDesc('');
      setMsg('Saved!');
      await loadExpenses();
      onSaved();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg('Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await API.delete(`/expenses/${id}`);
      await loadExpenses();
      onSaved();
    } catch (e) { console.error(e); }
  }

  function openEdit(e) {
    setEditExp(e);
    setEditAmount(e.amount / 100);
    setEditDesc(e.description || '');
    setEditCat(e.category);
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      await API.delete(`/expenses/${editExp.id}`);
      await API.post('/expenses', {
        date: editExp.date,
        category: editCat,
        amount: parseFloat(editAmount) || 0,
        description: editDesc,
      });
      setEditExp(null);
      await loadExpenses();
      onSaved();
    } catch (e) { console.error(e); } finally {
      setEditSaving(false);
    }
  }

  return (
    <div>
      {editExp && (
        <Modal title={`Edit expense — ${editExp.date}`} onClose={() => setEditExp(null)}>
          <div className="field-grid">
            <div className="field"><label>Category</label>
              <select value={editCat} onChange={e => setEditCat(e.target.value)}>
                {Object.entries(catLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field"><label>Amount ($)</label><input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} min="0" /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Description</label><input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="primary-btn" onClick={saveEdit} disabled={editSaving} style={{ flex: 1 }}>
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
            <button onClick={() => setEditExp(null)} style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, padding: 10, cursor: 'pointer', fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Log an expense</div>
        <div className="field-grid">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field"><label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {Object.entries(catLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field"><label>Amount ($)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 450" min="0" /></div>
          <div className="field"><label>Description</label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Meat supplier" /></div>
        </div>
        {msg && <div className={`msg ${msg === 'Saved!' ? 'msg-ok' : 'msg-err'}`}>{msg}</div>}
        <button className="primary-btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save expense'}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>This month ({expenses.length} expenses)</div>
        {expenses.length > 0 && (
          <button onClick={() => exportExpenses(expenses, thisMonth())} style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}>
            Download Excel
          </button>
        )}
      </div>
      {expenses.length === 0
        ? <div className="empty-state"><p>No expenses logged yet.</p></div>
        : expenses.map(e => (
          <div className="list-item" key={e.id}>
            <span className="list-date">{e.date}</span>
            <div className="list-vals">
              <span className="cat-badge">{catLabels[e.category]}</span>
              <span>{fmt(e.amount / 100)}</span>
              {e.description && <span className="list-desc">{e.description}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(e)} style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}>Edit</button>
              <button className="del-btn" onClick={() => del(e.id)}>x</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function InventoryTab({ onSaved }) {
  const emptyState = {
    meat_seafood: '', produce: '', dairy_eggs: '', dry_goods: '',
    beverages_coffee: '', beverages_soft_drinks: '', beverages_alcohol: '', other: ''
  };

  const [month, setMonth] = useState(thisMonth());
  const [opening, setOpening] = useState(emptyState);
  const [closing, setClosing] = useState(emptyState);
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');

  const categories = [
    { key: 'meat_seafood', label: 'Meat and Seafood' },
    { key: 'produce', label: 'Produce' },
    { key: 'dairy_eggs', label: 'Dairy and Eggs' },
    { key: 'dry_goods', label: 'Dry Goods and Pantry' },
    { key: 'beverages_coffee', label: 'Beverages - Coffee and Tea' },
    { key: 'beverages_soft_drinks', label: 'Beverages - Soft Drinks' },
    { key: 'beverages_alcohol', label: 'Beverages - Alcohol' },
    { key: 'other', label: 'Other' },
  ];

  const loadInventory = useCallback(async () => {
    try {
      const res = await API.get(`/inventory?month=${month}`);
      res.data.forEach(inv => {
        const vals = {};
        categories.forEach(c => { vals[c.key] = inv[c.key] ? inv[c.key] / 100 : ''; });
        if (inv.type === 'opening') setOpening(vals);
        if (inv.type === 'closing') setClosing(vals);
      });
    } catch (e) { console.error(e); }
  // eslint-disable-next-line
  }, [month]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  async function save(type) {
    setSaving(type); setMsg('');
    const vals = type === 'opening' ? opening : closing;
    try {
      await API.post('/inventory', {
        month, type,
        meat_seafood: parseFloat(vals.meat_seafood) || 0,
        produce: parseFloat(vals.produce) || 0,
        dairy_eggs: parseFloat(vals.dairy_eggs) || 0,
        dry_goods: parseFloat(vals.dry_goods) || 0,
        beverages_coffee: parseFloat(vals.beverages_coffee) || 0,
        beverages_soft_drinks: parseFloat(vals.beverages_soft_drinks) || 0,
        beverages_alcohol: parseFloat(vals.beverages_alcohol) || 0,
        other: parseFloat(vals.other) || 0,
      });
      setMsg((type === 'opening' ? 'Opening' : 'Closing') + ' inventory saved!');
      onSaved();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg('Error saving. Please try again.');
    } finally {
      setSaving('');
    }
  }

  const totalOpening = Object.values(opening).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalClosing = Object.values(closing).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>Inventory count</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
      </div>
      {msg && <div className={`msg ${msg.includes('Error') ? 'msg-err' : 'msg-ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="two-col">
        <div className="card">
          <div className="card-title">Opening inventory - start of month</div>
          {categories.map(c => (
            <div className="field" key={c.key} style={{ marginBottom: 8 }}>
              <label>{c.label}</label>
              <input type="number" placeholder="0" min="0"
                value={opening[c.key]}
                onChange={e => setOpening(p => ({ ...p, [c.key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, padding: '8px 0', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
            <span>Total opening</span><span>{fmt(totalOpening)}</span>
          </div>
          <button className="primary-btn" onClick={() => save('opening')} disabled={saving === 'opening'}>
            {saving === 'opening' ? 'Saving...' : 'Save opening inventory'}
          </button>
        </div>
        <div className="card">
          <div className="card-title">Closing inventory - end of month</div>
          {categories.map(c => (
            <div className="field" key={c.key} style={{ marginBottom: 8 }}>
              <label>{c.label}</label>
              <input type="number" placeholder="0" min="0"
                value={closing[c.key]}
                onChange={e => setClosing(p => ({ ...p, [c.key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, padding: '8px 0', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
            <span>Total closing</span><span>{fmt(totalClosing)}</span>
          </div>
          <button className="primary-btn" onClick={() => save('closing')} disabled={saving === 'closing'}>
            {saving === 'closing' ? 'Saving...' : 'Save closing inventory'}
          </button>
        </div>
      </div>
      <div className="card" style={{ marginTop: 4 }}>
        <div className="card-title">Real food cost calculation</div>
        <div className="pl-line sub"><span>Opening inventory</span><span>{fmt(totalOpening)}</span></div>
        <div className="pl-line sub"><span>Plus purchases from expenses tab</span><span>--</span></div>
        <div className="pl-line sub"><span>Minus closing inventory</span><span>{fmt(totalClosing)}</span></div>
        <div className="pl-line total"><span>Inventory variance</span><span>{fmt(Math.max(0, totalOpening - totalClosing))}</span></div>
      </div>
    </div>
  );
}

function AdvisorTab({ pl }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const severityClass = {
    good: 'ins-good', warning: 'ins-warn', critical: 'ins-bad', info: 'ins-info'
  };

  async function generate() {
    if (!pl || pl.total_revenue === 0) { setError('Add some sales data first.'); return; }
    setLoading(true); setError(''); setInsights(null);
    try {
      const res = await API.post('/insights/generate', { pl });
      setInsights(res.data.insights);
    } catch (err) {
      setError('Could not generate insights. Check your Anthropic API key.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="ai-header">
          <div className="ai-dot" />
          <div className="ai-title">AI advisor powered by Claude</div>
        </div>
        {!pl || pl.total_revenue === 0
          ? <div className="empty-state"><p>Add sales data first to get AI insights.</p></div>
          : loading
          ? <div className="insight ins-info"><div className="ins-title">Analyzing your numbers...</div><p>Claude is reviewing your data.</p></div>
          : insights
          ? insights.map((ins, i) => (
            <div key={i} className={`insight ${severityClass[ins.severity] || 'ins-info'}`}>
              <div className="ins-title">{ins.title}</div>
              <p>{ins.body}</p>
              {ins.action && <p className="ins-action"><strong>Action:</strong> {ins.action}</p>}
            </div>
          ))
          : <div className="insight ins-info">
              <div className="ins-title">Ready to analyze</div>
              <p>Revenue: {fmt(pl.total_revenue)} Food cost: {pct(pl.food_cost_pct)} Labor: {pct(pl.labor_pct)} Net margin: {pct(pl.net_margin_pct)}</p>
            </div>
        }
        {error && <div className="msg msg-err" style={{ marginTop: 10 }}>{error}</div>}
        {pl && pl.total_revenue > 0 && !loading && (
          <button className="secondary-btn" style={{ marginTop: 12 }} onClick={generate}>
            {insights ? 'Regenerate insights' : 'Generate AI insights'}
          </button>
        )}
      </div>
      <div className="benchmarks">
        Benchmarks: food cost 28-32% labor 28-35% prime cost under 60% net margin over 10% bev mix 25-35%
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [pl, setPl] = useState(null);
  const [plLoading, setPlLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.setItem('winprofit_session', JSON.stringify(session));
        setSession(session);
      }
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        localStorage.setItem('winprofit_session', JSON.stringify(session));
        setSession(session);
      } else {
        localStorage.removeItem('winprofit_session');
        setSession(null);
        setSubscription(null);
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  const loadPL = useCallback(async () => {
    setPlLoading(true);
    try {
      const res = await API.get(`/pl?month=${thisMonth()}`);
      setPl(res.data);
    } catch (e) {
      console.error('PL load error', e);
    } finally {
      setPlLoading(false);
    }
  }, []);

  const loadSubscription = useCallback(async () => {
    try {
      const res = await API.get('/subscriptions/status');
      setSubscription(res.data);
      if (res.data.status === 'expired') {
        setShowPricing(true);
      }
    } catch (e) {
      console.error('Subscription load error', e);
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadPL();
      loadSubscription();
    }
  }, [session, loadPL, loadSubscription]);

  async function handleUpgrade(plan) {
    try {
      const res = await API.get(`/subscriptions/checkout-url?plan=${plan}`);
      window.location.href = res.data.url;
    } catch (e) {
      console.error('Checkout error', e);
    }
  }

  function logout() {
    supabase.auth.signOut();
    setShowPricing(false);
  }

  if (!session) return <AuthScreen onLogin={setSession} />;
  if (showPricing) return <Pricing subscription={subscription} onLogin={() => setShowPricing(false)} onUpgrade={handleUpgrade} />;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'entry', label: 'Enter data' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'advisor', label: 'AI advisor' },
  ];

  const daysLeft = subscription && subscription.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="app-wrap">
      <nav className="topnav">
        <div className="brand">Win<span>Profit</span></div>
        <div className="nav-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`nav-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {daysLeft !== null && daysLeft <= 7 && (
            <button className="trial-warning" onClick={() => setShowPricing(true)}>
              {daysLeft} days left in trial
            </button>
          )}
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </nav>
      <main className="main-content">
        <div className="month-bar">
          <span className="month-label">
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          {subscription && subscription.plan === 'trial' && (
            <span className="trial-badge" onClick={() => setShowPricing(true)}>
              Free trial - {daysLeft} days left
            </span>
          )}
        </div>
        {tab === 'dashboard' && <Dashboard pl={pl} loading={plLoading} />}
        {tab === 'entry' && <EntryTab onSaved={loadPL} />}
        {tab === 'expenses' && <ExpensesTab onSaved={loadPL} />}
        {tab === 'inventory' && <InventoryTab onSaved={loadPL} />}
        {tab === 'advisor' && <AdvisorTab pl={pl} />}
      </main>
    </div>
  );
}
