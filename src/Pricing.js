import React from 'react';

export default function Pricing({ onLogin, subscription, onUpgrade }) {
  const isExpired = subscription && subscription.status === 'expired';
  const isTrial = subscription && subscription.plan === 'trial' && subscription.status === 'active';

  const daysLeft = subscription && subscription.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : 30;

  return (
    <div className="pricing-wrap">
      <div className="pricing-inner">
        <div className="pricing-header">
          <div className="brand-lg">Win<span>Profit</span></div>
          {isExpired && (
            <div className="trial-expired">
              Your free trial has ended. Choose a plan to continue.
            </div>
          )}
          {isTrial && (
            <div className="trial-active">
              You have {daysLeft} days left in your free trial.
            </div>
          )}
          {!subscription && (
            <p className="pricing-sub">Start free for 30 days. No credit card required.</p>
          )}
        </div>

        <div className="plans-grid">
          <div className="plan-card">
            <div className="plan-name">Monthly</div>
            <div className="plan-price">$9<span>/month</span></div>
            <div className="plan-desc">Perfect for getting started</div>
            <ul className="plan-features">
              <li>Full P and L dashboard</li>
              <li>Daily sales and expense entry</li>
              <li>Inventory tracking</li>
              <li>AI advisor powered by Claude</li>
              <li>Cancel anytime</li>
            </ul>
            <button className="primary-btn" onClick={() => onUpgrade('monthly')}>
              {isExpired ? 'Subscribe monthly' : 'Start free trial'}
            </button>
          </div>

          <div className="plan-card plan-featured">
            <div className="plan-badge">Best value</div>
            <div className="plan-name">Yearly</div>
            <div className="plan-price">$79<span>/year</span></div>
            <div className="plan-desc">Save $29 vs monthly</div>
            <ul className="plan-features">
              <li>Everything in Monthly</li>
              <li>2 months free</li>
              <li>Priority support</li>
              <li>Early access to new features</li>
            </ul>
            <button className="primary-btn" onClick={() => onUpgrade('yearly')}>
              {isExpired ? 'Subscribe yearly' : 'Start free trial'}
            </button>
          </div>
        </div>

        {!subscription && (
          <p className="pricing-footer">
            Already have an account?
            <button className="link-btn" onClick={onLogin}>Sign in</button>
          </p>
        )}
      </div>
    </div>
  );
}
