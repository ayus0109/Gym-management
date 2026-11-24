import { useState, useEffect, type FormEvent } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, Dumbbell, Flame, LockKeyhole,
  Mail, ShieldCheck, Sparkles, Star, UserRound, Users,
  Wallet, Zap
} from 'lucide-react'
import { api, type GymDto, type OwnerDto } from './api'
import TiltCard from './components/TiltCard'

export default function AuthFlow({ onDone }: { onDone: (owner: OwnerDto, gym: GymDto) => void }) {
  const [page, setPage] = useState<'landing' | 'login' | 'register'>('landing')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'monthly' | 'quarterly' | 'annual'>('monthly')

  // Pre-warm backend immediately on page load so Render wakes up before user signs in
  useEffect(() => {
    fetch('/api/health').catch(() => {})
  }, [])

  function handleLaunchDemo() {
    const demoOwner: OwnerDto = {
      id: 'demo-owner',
      name: 'Demo Gym Owner',
      email: 'demo@forma.fit',
      phone: '+91 99999 90001',
    }
    const demoGym: GymDto = {
      id: 'demo-gym',
      name: 'IronPeak Fitness Studio',
      address: 'Plot 14, 100ft Road, Indiranagar, Bengaluru',
      phone: '+91 99999 90001',
      timezone: 'Asia/Kolkata',
    }
    onDone(demoOwner, demoGym)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      if (page === 'register') {
        const result = await api<{ owner: OwnerDto; gym: GymDto }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            gymName: values.gymName || undefined,
          }),
        })
        onDone(result.owner, result.gym)
        return
      }
      if (page === 'login') {
        const result = await api<{ owner: OwnerDto; gym: GymDto }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: values.email, password: values.password }),
        })
        onDone(result.owner, result.gym)
        return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please check your credentials and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (page === 'landing') {
    return (
      <main className="landing-shell">
        {/* Ambient Glow Orbs */}
        <div className="ambient-glow glow-top-left" />
        <div className="ambient-glow glow-top-right" />
        <div className="ambient-glow glow-center" />

        {/* Floating Glass Header */}
        <header className="landing-header">
          <div className="landing-header-inner">
            <div className="landing-brand" onClick={() => setPage('landing')} style={{ cursor: 'pointer' }}>
              <div className="brand-mark">
                <Activity size={20} strokeWidth={2.6} />
              </div>
              <span className="brand-title">
                forma<span className="brand-dot">.</span>
                <span className="brand-tag">PRO</span>
              </span>
            </div>

            <nav className="landing-nav-links">
              <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('landing-features')?.scrollIntoView({ behavior: 'smooth' }) }}>Features</a>
              <a href="#telemetry" onClick={e => { e.preventDefault(); document.getElementById('landing-telemetry')?.scrollIntoView({ behavior: 'smooth' }) }}>Floor Radar</a>
              <a href="#pricing" onClick={e => { e.preventDefault(); document.getElementById('landing-pricing')?.scrollIntoView({ behavior: 'smooth' }) }}>Memberships</a>
            </nav>

            <div className="header-actions">
              <button className="landing-login" onClick={() => setPage('login')}>
                Sign In
              </button>
              <button className="button button-primary hero-btn-glow" onClick={() => setPage('register')}>
                Get Started <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* HERO SECTION WITH 3D CANVAS */}
        <section className="landing-hero-container">
          <div className="landing-hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot">
                <span className="radar-ping" />
                <span className="radar-core" />
              </span>
              <span>MODERN FITNESS WORKSPACE</span>
              <span className="hero-badge-pill">v2.4</span>
            </div>

            <h1 className="hero-headline">
              Simple member management <br />
              <span className="gradient-text">for gym owners.</span>
            </h1>

            <p className="hero-description">
              Track renewals before they expire, send 1-click WhatsApp reminders with instant UPI QR codes,
              and collect payments on time — with zero monthly software fees.
            </p>

            <div className="hero-actions">
              <button className="button button-primary hero-cta-btn" onClick={() => setPage('register')}>
                <span>Start Free Workspace</span>
                <ArrowRight size={16} />
              </button>
              <button
                className="button button-secondary hero-secondary-btn"
                onClick={handleLaunchDemo}
                title="Test-drive the live dashboard in a safe interactive demo sandbox"
              >
                <Sparkles size={15} />
                <span>Explore Live Demo</span>
              </button>
            </div>

            <div className="hero-stats-row">
              <div className="hero-stat-pill">
                <strong>99.4%</strong>
                <span>On-Time Renewals</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat-pill">
                <strong>₹1.2Cr+</strong>
                <span>Processed via UPI</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat-pill">
                <strong>500+</strong>
                <span>Gyms in India</span>
              </div>
            </div>
          </div>

          {/* Interactive 3D WebGL Canvas + Floating Spatial Cards */}
          <div className="landing-hero-visual">
            <div className="hero-spatial-radar-wrapper">
              <div className="spatial-core-orb">
                <div className="spatial-ring ring-1" />
                <div className="spatial-ring ring-2" />
                <div className="spatial-ring ring-3" />
                <div className="spatial-center-badge">
                  <Dumbbell size={38} className="spatial-dumbbell-icon" />
                  <span className="spatial-pulse-glow" />
                </div>
              </div>
            </div>

            {/* Antigravity Floating Spatial Cards */}
            <TiltCard maxTilt={10} className="floating-card float-top-right">
              <div className="fc-icon sage">
                <ShieldCheck size={18} />
              </div>
              <div className="fc-content">
                <span>RENEWAL PIPELINE</span>
                <strong>42 Members Active</strong>
                <small className="fc-trend positive">↑ 18% vs last month</small>
              </div>
            </TiltCard>

            <TiltCard maxTilt={12} className="floating-card float-bottom-left">
              <div className="fc-icon amber">
                <Zap size={18} />
              </div>
              <div className="fc-content">
                <span>INSTANT PAYMENTS</span>
                <strong>₹1,48,500 Recd</strong>
                <small className="fc-trend neutral">WhatsApp 1-Click Pay</small>
              </div>
            </TiltCard>

            <TiltCard maxTilt={8} className="floating-card float-bottom-right">
              <div className="fc-icon cyan">
                <Activity size={18} />
              </div>
              <div className="fc-content">
                <span>PEAK CAPACITY</span>
                <strong>68% Floor Load</strong>
                <div className="fc-progress-track">
                  <div className="fc-progress-bar" style={{ width: '68%' }} />
                </div>
              </div>
            </TiltCard>
          </div>
        </section>

        {/* INTERACTIVE TELEMETRY & CAPABILITY HIGHLIGHTS */}
        <section id="landing-features" className="landing-section">
          <div className="section-head">
            <div className="section-eyebrow">
              <Sparkles size={14} /> ARCHITECTED FOR SPEED & CRAFT
            </div>
            <h2>Everything you need to command your fitness enterprise.</h2>
            <p>From membership lifecycles to encrypted payment webhooks, every tool is refined to eliminate friction.</p>
          </div>

          <div className="features-grid">
            <TiltCard maxTilt={6} className="feature-card">
              <div className="feature-icon-box sage">
                <Users size={22} />
              </div>
              <span className="feature-tag">01 / ATHLETES</span>
              <h3>Intelligent Member Telemetry</h3>
              <p>Keep real-time contact cards, status filters (Active, Expiring Soon, Expired, Due), and complete membership audit trails at hand.</p>
              <div className="feature-mock-row">
                <div className="mock-avatar">AM</div>
                <div className="mock-info">
                  <strong>Alex Mercer</strong>
                  <span>CrossFit Pro · Expires in 5 days</span>
                </div>
                <span className="status-badge expiring-soon"><i></i>Expiring</span>
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="feature-card">
              <div className="feature-icon-box lavender">
                <Bell size={22} />
              </div>
              <span className="feature-tag">02 / AUTOMATION</span>
              <h3>WhatsApp Renewal Engine</h3>
              <p>Schedule automatic, personalized renewal notifications with embedded Razorpay payment links straight to your athletes' phones.</p>
              <div className="feature-mock-row">
                <div className="mock-avatar green">WA</div>
                <div className="mock-info">
                  <strong>Automated Reminder Sent</strong>
                  <span>Razorpay link attached</span>
                </div>
                <span className="status-badge active"><i></i>Delivered</span>
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="feature-card">
              <div className="feature-icon-box amber">
                <Wallet size={22} />
              </div>
              <span className="feature-tag">03 / CASH FLOW</span>
              <h3>Unified Settlement Hub</h3>
              <p>Manage offline cash & UPI transactions alongside automated online Razorpay gateway payouts with automatic transaction references.</p>
              <div className="feature-mock-row">
                <div className="mock-avatar amber">₹</div>
                <div className="mock-info">
                  <strong>₹3,500 Collected Offline</strong>
                  <span>Bank Transfer / UPI QR</span>
                </div>
                <span className="status-badge paid"><i></i>Verified</span>
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="feature-card">
              <div className="feature-icon-box cyan">
                <CalendarDays size={22} />
              </div>
              <span className="feature-tag">04 / ARCHITECTURE</span>
              <h3>Dynamic Membership Plans</h3>
              <p>Configure custom durations (from 15-day trials to annual all-access passes) with live pricing models and instant member enrollment.</p>
              <div className="feature-mock-row">
                <div className="mock-avatar blue">
                  <Zap size={14} />
                </div>
                <div className="mock-info">
                  <strong>Quarterly Elite Pass</strong>
                  <span>90 Days Unlimited Access</span>
                </div>
                <span className="status-badge active"><i></i>Popular</span>
              </div>
            </TiltCard>
          </div>
        </section>

        {/* INTERACTIVE MEMBERSHIP SIMULATOR */}
        <section id="landing-pricing" className="landing-section pricing-section">
          <div className="section-head">
            <div className="section-eyebrow">
              <Flame size={14} /> SIMPLE TRANSPARENT ACCESS
            </div>
            <h2>Select the tier tailored to your facility.</h2>
            <p>Every plan includes unmetered member profiles, automated WhatsApp renewal triggers, and encrypted Razorpay integration.</p>
            <div className="pricing-tabs">
              <button
                className={`pricing-tab ${activeTab === 'monthly' ? 'active' : ''}`}
                onClick={() => setActiveTab('monthly')}
              >
                Monthly Plan
              </button>
              <button
                className={`pricing-tab ${activeTab === 'quarterly' ? 'active' : ''}`}
                onClick={() => setActiveTab('quarterly')}
              >
                Quarterly (Save 15%)
              </button>
              <button
                className={`pricing-tab ${activeTab === 'annual' ? 'active' : ''}`}
                onClick={() => setActiveTab('annual')}
              >
                Annual Pro (Save 30%)
              </button>
            </div>
          </div>

          <div className="pricing-cards-container">
            <TiltCard maxTilt={5} className="pricing-card">
              <div className="pricing-header">
                <h3>Studio Starter</h3>
                <p>For independent fitness coaches & boutique gym studios.</p>
                <div className="price-tag">
                  <strong>{activeTab === 'monthly' ? '₹999' : activeTab === 'quarterly' ? '₹2,499' : '₹7,999'}</strong>
                  <span>/ workspace</span>
                </div>
              </div>
              <ul className="pricing-features">
                <li><Check size={16} /> Up to 150 Active Members</li>
                <li><Check size={16} /> WhatsApp Renewal Notifications</li>
                <li><Check size={16} /> Offline Cash & UPI Recording</li>
                <li><Check size={16} /> Real-Time Analytics Dashboard</li>
              </ul>
              <button className="button button-secondary pricing-btn" onClick={() => setPage('register')}>
                <span>Get Started</span>
                <ArrowRight size={15} />
              </button>
            </TiltCard>

            <TiltCard maxTilt={6} className="pricing-card featured-plan">
              <div className="plan-badge">MOST POPULAR · FITNESS PRO</div>
              <div className="pricing-header">
                <h3>Forma Elite</h3>
                <p>For high-volume fitness clubs, CrossFit boxes & gym chains.</p>
                <div className="price-tag">
                  <strong>{activeTab === 'monthly' ? '₹2,499' : activeTab === 'quarterly' ? '₹6,299' : '₹19,999'}</strong>
                  <span>/ workspace</span>
                </div>
              </div>
              <ul className="pricing-features">
                <li><Check size={16} /> Unlimited Athlete Profiles</li>
                <li><Check size={16} /> Automated Meta Cloud WhatsApp API</li>
                <li><Check size={16} /> Integrated Razorpay Payment Links</li>
                <li><Check size={16} /> Live Floor Capacity Radar</li>
                <li><Check size={16} /> Priority 24/7 Technical Support</li>
              </ul>
              <button className="button button-primary pricing-btn hero-btn-glow" onClick={() => setPage('register')}>
                <span>Get Started</span>
                <ArrowRight size={16} />
              </button>
            </TiltCard>
          </div>
        </section>

        {/* TESTIMONIAL & TRUST */}
        <section className="landing-section trust-section">
          <div className="trust-quote-card">
            <div className="quote-stars">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />
              ))}
            </div>
            <blockquote>
              “Forma completely changed the way we handle renewals. We recovered over ₹85,000 in overdue payments
              in our first two weeks using automated WhatsApp links. The interface is stunning and takes zero training to learn.”
            </blockquote>
            <div className="quote-author">
              <div className="author-avatar">VK</div>
              <div>
                <strong>Vikramaditya Kulkarni</strong>
                <span>Head of Operations, IronForge Gym (Mumbai)</span>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="landing-footer-pro">
          <div className="footer-pro-inner">
            <div className="footer-brand">
              <div className="brand-mark small">
                <Activity size={16} />
              </div>
              <span>forma.pro</span>
            </div>
            <div className="footer-links">
              <span>© 2026 Forma Technologies Inc.</span>
              <span>•</span>
              <span>Designed for fitness studios and gym owners</span>
            </div>
            <button className="landing-secondary" onClick={() => setPage('login')}>
              Owner Sign In <ArrowUpRight size={14} />
            </button>
          </div>
        </footer>
      </main>
    )
  }

  // AUTH CARDS: LOGIN, REGISTER, GYM SETUP
  return (
    <main className="auth-shell">
      <div className="ambient-glow glow-center" />

      {/* Floating Brand Header */}
      <div
        className="auth-brand"
        onClick={() => setPage('landing')}
        style={{ cursor: 'pointer' }}
      >
        <div className="brand-mark">
          <Activity size={20} strokeWidth={2.6} />
        </div>
        <span className="brand-title">
          forma<span className="brand-dot">.</span>
        </span>
      </div>

      <TiltCard maxTilt={5} className="auth-card-pro">
        <div className="auth-icon-badge">
          {page === 'register' ? <UserRound size={22} /> : <LockKeyhole size={22} />}
        </div>

        <p className="auth-kicker">
          {page === 'register' ? 'GET STARTED' : 'SECURE SIGN IN'}
        </p>

        <h1 className="auth-heading">
          {page === 'register' ? 'Create owner account' : 'Welcome back to Forma'}
        </h1>

        <p className="auth-subtitle">
          {page === 'register'
            ? 'Enter your Gmail and password to launch your gym workspace instantly.'
            : 'Enter your credentials to return to your gym workspace.'}
        </p>

        <form onSubmit={submit} className="auth-form-pro">
          {page === 'register' && (
            <label className="field-label-pro">
              <span>Gym / Studio Name (Optional)</span>
              <div className="auth-input-pro">
                <Dumbbell size={16} />
                <input name="gymName" placeholder="My Gym Studio" />
              </div>
            </label>
          )}

          <label className="field-label-pro">
            <span>Email Address</span>
            <div className="auth-input-pro">
              <Mail size={16} />
              <input name="email" type="email" required placeholder="owner@gmail.com" autoFocus />
            </div>
          </label>

          <label className="field-label-pro">
            <span>Password</span>
            <div className="auth-input-pro">
              <LockKeyhole size={16} />
              <input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Enter your password (min 6 characters)"
              />
            </div>
          </label>

          {error && (
            <div className="auth-error-pro" role="alert">
              <AlertTriangle size={16} />
              <p>{error}</p>
            </div>
          )}

          <button className="button button-primary auth-submit-pro hero-btn-glow" disabled={busy}>
            <span>{busy ? 'Authenticating…' : page === 'register' ? 'Launch Gym Workspace' : 'Sign In'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-switch-pro">
          {page === 'login' ? 'New to Forma?' : 'Already have an account?'}
          <button
            type="button"
            onClick={() => {
              setError('')
              setPage(page === 'login' ? 'register' : 'login')
            }}
          >
            {page === 'login' ? 'Create an account' : 'Sign in here'}
          </button>
        </div>

        <div className="auth-footnote-pro">
          <ShieldCheck size={14} />
          <span>Encrypted with AES-256 · Owner access portal</span>
        </div>
      </TiltCard>

      <footer className="auth-footer-pro">
        <span>© 2026 Forma Technologies</span>
        <span>•</span>
        <span>Built for gym owners who value craft</span>
      </footer>
    </main>
  )
}
