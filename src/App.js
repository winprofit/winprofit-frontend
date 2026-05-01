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

function styleSheet(ws, cols) {
  ws['!cols'] = cols.map(w => ({ wch: w }));
  return ws;
}

function headerStyle() {
  return { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '185FA5' } }, alignment: { horizontal: 'center' } };
}

function sectionStyle(color) {
  return { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: color } } };
}

function totalStyle() {
  return { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: 'E6F1FB' } }, border: { top: { style: 'thin', color: { rgb: '185FA5' } }, bottom: { style: 'thin', color: { rgb: '185FA5' } } } };
}

function applyStyles(ws, styleMap) {
  Object.entries(styleMap).forEach(([cell, style]) => {
    if (ws[cell]) ws[cell].s = style;
  });
}

function exportSales(entries, month) {
  const headers = [['Date', 'Food Sales ($)', 'Beverage Sales ($)', 'Total ($)', 'Covers', 'Avg Check ($)']];
  const rows = entries.sort((a, b) => a.date.localeCompare(b.date)).map(e => [
    e.date,
    parseFloat((e.food_sales / 100).toFixed(2)),
    parseFloat((e.beverage_sales / 100).toFixed(2)),
    parseFloat(((e.food_sales + e.beverage_sales) / 100).toFixed(2)),
    e.covers,
    e.covers > 0 ? parseFloat(((e.food_sales + e.beverage_sales) / e.covers / 100).toFixed(2)) : 0,
  ]);

  const totalFood = entries.reduce((s, e) => s + e.food_sales, 0) / 100;
  const totalBev = entries.reduce((s, e) => s + e.beverage_sales, 0) / 100;
  const totalRev = totalFood + totalBev;
  const totalCovers = entries.reduce((s, e) => s + e.covers, 0);

  rows.push([]);
  rows.push(['TOTAL', parseFloat(totalFood.toFixed(2)), parseFloat(totalBev.toFixed(2)), parseFloat(totalRev.toFixed(2)), totalCovers, totalCovers > 0 ? parseFloat((totalRev / totalCovers).toFixed(2)) : 0]);

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
  styleSheet(ws, [14, 16, 18, 14, 10, 14]);

  const lastRow = rows.length + 1;
  const styles = {};
  ['A1','B1','C1','D1','E1','F1'].forEach(c => { styles[c] = headerStyle(); });
  [`A${lastRow+1}`,`B${lastRow+1}`,`C${lastRow+1}`,`D${lastRow+1}`,`E${lastRow+1}`,`F${lastRow+1}`].forEach(c => { styles[c] = totalStyle(); });
  applyStyles(ws, styles);

  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `WinProfit_Sales_${month}.xlsx`);
}

function exportExpenses(expenses, month) {
  const catLabels = {
    food_cost: 'Food cost', beverage_cost: 'Bev cost', labor: 'Labor',
    rent: 'Rent', utilities: 'Utilities', marketing: 'Marketing',
    maintenance: 'Maintenance', other: 'Other'
  };

  const headers = [['Date', 'Category', 'Description', 'Amount ($)']];
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map(e => [
    e.date,
    catLabels[e.category] || e.category,
    e.description || '',
    parseFloat((e.amount / 100).toFixed(2)),
  ]);

  const total = expenses.reduce((s, e) => s + e.amount, 0) / 100;
  rows.push([]);
  rows.push(['TOTAL', '', '', parseFloat(total.toFixed(2))]);

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
  styleSheet(ws, [14, 16, 30, 14]);

  const lastRow = rows.length + 1;
  const styles = {};
  ['A1','B1','C1','D1'].forEach(c => { styles[c] = headerStyle(); });
  [`A${lastRow+1}`,`B${lastRow+1}`,`C${lastRow+1}`,`D${lastRow+1}`].forEach(c => { styles[c] = totalStyle(); });
  applyStyles(ws, styles);

  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `WinProfit_Expenses_${month}.xlsx`);
}

function exportPL(pl, inventory) {
  const foodOpening = inventory ? inventory.foodOpening : 0;
  const foodClosing = inventory ? inventory.foodClosing : 0;
  const bevOpening  = inventory ? inventory.bevOpening  : 0;
  const bevClosing  = inventory ? inventory.bevClosing  : 0;

  const realFoodCost = foodOpening + pl.food_cost - foodClosing;
  const realBevCost  = bevOpening  + pl.bev_cost  - bevClosing;
  const realFoodCostPct = pl.food_sales > 0    ? (realFoodCost / pl.food_sales * 100).toFixed(1)     : 0;
  const realBevCostPct  = pl.beverage_sales > 0 ? (realBevCost / pl.beverage_sales * 100).toFixed(1) : 0;
  const totalRealCost   = realFoodCost + realBevCost + pl.labor + pl.rent + pl.utilities + pl.other;
  const realNetProfit   = pl.total_revenue - totalRealCost;
  const realMarginPct   = pl.total_revenue > 0 ? (realNetProfit / pl.total_revenue * 100).toFixed(1) : 0;

  const rows = [
    ['WinProfit — P&L Report', '', ''],
    ['Period: ' + pl.month, '', ''],
    ['Restaurant: ' + (pl.restaurant ? pl.restaurant.name : ''), '', ''],
    ['', '', ''],
    ['SECTION', 'ITEM', 'AMOUNT ($)'],
    ['REVENUE', 'Food sales', parseFloat(pl.food_sales.toFixed(2))],
    ['', 'Beverage sales', parseFloat(pl.beverage_sales.toFixed(2))],
    ['', 'TOTAL REVENUE', parseFloat(pl.total_revenue.toFixed(2))],
    ['', '', ''],
    ['FOOD COSTS', 'Food purchases', parseFloat(pl.food_cost.toFixed(2))],
    ['', '+ Opening food inventory', parseFloat(foodOpening.toFixed(2))],
    ['', '- Closing food inventory', parseFloat(foodClosing.toFixed(2))],
    ['', 'REAL FOOD COST', parseFloat(realFoodCost.toFixed(2))],
    ['', 'Real food cost %', realFoodCostPct + '%'],
    ['', '', ''],
    ['BEVERAGE COSTS', 'Beverage purchases', parseFloat(pl.bev_cost.toFixed(2))],
    ['', '+ Opening bev inventory', parseFloat(bevOpening.toFixed(2))],
    ['', '- Closing bev inventory', parseFloat(bevClosing.toFixed(2))],
    ['', 'REAL BEVERAGE COST', parseFloat(realBevCost.toFixed(2))],
    ['', 'Real bev cost %', realBevCostPct + '%'],
    ['', '', ''],
    ['OTHER COSTS', 'Labor', parseFloat(pl.labor.toFixed(2))],
    ['', 'Rent', parseFloat(pl.rent.toFixed(2))],
    ['', 'Utilities', parseFloat(pl.utilities.toFixed(2))],
    ['', 'Other', parseFloat(pl.other.toFixed(2))],
    ['', '', ''],
    ['', 'TOTAL COSTS', parseFloat(totalRealCost.toFixed(2))],
    ['', '', ''],
    ['PROFIT', 'NET PROFIT (with inventory)', parseFloat(realNetProfit.toFixed(2))],
    ['', '', ''],
    ['RATIOS', 'Real food cost %', realFoodCostPct + '%'],
    ['', 'Real beverage cost %', realBevCostPct + '%'],
    ['', 'Labor %', pl.labor_pct + '%'],
    ['', 'Prime cost %', pl.prime_cost_pct + '%'],
    ['', 'Net margin % (with inventory)', realMarginPct + '%'],
    ['', 'Beverage mix %', pl.bev_mix_pct + '%'],
    ['', 'Avg check', '$' + pl.avg_check],
    ['', 'Total covers', pl.covers],
    ['', 'Days tracked', pl.days_tracked],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  styleSheet(ws, [22, 35, 16]);

  const styles = {};
  ['A1','B1','C1'].forEach(c => { styles[c] = { font: { bold: true, sz: 14, color: { rgb: '185FA5' } } }; });
  ['A5','B5','C5'].forEach(c => { styles[c] = headerStyle(); });
  ['A6','A10','A16','A22','A30'].forEach(c => { styles[c] = sectionStyle('0F6E56'); });
  ['A8','B8','C8'].forEach(c => { styles[c] = totalStyle(); });
  ['A13','B13','C13'].forEach(c => { styles[c] = totalStyle(); });
  ['A19','B19','C19'].forEach(c => { styles[c] = totalStyle(); });
  ['A27','B27','C27'].forEach(c => { styles[c] = totalStyle(); });
  ['A29','B29','C29'].forEach(c => { styles[c] = { font: { bold: true, sz: 12, color: { rgb: realNetProfit >= 0 ? '27500A' : 'A32D2D' } }, fill: { fgColor: { rgb: realNetProfit >= 0 ? 'EAF3DE' : 'FCEBEB' } } }; });
  applyStyles(ws, styles);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'P&L');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'WinProfit_PL_' + pl.month + '.xlsx');
}

function Dashboard({ pl, plCompare, compareMode, loading }) {
  const [inventory, setInventory] = useState(null);

  function changePct(current, previous) {
    if (!previous || previous === 0) return null;
    return ((current - previous) / Math.abs(previous) * 100).toFixed(1);
  }

  function ChangeTag({ current, previous, inverse = false }) {
    const chg = changePct(current, previous);
    if (chg === null) return null;
    const isPositive = parseFloat(chg) > 0;
    const isGood = inverse ? !isPositive : isPositive;
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, marginLeft: 6,
        color: isGood ? '#27500A' : '#A32D2D',
        background: isGood ? '#EAF3DE' : '#FCEBEB',
        padding: '2px 6px', borderRadius: 10,
      }}>
        {isPositive ? '↑' : '↓'} {Math.abs(chg)}%
      </span>
    );
  }

  const compareLabel = compareMode === 'prev_month' ? 'vs prev month' : 'vs last year';
  const hasCompare = plCompare && plCompare.total_revenue > 0;

  useEffect(() => {
    if (pl && pl.month) {
      API.get(`/inventory?month=${pl.month}`).then(res => {
        const inv = { opening: {}, closing: {} };
        res.data.forEach(i => { inv[i.type] = i; });

        const foodKeys = ['meat_seafood','produce','dairy_eggs','dry_goods','other'];
        const bevKeys  = ['beverages_coffee','beverages_soft_drinks','beverages_alcohol'];

        const foodOpening = foodKeys.reduce((s, k) => s + ((inv.opening[k] || 0) / 100), 0);
        const foodClosing = foodKeys.reduce((s, k) => s + ((inv.closing[k] || 0) / 100), 0);
        const bevOpening  = bevKeys.reduce((s, k) => s + ((inv.opening[k] || 0) / 100), 0);
        const bevClosing  = bevKeys.reduce((s, k) => s + ((inv.closing[k] || 0) / 100), 0);

        setInventory({ foodOpening, foodClosing, bevOpening, bevClosing });
      }).catch(() => {});
    }
  }, [pl]); // eslint-disable-line

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
          <div className="metric-value" style={{ display: 'flex', alignItems: 'center' }}>
            {fmt(pl.total_revenue)}
            {hasCompare && <ChangeTag current={pl.total_revenue} previous={plCompare.total_revenue} />}
          </div>
          <div className="metric-sub">
            {pl.days_tracked} days tracked
            {hasCompare && <span style={{ marginLeft: 6, color: '#aaa' }}>{compareLabel}: {fmt(plCompare.total_revenue)}</span>}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Food cost %</div>
          <div className={`metric-value ${fcStatus}`} style={{ display: 'flex', alignItems: 'center' }}>
            {pct(pl.food_cost_pct)}
            {hasCompare && <ChangeTag current={pl.food_cost_pct} previous={plCompare.food_cost_pct} inverse={true} />}
          </div>
          <div className={`metric-sub ${fcStatus}`}>
            Target: 28-32%
            {hasCompare && <span style={{ marginLeft: 6, color: '#aaa' }}>{compareLabel}: {pct(plCompare.food_cost_pct)}</span>}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Labor cost %</div>
          <div className={`metric-value ${labStatus}`} style={{ display: 'flex', alignItems: 'center' }}>
            {pct(pl.labor_pct)}
            {hasCompare && <ChangeTag current={pl.labor_pct} previous={plCompare.labor_pct} inverse={true} />}
          </div>
          <div className={`metric-sub ${labStatus}`}>
            Target: 28-35%
            {hasCompare && <span style={{ marginLeft: 6, color: '#aaa' }}>{compareLabel}: {pct(plCompare.labor_pct)}</span>}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net profit</div>
          <div className={`metric-value ${marginStatus}`} style={{ display: 'flex', alignItems: 'center' }}>
            {fmt(pl.net_profit)}
            {hasCompare && <ChangeTag current={pl.net_profit} previous={plCompare.net_profit} />}
          </div>
          <div className={`metric-sub ${marginStatus}`}>
            Margin: {pct(pl.net_margin_pct)}
            {hasCompare && <span style={{ marginLeft: 6, color: '#aaa' }}>{compareLabel}: {pct(plCompare.net_margin_pct)}</span>}
          </div>
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-title">
            P and L summary
            {hasCompare && <span style={{ float: 'right', fontSize: 11, color: '#aaa', fontWeight: 400 }}>{compareLabel}</span>}
          </div>
          <div className="pl-line sub"><span>Food sales</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.food_sales)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.food_sales)}</span>}</span></div>
          <div className="pl-line sub"><span>Beverage sales</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.beverage_sales)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.beverage_sales)}</span>}</span></div>
          <div className="pl-line total"><span>Total revenue</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.total_revenue)}{hasCompare && <ChangeTag current={pl.total_revenue} previous={plCompare.total_revenue} />}</span></div>
          <div className="pl-spacer" />
          <div className="pl-line sub"><span>Food cost</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.food_cost)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.food_cost)}</span>}</span></div>
          <div className="pl-line sub"><span>Beverage cost</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.bev_cost)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.bev_cost)}</span>}</span></div>
          <div className="pl-line sub"><span>Labor</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.labor)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.labor)}</span>}</span></div>
          <div className="pl-line sub"><span>Rent</span><span>{fmt(pl.rent)}</span></div>
          <div className="pl-line sub"><span>Utilities</span><span>{fmt(pl.utilities)}</span></div>
          <div className="pl-line sub"><span>Other</span><span>{fmt(pl.other)}</span></div>
          <div className={`pl-line total ${pl.net_profit >= 0 ? 'profit-pos' : 'profit-neg'}`}>
            <span>Net profit</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {fmt(pl.net_profit)}
              {hasCompare && <ChangeTag current={pl.net_profit} previous={plCompare.net_profit} />}
            </span>
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
        <button className="secondary-btn" onClick={() => exportPL(pl, inventory)} style={{ flex: 1 }}>
          Download P&L report (Excel)
        </button>
      </div>
    </div>
  );
}

function EntryTab({ onSaved, selectedMonth }) {
  const currentMonth = selectedMonth || thisMonth();
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

  useEffect(() => { loadEntries(); }, [currentMonth]); // eslint-disable-line

  async function loadEntries() {
    try {
      const month = currentMonth;
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

function ExpensesTab({ onSaved, selectedMonth }) {
  const currentMonth = selectedMonth || thisMonth();
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('food_cost');
  const [subcategory, setSubcategory] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [editExp, setEditExp] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('food_cost');
  const [editSubcat, setEditSubcat] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const catLabels = {
    food_cost: 'Food cost', beverage_cost: 'Bev cost', labor: 'Labor',
    rent: 'Rent', utilities: 'Utilities', marketing: 'Marketing',
    maintenance: 'Maintenance', other: 'Other'
  };

  const foodSubcats = [
    { value: 'meat_seafood', label: 'Meat & Seafood' },
    { value: 'produce', label: 'Produce' },
    { value: 'dairy_eggs', label: 'Dairy & Eggs' },
    { value: 'dry_goods', label: 'Dry Goods & Pantry' },
    { value: 'other_food', label: 'Other food' },
  ];

  const bevSubcats = [
    { value: 'coffee_tea', label: 'Coffee & Tea' },
    { value: 'soft_drinks', label: 'Soft Drinks' },
    { value: 'alcohol', label: 'Alcohol' },
    { value: 'other_bev', label: 'Other beverage' },
  ];

  function getSubcats(cat) {
    if (cat === 'food_cost') return foodSubcats;
    if (cat === 'beverage_cost') return bevSubcats;
    return [];
  }

  function SubcatSelect({ cat, value, onChange }) {
    const subcats = getSubcats(cat);
    if (subcats.length === 0) return null;
    return (
      <div className="field">
        <label>Subcategory</label>
        <select value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select subcategory...</option>
          {subcats.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
    );
  }

  useEffect(() => { loadExpenses(); }, [currentMonth]); // eslint-disable-line

  async function loadExpenses() {
    try {
      const month = currentMonth;
      const lastDay2 = new Date(month.split("-")[0], month.split("-")[1], 0).getDate();
      const res = await API.get(`/expenses?from=${month}-01&to=${month}-${lastDay2}`);
      setExpenses(res.data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) { console.error(e); }
  }

  async function save() {
    if (!date || !amount) { setMsg('Please enter a date and amount.'); return; }
    setSaving(true); setMsg('');
    try {
      await API.post('/expenses', { date, category, subcategory, amount: parseFloat(amount), description: desc });
      setAmount(''); setDesc(''); setSubcategory('');
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
    setEditSubcat(e.subcategory || '');
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
        subcategory: editSubcat,
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
              <select value={editCat} onChange={e => { setEditCat(e.target.value); setEditSubcat(''); }}>
                {Object.entries(catLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field"><label>Amount ($)</label><input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} min="0" /></div>
            {getSubcats(editCat).length > 0 && (
              <SubcatSelect cat={editCat} value={editSubcat} onChange={setEditSubcat} />
            )}
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
            <select value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); }}>
              {Object.entries(catLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {getSubcats(category).length > 0 && (
            <SubcatSelect cat={category} value={subcategory} onChange={setSubcategory} />
          )}
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
              {e.subcategory && <span className="cat-badge" style={{ background: '#E1F5EE', color: '#0F6E56' }}>{e.subcategory.replace(/_/g, ' ')}</span>}
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

function InventoryTab({ onSaved, selectedMonth }) {
  const emptyState = {
    meat_seafood: '', produce: '', dairy_eggs: '', dry_goods: '',
    beverages_coffee: '', beverages_soft_drinks: '', beverages_alcohol: '', other: ''
  };

  const [month, setMonth] = useState(selectedMonth || thisMonth());
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

function SettingsTab({ onSaved }) {
  const [name, setName]       = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');

  useEffect(() => {
    API.get('/restaurant').then(res => {
      setName(res.data.name || '');
      setCurrency(res.data.currency || 'USD');
    }).catch(() => {});
  }, []); // eslint-disable-line

  async function save() {
    if (!name) { setMsg('Please enter a restaurant name.'); return; }
    setSaving(true); setMsg('');
    try {
      await API.put('/restaurant', { name, currency });
      setMsg('Saved!');
      onSaved();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg('Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-title">Restaurant settings</div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Restaurant name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Le Petit Bistro" />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="KHR">KHR (฿)</option>
            <option value="THB">THB (฿)</option>
            <option value="SGD">SGD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="AUD">AUD ($)</option>
          </select>
        </div>
        {msg && <div className={`msg ${msg === 'Saved!' ? 'msg-ok' : 'msg-err'}`} style={{ marginBottom: 8 }}>{msg}</div>}
        <button className="primary-btn" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(thisMonth());
  const [pl, setPl] = useState(null);
  const [plCompare, setPlCompare] = useState(null);
  const [compareMode, setCompareMode] = useState('prev_month');
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

  function getCompareMonth(month, mode) {
    const [y, m] = month.split('-').map(Number);
    if (mode === 'prev_month') {
      const d = new Date(y, m - 2, 1);
      return d.toISOString().slice(0, 7);
    } else {
      return `${y - 1}-${String(m).padStart(2, '0')}`;
    }
  }

  const loadPL = useCallback(async (month, mode) => {
    const m = month || selectedMonth;
    const cm = mode || compareMode;
    const compareM = getCompareMonth(m, cm);
    console.log('Loading PL:', m, 'compare:', compareM);
    setPlLoading(true);
    try {
      const [mainRes, compareRes] = await Promise.all([
        API.get(`/pl?month=${m}`),
        API.get(`/pl?month=${compareM}`),
      ]);
      console.log('Main revenue:', mainRes.data.total_revenue, 'Compare revenue:', compareRes.data.total_revenue);
      setPl(mainRes.data);
      setPlCompare(compareRes.data);
    } catch (e) {
      console.error('PL load error', e);
    } finally {
      setPlLoading(false);
    }
  }, [selectedMonth, compareMode]); // eslint-disable-line

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
    { id: 'settings', label: 'Settings' },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="month"
              value={selectedMonth}
              max={thisMonth()}
              onChange={e => {
                setSelectedMonth(e.target.value);
                loadPL(e.target.value, compareMode);
              }}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '5px 10px', fontSize: 13, color: '#1a1a1a' }}
            />
            <select
              value={compareMode}
              onChange={e => {
                setCompareMode(e.target.value);
                loadPL(selectedMonth, e.target.value);
              }}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '5px 10px', fontSize: 13, color: '#1a1a1a' }}
            >
              <option value="prev_month">vs Previous month</option>
              <option value="prev_year">vs Same month last year</option>
            </select>
            {selectedMonth !== thisMonth() && (
              <button
                onClick={() => { setSelectedMonth(thisMonth()); loadPL(thisMonth(), compareMode); }}
                style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}
              >
                Back to current month
              </button>
            )}
          </div>
          {subscription && subscription.plan === 'trial' && (
            <span className="trial-badge" onClick={() => setShowPricing(true)}>
              Free trial - {daysLeft} days left
            </span>
          )}
        </div>
        {tab === 'dashboard' && <Dashboard pl={pl} plCompare={plCompare} compareMode={compareMode} loading={plLoading} />}
        {tab === 'entry' && <EntryTab onSaved={() => loadPL(selectedMonth, compareMode)} selectedMonth={selectedMonth} />}
        {tab === 'expenses' && <ExpensesTab onSaved={() => loadPL(selectedMonth, compareMode)} selectedMonth={selectedMonth} />}
        {tab === 'inventory' && <InventoryTab onSaved={() => loadPL(selectedMonth, compareMode)} selectedMonth={selectedMonth} />}
        {tab === 'advisor' && <AdvisorTab pl={pl} />}
        {tab === 'settings' && <SettingsTab onSaved={() => loadPL(selectedMonth, compareMode)} />}
      </main>
    </div>
  );
}
