import React, { useState } from 'react';
import API from './api';

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [food, setFood] = useState('');
  const [bev, setBev] = useState('');
  const [covers, setCovers] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = 3;

  async function handleStep1() {
    if (!name.trim()) { setError('Please enter your restaurant name.'); return; }
    setSaving(true); setError('');
    try {
      await API.put('/restaurant', { name, currency });
      setStep(2);
    } catch (e) {
      setError('Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2() {
    if (!food && !bev) { setError('Please enter at least one sales amount.'); return; }
    setSaving(true); setError('');
    try {
      await API.post('/entries', {
        date,
        food_sales: parseFloat(food) || 0,
        beverage_sales: parseFloat(bev) || 0,
        covers: parseInt(covers) || 0,
      });
      setStep(3);
    } catch (e) {
      setError('Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function skipStep2() {
    setStep(3);
  }

  async function finish() {
    try {
      await API.post('/onboarding/complete', {});
    } catch (e) {}
    onComplete();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#f5f5f5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 24
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 48px',
        width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
      }}>

        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: '#aaa' }}>Step {step} of {totalSteps}</div>
            <button onClick={finish} style={{ background: 'none', border: 'none', fontSize: 13, color: '#aaa', cursor: 'pointer' }}>
              Skip setup
            </button>
          </div>
          <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#185FA5',
              width: `${(step / totalSteps) * 100}%`,
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {step === 1 && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              Welcome to <span style={{ color: '#185FA5' }}>WinProfit</span>! 👋
            </div>
            <div style={{ fontSize: 15, color: '#888', marginBottom: 32 }}>
              Let's set up your restaurant in 2 minutes. First, what's your restaurant called?
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#666', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Restaurant name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Le Petit Bistro"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleStep1()}
                style={{
                  width: '100%', border: '1px solid #ddd', borderRadius: 8,
                  padding: '10px 14px', fontSize: 15, outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 13, color: '#666', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Currency
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                style={{
                  width: '100%', border: '1px solid #ddd', borderRadius: 8,
                  padding: '10px 14px', fontSize: 15, outline: 'none', background: '#fff'
                }}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="KHR">KHR (฿)</option>
                <option value="THB">THB (฿)</option>
                <option value="SGD">SGD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
            {error && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button
              onClick={handleStep1}
              disabled={saving}
              style={{
                width: '100%', background: '#185FA5', color: '#fff',
                border: 'none', borderRadius: 8, padding: '12px',
                fontSize: 15, fontWeight: 500, cursor: 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Continue →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              Add your first sale 📊
            </div>
            <div style={{ fontSize: 15, color: '#888', marginBottom: 32 }}>
              Enter today's sales to see your P&L dashboard come to life. You can always add more later.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#666', fontWeight: 500, display: 'block', marginBottom: 6 }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', fontWeight: 500, display: 'block', marginBottom: 6 }}>Covers (guests)</label>
                <input type="number" value={covers} onChange={e => setCovers(e.target.value)} placeholder="e.g. 45" min="0"
                  style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', fontWeight: 500, display: 'block', marginBottom: 6 }}>Food sales ($)</label>
                <input type="number" value={food} onChange={e => setFood(e.target.value)} placeholder="e.g. 1200" min="0"
                  style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', fontWeight: 500, display: 'block', marginBottom: 6 }}>Beverage sales ($)</label>
                <input type="number" value={bev} onChange={e => setBev(e.target.value)} placeholder="e.g. 380" min="0"
                  style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none' }} />
              </div>
            </div>
            {error && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button onClick={handleStep2} disabled={saving}
              style={{ width: '100%', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 500, cursor: 'pointer', marginBottom: 10 }}>
              {saving ? 'Saving...' : 'Save and continue →'}
            </button>
            <button onClick={skipStep2}
              style={{ width: '100%', background: '#f5f5f5', color: '#666', border: '1px solid #ddd', borderRadius: 8, padding: '10px', fontSize: 14, cursor: 'pointer' }}>
              Skip for now
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              You're all set!
            </div>
            <div style={{ fontSize: 15, color: '#888', marginBottom: 12 }}>
              Your restaurant is ready. Here's what you can do with WinProfit:
            </div>
            <div style={{ textAlign: 'left', background: '#f9f9f9', borderRadius: 10, padding: '16px 20px', marginBottom: 28 }}>
              {[
                ['📊', 'Track daily sales and expenses'],
                ['📦', 'Manage monthly inventory'],
                ['🤖', 'Get AI-powered insights'],
                ['📈', 'Compare months and spot trends'],
                ['📥', 'Download Excel reports'],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 14, color: '#444' }}>
                  <span style={{ fontSize: 18 }}>{icon}</span> {text}
                </div>
              ))}
            </div>
            <button onClick={finish}
              style={{ width: '100%', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '14px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
              Go to my dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
