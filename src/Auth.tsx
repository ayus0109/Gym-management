import { useState, useEffect, type FormEvent } from 'react'
import { Activity, AlertTriangle, ArrowRight, Dumbbell, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { api, type GymDto, type OwnerDto } from './api'
import './Welcome.css'

export default function AuthFlow({ onDone }: { onDone: (owner: OwnerDto, gym: GymDto) => void }) {
  const [page, setPage] = useState<'landing' | 'login' | 'register'>('landing')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      <main className="forma-welcome">
        <header className="welcome-bar">
          <strong><Activity aria-hidden="true" /> forma.</strong>
          <button className="button button-secondary" onClick={() => setPage('login')}>Sign in <ArrowRight size={16} /></button>
        </header>
        <section className="welcome-hero">
          <div>
            <h1>Your gym,<br />at a glance.</h1>
            <p>See whose membership is due, record a payment, and get back to the gym floor.</p>
            <div className="welcome-actions">
              <button className="button button-primary" onClick={() => setPage('register')}>Create workspace <ArrowRight size={17} /></button>
              <button className="button button-secondary" onClick={handleLaunchDemo}>Explore demo</button>
            </div>
          </div>
          <aside className="welcome-board" aria-label="Example gym overview">
            <small>DEMO WORKSPACE</small><h2>Front desk</h2>
            <div className="welcome-chart" aria-hidden="true">
              {[34, 48, 42, 64, 55, 75, 68, 88, 82, 98].map((height, i) =>
                <i key={height} style={{ height: height + '%', animationDelay: i * 45 + 'ms' }} />)}
            </div>
            <div className="welcome-stat"><span>Active members</span><strong>128</strong></div>
            <div className="welcome-stat"><span>Renewals this week</span><strong>8</strong></div>
          </aside>
        </section>
        <section className="welcome-features" aria-label="Workspace features">
          <article><h2>Members</h2><p>Find a member’s plan, contact details, and membership history.</p></article>
          <article><h2>Renewals</h2><p>See upcoming expiries and follow up from one list.</p></article>
          <article><h2>Payments</h2><p>Record collections and keep track of outstanding dues.</p></article>
        </section>
      </main>
    )
  }

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

      <section className="auth-card-pro">
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
            ? 'Enter your email and password to launch your gym workspace instantly.'
            : 'Enter your credentials to return to your gym workspace.'}
        </p>

        <form onSubmit={submit} className="auth-form-pro">
          {page === 'register' && (
            <label className="field-label-pro">
              <span>Gym / Studio Name (Optional)</span>
              <div className="auth-input-pro">
                <Dumbbell size={16} />
                <input name="gymName" maxLength={120} autoComplete="organization" placeholder="My Gym Studio" />
              </div>
            </label>
          )}

          <label className="field-label-pro">
            <span>Email Address</span>
            <div className="auth-input-pro">
              <Mail size={16} />
              <input name="email" autoComplete="username" maxLength={254} type="email" required placeholder="owner@gmail.com" autoFocus />
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
                minLength={page === 'register' ? 6 : 1}
                maxLength={128}
                autoComplete={page === 'register' ? 'new-password' : 'current-password'}
                placeholder={page === 'register' ? 'At least 6 characters' : 'Enter your password'}
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


      </section>

      <footer className="auth-footer-pro">
        <span>© 2026 Forma Technologies</span>
        <span>•</span>
        <span>Built for gym owners who value craft</span>
      </footer>
    </main>
  )
}
