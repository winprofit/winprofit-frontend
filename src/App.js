import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import API from './api';
import Pricing from './Pricing';
import Onboarding from './Onboarding';
import './App.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { t, languageNames } from './translations';

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

function AuthScreen({ onLogin, lang = 'en' }) {
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
        <p className="auth-sub">{t(lang, 'restaurantPL')}</p>
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
            {loading ? t(lang,'pleaseWait') : isSignup ? t(lang,'createAccount') : t(lang,'signIn')}
          </button>
        </form>
        <p className="auth-toggle">
          {isSignup ? t(lang,'alreadyHaveAccount') : t(lang,'dontHaveAccount')}
          <button className="link-btn" onClick={() => { setIsSignup(!isSignup); setError(''); }}>
            {isSignup ? t(lang,'signIn') : t(lang,'signUp')}
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

function Dashboard({ pl, plCompare, compareMode, loading, lang = 'en' }) {
  const [inventory, setInventory] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [restaurant, setRestaurant] = useState(null);

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

  const compareLabel = compareMode === 'prev_month' ? t(lang,'vsPrevMonth') : t(lang,'vsSameLastYear');
  const hasCompare = plCompare && plCompare.total_revenue > 0;

  // Weekly target calculation
  function getWeekRevenue(daily) {
    if (!daily || daily.length === 0) return 0;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return daily
      .filter(d => new Date(d.date) >= startOfWeek)
      .reduce((s, d) => s + d.food_sales + d.beverage_sales, 0);
  }

  // Best/worst day calculation
  function getBestWorstDays(daily) {
    if (!daily || daily.length === 0) return null;
    const withTotal = daily.map(d => ({ ...d, total: d.food_sales + d.beverage_sales }));
    const best = withTotal.reduce((a, b) => a.total > b.total ? a : b);
    const worst = withTotal.reduce((a, b) => a.total < b.total ? a : b);
    const busiest = withTotal.reduce((a, b) => (a.covers || 0) > (b.covers || 0) ? a : b);
    return { best, worst, busiest };
  }

  useEffect(() => {
    API.get('/restaurant').then(res => setRestaurant(res.data)).catch(() => {});

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

      if (pl.daily && pl.daily.length > 0) {
        const compareDaily = plCompare && plCompare.daily ? plCompare.daily : [];
        const data = pl.daily.map(d => {
          const day = parseInt(d.date.split('-')[2]);
          const compareDay = compareDaily.find(c => parseInt(c.date.split('-')[2]) === day);
          return {
            day,
            Food: parseFloat(d.food_sales.toFixed(0)),
            Beverage: parseFloat(d.beverage_sales.toFixed(0)),
            'Last period': compareDay ? parseFloat((compareDay.food_sales + compareDay.beverage_sales).toFixed(0)) : null,
          };
        });
        setDailyData(data);
      }

      const months = [];
      const [y, m] = pl.month.split('-').map(Number);
      for (let i = 5; i >= 0; i--) {
        let mm = m - i;
        let yy = y;
        if (mm <= 0) { mm += 12; yy -= 1; }
        months.push(`${yy}-${String(mm).padStart(2, '0')}`);
      }
      Promise.all(months.map(mo => API.get(`/pl?month=${mo}`).then(r => ({
        month: mo.slice(5) + '/' + mo.slice(2, 4),
        Revenue: parseFloat(r.data.total_revenue.toFixed(0)),
        'Net profit': parseFloat(r.data.net_profit.toFixed(0)),
      })).catch(() => ({ month: mo.slice(5), Revenue: 0, 'Net profit': 0 }))))
        .then(results => setTrendData(results));
    }
  }, [pl, plCompare]); // eslint-disable-line

  if (loading) return <div className="loading">Loading your P&L...</div>;
  if (!pl || pl.total_revenue === 0) return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <p>{t(lang,'noDataYet')}</p>
      <p>{t(lang,'goToEnterData')}</p>
    </div>
  );

  const fcStatus = statusClass(pl.food_cost_pct, 32, 36);
  const labStatus = statusClass(pl.labor_pct, 35, 40);
  const marginStatus = pl.net_margin_pct >= 10 ? 'ok' : pl.net_margin_pct >= 5 ? 'warn' : 'bad';

  const alertThreshold = restaurant ? parseFloat(restaurant.food_cost_alert_pct) || 35 : 35;
  const weeklyTarget = restaurant ? (restaurant.weekly_revenue_target || 0) / 100 : 0;
  const weekRevenue = getWeekRevenue(pl.daily);
  const weekPct = weeklyTarget > 0 ? Math.min(100, (weekRevenue / weeklyTarget) * 100) : 0;
  const days = getBestWorstDays(pl.daily);

  return (
    <div>
      {pl.food_cost_pct > alertThreshold && (
        <div style={{
          background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: 10,
          padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: '#A32D2D', fontSize: 14 }}>
              Food cost alert — {pl.food_cost_pct.toFixed(1)}% (threshold: {alertThreshold}%)
            </div>
            <div style={{ fontSize: 12, color: '#c0392b', marginTop: 2 }}>
              Your food cost is {(pl.food_cost_pct - alertThreshold).toFixed(1)}% above your target. Check your purchases and inventory.
            </div>
          </div>
        </div>
      )}
      {pl.food_cost_pct > alertThreshold - 2 && pl.food_cost_pct <= alertThreshold && (
        <div style={{
          background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 10,
          padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div>
            <div style={{ fontWeight: 600, color: '#854F0B', fontSize: 14 }}>
              Food cost approaching threshold — {pl.food_cost_pct.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: '#9a5e0a', marginTop: 2 }}>
              Getting close to your {alertThreshold}% alert threshold. Keep an eye on purchases.
            </div>
          </div>
        </div>
      )}

      {weeklyTarget > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Weekly revenue target</div>
            <div style={{ fontSize: 13, color: '#666' }}>
              {fmt(weekRevenue)} <span style={{ color: '#aaa' }}>/ {fmt(weeklyTarget)}</span>
            </div>
          </div>
          <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: weekPct >= 100 ? '#1D9E75' : weekPct >= 60 ? '#EF9F27' : '#E24B4A',
              width: `${weekPct}%`, transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
            {weekPct >= 100 ? '🎉 ' + t(lang,'weeklyTargetReached') : `${weekPct.toFixed(0)}% of weekly target — ${fmt(weeklyTarget - weekRevenue)} to go`}
          </div>
        </div>
      )}

      {days && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: '🏆 ' + t(lang,'bestDay'), val: fmt(days.best.total), date: days.best.date, bg: '#EAF3DE', color: '#27500A' },
            { label: '📉 ' + t(lang,'worstDay'), val: fmt(days.worst.total), date: days.worst.date, bg: '#FCEBEB', color: '#A32D2D' },
            { label: '👥 ' + t(lang,'busiestDay'), val: (days.busiest.covers || 0) + ' ' + t(lang,'covers'), date: days.busiest.date, bg: '#E6F1FB', color: '#185FA5' },
          ].map(({ label, val, date, bg, color }) => {
            const d = new Date(date + 'T12:00:00');
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={label} className="metric-card" style={{ background: bg }}>
                <div className="metric-label">{label}</div>
                <div className="metric-value" style={{ fontSize: 18, color }}>{val}</div>
                <div className="metric-sub" style={{ fontWeight: 600, color }}>{dayName}</div>
                <div className="metric-sub">{dateStr}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total revenue</div>
          <div className="metric-value" style={{ display: 'flex', alignItems: 'center' }}>
            {fmt(pl.total_revenue)}
            {hasCompare && <ChangeTag current={pl.total_revenue} previous={plCompare.total_revenue} />}
          </div>
          <div className="metric-sub">
            {pl.days_tracked} {t(lang,'daysTracked')}
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
            {t(lang,'target')}: 28-32%
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
            {t(lang,'target')}: 28-35%
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
            {t(lang,'margin')}: {pct(pl.net_margin_pct)}
            {hasCompare && <span style={{ marginLeft: 6, color: '#aaa' }}>{compareLabel}: {pct(plCompare.net_margin_pct)}</span>}
          </div>
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-title">
            {t(lang,'pandlSummary')}
            {hasCompare && <span style={{ float: 'right', fontSize: 11, color: '#aaa', fontWeight: 400 }}>{compareLabel}</span>}
          </div>
          <div className="pl-line sub"><span>{t(lang,'foodSales')}</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.food_sales)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.food_sales)}</span>}</span></div>
          <div className="pl-line sub"><span>{t(lang,'beverageSales')}</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.beverage_sales)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.beverage_sales)}</span>}</span></div>
          <div className="pl-line total"><span>{t(lang,'totalRevenueLine')}</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.total_revenue)}{hasCompare && <ChangeTag current={pl.total_revenue} previous={plCompare.total_revenue} />}</span></div>
          <div className="pl-spacer" />
          <div className="pl-line sub"><span>{t(lang,'foodCost')}</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.food_cost)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.food_cost)}</span>}</span></div>
          <div className="pl-line sub"><span>{t(lang,'beverageCost')}</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.bev_cost)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.bev_cost)}</span>}</span></div>
          <div className="pl-line sub"><span>{t(lang,'labor')}</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{fmt(pl.labor)}{hasCompare && <span style={{ color: '#aaa', fontSize: 12 }}>{fmt(plCompare.labor)}</span>}</span></div>
          <div className="pl-line sub"><span>{t(lang,'rent')}</span><span>{fmt(pl.rent)}</span></div>
          <div className="pl-line sub"><span>{t(lang,'utilities')}</span><span>{fmt(pl.utilities)}</span></div>
          <div className="pl-line sub"><span>{t(lang,'other')}</span><span>{fmt(pl.other)}</span></div>
          <div className={`pl-line total ${pl.net_profit >= 0 ? 'profit-pos' : 'profit-neg'}`}>
            <span>{t(lang,'netProfitLine')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {fmt(pl.net_profit)}
              {hasCompare && <ChangeTag current={pl.net_profit} previous={plCompare.net_profit} />}
            </span>
          </div>
        </div>
        <div className="card">
          <div className="card-title">{t(lang,'costBreakdown')}</div>
          {[
            { label: t(lang,'foodCost'), val: pl.food_cost_pct, color: '#E24B4A' },
            { label: t(lang,'labor'), val: pl.labor_pct, color: '#378ADD' },
            { label: t(lang,'primeCost'), val: pl.prime_cost_pct, color: '#7F77DD' },
            { label: t(lang,'bevMix'), val: pl.bev_mix_pct, color: '#1D9E75' },
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
            <div className="stat-row"><span>{t(lang,'avgCheck')}</span><span>${(pl.avg_check || 0).toFixed(2)}</span></div>
            <div className="stat-row"><span>{t(lang,'totalCovers')}</span><span>{pl.covers}</span></div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="secondary-btn" onClick={() => exportPL(pl, inventory)} style={{ flex: 1 }}>
          {t(lang,'downloadPL')}
        </button>
      </div>

      {dailyData.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">{t(lang,'dailyRevenue')} — {pl.month}</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v)} />
              <Tooltip formatter={(v, n) => ['$' + v.toLocaleString(), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Food" stackId="a" fill="#185FA5" radius={[0,0,0,0]} />
              <Bar dataKey="Beverage" stackId="a" fill="#1D9E75" radius={[3,3,0,0]} />
              {hasCompare && <Line type="monotone" dataKey="Last period" stroke="#EF9F27" strokeWidth={2} dot={false} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {trendData.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">{t(lang,'monthTrend')}</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v)} />
              <Tooltip formatter={(v, n) => ['$' + v.toLocaleString(), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Revenue" stroke="#185FA5" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Net profit" stroke="#1D9E75" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EntryTab({ onSaved, selectedMonth, lang = 'en' }) {
  const currentMonth = selectedMonth || thisMonth();
  const compareMonth = getCompareMonth(currentMonth, 'prev_month');
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
  const [summary, setSummary] = useState(null);
  const [compareSummary, setCompareSummary] = useState(null);

  useEffect(() => {
    loadEntries();
    API.get(`/pl?month=${currentMonth}`).then(r => setSummary(r.data)).catch(() => {});
    API.get(`/pl?month=${compareMonth}`).then(r => setCompareSummary(r.data)).catch(() => {});
  }, [currentMonth]); // eslint-disable-line

  async function loadEntries() {
    try {
      const month = currentMonth;
      const lastDay = new Date(month.split("-")[0], month.split("-")[1], 0).getDate();
      const res = await API.get(`/entries?from=${month}-01&to=${month}-${lastDay}`);
      setEntries(res.data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) { console.error(e); }
  }

  async function save() {
    if (!date || (!food && !bev)) { setMsg(t(lang,'pleaseEnterDate')); return; }
    setSaving(true); setMsg('');
    try {
      await API.post('/entries', {
        date,
        food_sales: parseFloat(food) || 0,
        beverage_sales: parseFloat(bev) || 0,
        covers: parseInt(covers) || 0,
      });
      setFood(''); setBev(''); setCovers('');
      setMsg(t(lang,'saved'));
      await loadEntries();
      onSaved();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg(t(lang,'errorSaving'));
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!window.confirm(t(lang,'errorDelete'))) return;
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
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: t(lang,'totalRevenue'), curr: summary.total_revenue, prev: compareSummary?.total_revenue },
            { label: 'Food sales', curr: summary.food_sales, prev: compareSummary?.food_sales },
            { label: 'Beverage sales', curr: summary.beverage_sales, prev: compareSummary?.beverage_sales },
          ].map(({ label, curr, prev }) => {
            const chg = prev && prev > 0 ? ((curr - prev) / prev * 100).toFixed(1) : null;
            const isUp = chg && parseFloat(chg) > 0;
            return (
              <div key={label} className="metric-card">
                <div className="metric-label">{label}</div>
                <div className="metric-value" style={{ fontSize: 16 }}>{fmt(curr)}</div>
                <div className="metric-sub">
                  {chg ? (
                    <span style={{ color: isUp ? '#27500A' : '#A32D2D', fontWeight: 600 }}>
                      {isUp ? '↑' : '↓'} {Math.abs(chg)}% {t(lang,'vsPrevMonth')}
                    </span>
                  ) : <span>{summary.days_tracked} {t(lang,'daysTracked')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editEntry && (
        <Modal title={`${t(lang,'editEntry')} — ${editEntry.date}`} onClose={() => setEditEntry(null)}>
          <div className="field-grid">
            <div className="field"><label>Food sales ($)</label><input type="number" value={editFood} onChange={e => setEditFood(e.target.value)} min="0" /></div>
            <div className="field"><label>Beverage sales ($)</label><input type="number" value={editBev} onChange={e => setEditBev(e.target.value)} min="0" /></div>
            <div className="field"><label>{t(lang,'coversGuests')}</label><input type="number" value={editCovers} onChange={e => setEditCovers(e.target.value)} min="0" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="primary-btn" onClick={saveEdit} disabled={editSaving} style={{ flex: 1 }}>
              {editSaving ? t(lang,'saving') : t(lang,'saveChanges')}
            </button>
            <button onClick={() => setEditEntry(null)} style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, padding: 10, cursor: 'pointer', fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">{t(lang,'addUpdateSales')}</div>
        <div className="field-grid">
          <div className="field"><label>{t(lang,'date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field"><label>{t(lang,'coversGuests')}</label><input type="number" value={covers} onChange={e => setCovers(e.target.value)} placeholder="e.g. 52" min="0" /></div>
          <div className="field"><label>Food sales ($)</label><input type="number" value={food} onChange={e => setFood(e.target.value)} placeholder="e.g. 1200" min="0" /></div>
          <div className="field"><label>Beverage sales ($)</label><input type="number" value={bev} onChange={e => setBev(e.target.value)} placeholder="e.g. 380" min="0" /></div>
        </div>
        {msg && <div className={`msg ${msg === 'Saved!' ? 'msg-ok' : 'msg-err'}`}>{msg}</div>}
        <button className="primary-btn" onClick={save} disabled={saving}>{saving ? t(lang,'saving') : t(lang,'saveEntry')}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>{t(lang,'thisMonth')} ({entries.length} {t(lang,'entries')})</div>
        {entries.length > 0 && (
          <button onClick={() => exportSales(entries, thisMonth())} style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}>
            {t(lang,'downloadExcel')}
          </button>
        )}
      </div>
      {entries.length === 0
        ? <div className="empty-state"><p>{t(lang,'noEntriesYet')}</p></div>
        : entries.map(e => (
          <div className="list-item" key={e.id}>
            <span className="list-date">{e.date}</span>
            <div className="list-vals">
              <span>Food: {fmt(e.food_sales / 100)}</span>
              <span>Bev: {fmt(e.beverage_sales / 100)}</span>
              <span>Covers: {e.covers}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(e)} style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}>{t(lang,'edit')}</button>
              <button className="del-btn" onClick={() => del(e.id)}>x</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function ExpensesTab({ onSaved, selectedMonth, lang = 'en' }) {
  const currentMonth = selectedMonth || thisMonth();
  const compareMonth = getCompareMonth(currentMonth, 'prev_month');
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
  const [summary, setSummary] = useState(null);
  const [compareSummary, setCompareSummary] = useState(null);

  const catLabels = {
    food_cost: t(lang,'catFoodCost'), beverage_cost: t(lang,'catBevCost'), labor: t(lang,'catLabor'),
    rent: t(lang,'catRent'), utilities: t(lang,'catUtilities'), marketing: t(lang,'catMarketing'),
    maintenance: t(lang,'catMaintenance'), other: t(lang,'catOther')
  };

  const foodSubcats = [
    { value: 'meat_seafood', label: t(lang,'meatSeafood') },
    { value: 'produce', label: t(lang,'produce') },
    { value: 'dairy_eggs', label: t(lang,'dairyEggs') },
    { value: 'dry_goods', label: t(lang,'dryGoods') },
    { value: 'other_food', label: t(lang,'otherFood') },
  ];

  const bevSubcats = [
    { value: 'coffee_tea', label: t(lang,'coffeeTea') },
    { value: 'soft_drinks', label: t(lang,'softDrinks') },
    { value: 'alcohol', label: t(lang,'alcohol') },
    { value: 'other_bev', label: t(lang,'otherBev') },
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
        <label>{t(lang,'subcategory')}</label>
        <select value={value} onChange={e => onChange(e.target.value)}>
          <option value="">{t(lang,'selectSubcategory')}</option>
          {subcats.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
    );
  }

  useEffect(() => {
    loadExpenses();
    API.get(`/pl?month=${currentMonth}`).then(r => setSummary(r.data)).catch(() => {});
    API.get(`/pl?month=${compareMonth}`).then(r => setCompareSummary(r.data)).catch(() => {});
  }, [currentMonth]); // eslint-disable-line

  async function loadExpenses() {
    try {
      const month = currentMonth;
      const lastDay2 = new Date(month.split("-")[0], month.split("-")[1], 0).getDate();
      const res = await API.get(`/expenses?from=${month}-01&to=${month}-${lastDay2}`);
      setExpenses(res.data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) { console.error(e); }
  }

  async function save() {
    if (!date || !amount) { setMsg(t(lang,'pleaseEnterDateAmount')); return; }
    setSaving(true); setMsg('');
    try {
      await API.post('/expenses', { date, category, subcategory, amount: parseFloat(amount), description: desc });
      setAmount(''); setDesc(''); setSubcategory('');
      setMsg(t(lang,'saved'));
      await loadExpenses();
      onSaved();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg(t(lang,'errorSaving'));
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!window.confirm(t(lang,'errorDeleteExpense'))) return;
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
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Total expenses', curr: summary.total_expenses, prev: compareSummary?.total_expenses, inverse: true },
            { label: t(lang,'foodCostPct'), curr: summary.food_cost_pct, prev: compareSummary?.food_cost_pct, isPct: true, inverse: true },
            { label: t(lang,'laborCostPct'), curr: summary.labor_pct, prev: compareSummary?.labor_pct, isPct: true, inverse: true },
          ].map(({ label, curr, prev, isPct, inverse }) => {
            const chg = prev && prev > 0 ? ((curr - prev) / prev * 100).toFixed(1) : null;
            const isUp = chg && parseFloat(chg) > 0;
            const isGood = inverse ? !isUp : isUp;
            return (
              <div key={label} className="metric-card">
                <div className="metric-label">{label}</div>
                <div className="metric-value" style={{ fontSize: 16 }}>{isPct ? pct(curr) : fmt(curr)}</div>
                <div className="metric-sub">
                  {chg ? (
                    <span style={{ color: isGood ? '#27500A' : '#A32D2D', fontWeight: 600 }}>
                      {isUp ? '↑' : '↓'} {Math.abs(chg)}% {t(lang,'vsPrevMonth')}
                    </span>
                  ) : <span>t(lang,'vsPrevMonth') + ':' {prev ? (isPct ? pct(prev) : fmt(prev)) : t(lang,'noDataYet')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editExp && (
        <Modal title={`${t(lang,'editExpense')} — ${editExp.date}`} onClose={() => setEditExp(null)}>
          <div className="field-grid">
            <div className="field"><label>{t(lang,'category')}</label>
              <select value={editCat} onChange={e => { setEditCat(e.target.value); setEditSubcat(''); }}>
                {Object.entries(catLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field"><label>Amount ($)</label><input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} min="0" /></div>
            {getSubcats(editCat).length > 0 && (
              <SubcatSelect cat={editCat} value={editSubcat} onChange={setEditSubcat} />
            )}
            <div className="field" style={{ gridColumn: 'span 2' }}><label>{t(lang,'description')}</label><input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="primary-btn" onClick={saveEdit} disabled={editSaving} style={{ flex: 1 }}>
              {editSaving ? t(lang,'saving') : t(lang,'saveChanges')}
            </button>
            <button onClick={() => setEditExp(null)} style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, padding: 10, cursor: 'pointer', fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">{t(lang,'logExpense')}</div>
        <div className="field-grid">
          <div className="field"><label>{t(lang,'date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field"><label>{t(lang,'category')}</label>
            <select value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); }}>
              {Object.entries(catLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {getSubcats(category).length > 0 && (
            <SubcatSelect cat={category} value={subcategory} onChange={setSubcategory} />
          )}
          <div className="field"><label>Amount ($)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 450" min="0" /></div>
          <div className="field"><label>{t(lang,'description')}</label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Meat supplier" /></div>
        </div>
        {msg && <div className={`msg ${msg === 'Saved!' ? 'msg-ok' : 'msg-err'}`}>{msg}</div>}
        <button className="primary-btn" onClick={save} disabled={saving}>{saving ? t(lang,'saving') : t(lang,'saveExpense')}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>{t(lang,'thisMonth')} ({expenses.length} {t(lang,'expenses')})</div>
        {expenses.length > 0 && (
          <button onClick={() => exportExpenses(expenses, thisMonth())} style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}>
            {t(lang,'downloadExcel')}
          </button>
        )}
      </div>
      {expenses.length === 0
        ? <div className="empty-state"><p>{t(lang,'noExpensesYet')}</p></div>
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
              <button onClick={() => openEdit(e)} style={{ background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#185FA5', cursor: 'pointer' }}>{t(lang,'edit')}</button>
              <button className="del-btn" onClick={() => del(e.id)}>x</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function InventoryTab({ onSaved, selectedMonth, lang = 'en' }) {
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
    { key: 'meat_seafood', label: t(lang,'catMeatSeafood') },
    { key: 'produce', label: t(lang,'catProduce') },
    { key: 'dairy_eggs', label: t(lang,'catDairyEggs') },
    { key: 'dry_goods', label: t(lang,'catDryGoods') },
    { key: 'beverages_coffee', label: t(lang,'catBevCoffee') },
    { key: 'beverages_soft_drinks', label: t(lang,'catBevSoft') },
    { key: 'beverages_alcohol', label: t(lang,'catBevAlcohol') },
    { key: 'other', label: t(lang,'catBevOther') },
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
      setMsg(t(lang,'errorSaving'));
    } finally {
      setSaving('');
    }
  }

  const totalOpening = Object.values(opening).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalClosing = Object.values(closing).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>{t(lang,'inventoryCount')}</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
      </div>
      {msg && <div className={`msg ${msg.includes('Error') ? 'msg-err' : 'msg-ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="two-col">
        <div className="card">
          <div className="card-title">{t(lang,'openingInventory')}</div>
          {categories.map(c => (
            <div className="field" key={c.key} style={{ marginBottom: 8 }}>
              <label>{c.label}</label>
              <input type="number" placeholder="0" min="0"
                value={opening[c.key]}
                onChange={e => setOpening(p => ({ ...p, [c.key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, padding: '8px 0', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
            <span>{t(lang,'totalOpening')}</span><span>{fmt(totalOpening)}</span>
          </div>
          <button className="primary-btn" onClick={() => save('opening')} disabled={saving === 'opening'}>
            {saving === 'opening' ? t(lang,'saving') : t(lang,'saveOpeningInventory')}
          </button>
        </div>
        <div className="card">
          <div className="card-title">{t(lang,'closingInventory')}</div>
          {categories.map(c => (
            <div className="field" key={c.key} style={{ marginBottom: 8 }}>
              <label>{c.label}</label>
              <input type="number" placeholder="0" min="0"
                value={closing[c.key]}
                onChange={e => setClosing(p => ({ ...p, [c.key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, padding: '8px 0', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
            <span>{t(lang,'totalClosing')}</span><span>{fmt(totalClosing)}</span>
          </div>
          <button className="primary-btn" onClick={() => save('closing')} disabled={saving === 'closing'}>
            {saving === 'closing' ? t(lang,'saving') : t(lang,'saveClosingInventory')}
          </button>
        </div>
      </div>
      <div className="card" style={{ marginTop: 4 }}>
        <div className="card-title">{t(lang,'realFoodCost')}</div>
        <div className="pl-line sub"><span>{t(lang,'openingInventory')}</span><span>{fmt(totalOpening)}</span></div>
        <div className="pl-line sub"><span>{t(lang,'plusPurchases')}</span><span>--</span></div>
        <div className="pl-line sub"><span>{t(lang,'minusClosing')}</span><span>{fmt(totalClosing)}</span></div>
        <div className="pl-line total"><span>{t(lang,'inventoryVariance')}</span><span>{fmt(Math.max(0, totalOpening - totalClosing))}</span></div>
      </div>
    </div>
  );
}

function AdvisorTab({ pl, lang = 'en' }) {
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
      setError(t(lang,'couldNotGenerate'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="ai-header">
          <div className="ai-dot" />
          <div className="ai-title">{t(lang,'aiAdvisorTitle')}</div>
        </div>
        {!pl || pl.total_revenue === 0
          ? <div className="empty-state"><p>{t(lang,'addDataFirst')}</p></div>
          : loading
          ? <div className="insight ins-info"><div className="ins-title">{t(lang,'analyzing')}</div><p>{t(lang,'claudeReviewing')}</p></div>
          : insights
          ? insights.map((ins, i) => (
            <div key={i} className={`insight ${severityClass[ins.severity] || 'ins-info'}`}>
              <div className="ins-title">{ins.title}</div>
              <p>{ins.body}</p>
              {ins.action && <p className="ins-action"><strong>Action:</strong> {ins.action}</p>}
            </div>
          ))
          : <div className="insight ins-info">
              <div className="ins-title">{t(lang,'readyToAnalyze')}</div>
              <p>Revenue: {fmt(pl.total_revenue)} Food cost: {pct(pl.food_cost_pct)} Labor: {pct(pl.labor_pct)} Net margin: {pct(pl.net_margin_pct)}</p>
            </div>
        }
        {error && <div className="msg msg-err" style={{ marginTop: 10 }}>{error}</div>}
        {pl && pl.total_revenue > 0 && !loading && (
          <button className="secondary-btn" style={{ marginTop: 12 }} onClick={generate}>
            {insights ? t(lang,'regenerateInsights') : t(lang,'generateInsights')}
          </button>
        )}
      </div>
      <div className="benchmarks">
        {t(lang,'benchmarks')}
      </div>
    </div>
  );
}

function SettingsTab({ onSaved, lang, setLang }) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [weeklyTarget, setWeeklyTarget] = useState('');
  const [foodCostAlert, setFoodCostAlert] = useState('35');
  const [langSetting, setLangSetting] = useState(lang || 'en');

  // Sync local langSetting when parent lang changes
  useEffect(() => { setLangSetting(lang || 'en'); }, [lang]); // eslint-disable-line
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    API.get('/restaurant').then(res => {
      setName(res.data.name || '');
      setCurrency(res.data.currency || 'USD');
      setWeeklyTarget(res.data.weekly_revenue_target ? res.data.weekly_revenue_target / 100 : '');
      setFoodCostAlert(res.data.food_cost_alert_pct || '35');
    }).catch(() => {});
  }, []); // eslint-disable-line

  async function save() {
    if (!name) { setMsg(t(lang,'pleaseEnterName')); return; }
    setSaving(true); setMsg('');
    try {
      await API.put('/restaurant', {
        name,
        currency,
        weekly_revenue_target: Math.round((parseFloat(weeklyTarget) || 0) * 100),
        food_cost_alert_pct: parseFloat(foodCostAlert) || 35,
      });
      setMsg(t(lang,'saved'));
      onSaved();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg(t(lang,'errorSaving'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-title">{t(lang,'restaurantSettings')}</div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t(lang,'restaurantName')}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Le Petit Bistro" />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t(lang,'currency')}</label>
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
        <div className="card-title" style={{ marginTop: 20, marginBottom: 12, fontSize: 13, color: '#888' }}>{t(lang,'targetsAlerts')}</div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Weekly revenue target ($)</label>
          <input type="number" value={weeklyTarget} onChange={e => setWeeklyTarget(e.target.value)} placeholder="e.g. 5000" min="0" />
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{t(lang,'weeklyTargetHint')}</div>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t(lang,'foodCostAlertThreshold')}</label>
          <input type="number" value={foodCostAlert} onChange={e => setFoodCostAlert(e.target.value)} placeholder="e.g. 35" min="0" max="100" />
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{t(lang,'foodCostAlertHint')}</div>
        </div>
                <div className="field" style={{ marginBottom: 12 }}>
          <label>{t(lang,'language')}</label>
          <select value={langSetting} onChange={e => setLangSetting(e.target.value)}>
            {Object.entries(languageNames).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        {msg && <div className={`msg ${msg === t(lang,'saved') ? 'msg-ok' : 'msg-err'}`} style={{ marginBottom: 8 }}>{msg}</div>}
        <button className="primary-btn" onClick={save} disabled={saving}>
          {saving ? t(lang,'saving') : t(lang,'saveSettings')}
        </button>
      </div>
    </div>
  );
}

function getCompareMonth(month, mode) {
  const [y, m] = month.split('-').map(Number);
  if (mode === 'prev_month') {
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
  } else {
    return `${y - 1}-${String(m).padStart(2, '0')}`;
  }
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
  const [lang, setLang] = useState(() => localStorage.getItem('winprofit_lang') || 'en');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.setItem('winprofit_session', JSON.stringify(session));
        setSession(session);
        const completed = localStorage.getItem('onboarding_complete_' + session.user.id);
        if (!completed) setShowOnboarding(true);
      }
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        localStorage.setItem('winprofit_session', JSON.stringify(session));
        setSession(session);
        const completed = localStorage.getItem('onboarding_complete_' + session.user.id);
        if (!completed) setShowOnboarding(true);
      } else {
        localStorage.removeItem('winprofit_session');
        setSession(null);
        setSubscription(null);
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  const loadPL = useCallback(async (month, mode) => {
    const m = month || selectedMonth;
    const cm = mode || compareMode;
    const compareM = getCompareMonth(m, cm);
    setPlLoading(true);
    try {
      const [mainRes, compareRes] = await Promise.all([
        API.get(`/pl?month=${m}`),
        API.get(`/pl?month=${compareM}`),
      ]);
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

  const loadLanguage = useCallback(async () => {
    try {
      const res = await API.get('/restaurant');
      const savedLang = res.data.language || 'en';
      setLang(savedLang);
      localStorage.setItem('winprofit_lang', savedLang);
    } catch (e) {}
  }, []); // eslint-disable-line

  useEffect(() => {
    if (session) {
      loadPL();
      loadSubscription();
      loadLanguage();
    }
  }, [session, loadPL, loadSubscription, loadLanguage]);

  async function handleUpgrade(plan) {
    try {
      const res = await API.get(`/subscriptions/checkout-url?plan=${plan}`);
      window.location.href = res.data.url;
    } catch (e) {
      console.error('Checkout error', e);
    }
  }

  function handleOnboardingComplete() {
    if (session) {
      localStorage.setItem('onboarding_complete_' + session.user.id, '1');
    }
    setShowOnboarding(false);
    loadPL(selectedMonth, compareMode);
  }

  function setLangPersist(l) {
    setLang(l);
    localStorage.setItem('winprofit_lang', l);
  }

  function logout() {
    supabase.auth.signOut();
    setShowPricing(false);
    setShowOnboarding(false);
  }

  if (!session) return <AuthScreen onLogin={setSession} />;
  if (showOnboarding) return <Onboarding onComplete={handleOnboardingComplete} />;
  if (showPricing) return <Pricing subscription={subscription} onLogin={() => setShowPricing(false)} onUpgrade={handleUpgrade} />;

  const tabs = [
    { id: 'dashboard', label: t(lang, 'dashboard') },
    { id: 'entry', label: t(lang, 'enterData') },
    { id: 'expenses', label: t(lang, 'expenses') },
    { id: 'inventory', label: t(lang, 'inventory') },
    { id: 'advisor', label: t(lang, 'aiAdvisor') },
    { id: 'settings', label: t(lang, 'settings') },
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
              {daysLeft} {t(lang, 'daysLeft')}
            </button>
          )}
          <button className="logout-btn" onClick={logout}>{t(lang, 'signOut')}</button>
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
              <option value="prev_month">{t(lang, 'vsPrevMonth')}</option>
              <option value="prev_year">{t(lang, 'vsSameLastYear')}</option>
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
              {t(lang, 'freeTrial')} - {daysLeft} {t(lang, 'daysLeft')}
            </span>
          )}
        </div>
        {tab === 'dashboard' && <Dashboard pl={pl} plCompare={plCompare} compareMode={compareMode} loading={plLoading} lang={lang} />}
        {tab === 'entry' && <EntryTab onSaved={() => loadPL(selectedMonth, compareMode)} selectedMonth={selectedMonth} lang={lang} />}
        {tab === 'expenses' && <ExpensesTab onSaved={() => loadPL(selectedMonth, compareMode)} selectedMonth={selectedMonth} lang={lang} />}
        {tab === 'inventory' && <InventoryTab onSaved={() => loadPL(selectedMonth, compareMode)} selectedMonth={selectedMonth} lang={lang} />}
        {tab === 'advisor' && <AdvisorTab pl={pl} lang={lang} />}
        {tab === 'settings' && <SettingsTab onSaved={() => loadPL(selectedMonth, compareMode)} lang={lang} setLang={setLangPersist} />
      </main>
    </div>
  );
}
