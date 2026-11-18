import { useState, type FormEvent } from 'react'
import { Activity, ArrowRight, ArrowLeft, ArrowUpRight, Bell, CalendarDays, Dumbbell, LockKeyhole, Mail, MapPin, Phone, UserRound, Users, Wallet } from 'lucide-react'
import { api, type GymDto, type OwnerDto } from './api'

export default function AuthFlow({ onDone }: { onDone: (owner: OwnerDto, gym: GymDto | null) => void }) {
  const [page, setPage] = useState<'landing' | 'login' | 'register' | 'setup'>('landing')
  const [owner, setOwner] = useState<OwnerDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      if (page === 'register') {
        if (values.password !== values.confirmPassword) throw new Error('Your passwords do not match.')
        const result = await api<{ owner: OwnerDto; gym: GymDto | null }>('/auth/register', { method: 'POST', body: JSON.stringify({ name: values.name, email: values.email, phone: values.phone, password: values.password }) })
        setOwner(result.owner); setPage('setup'); return
      }
      if (page === 'login') {
        const result = await api<{ owner: OwnerDto; gym: GymDto | null }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: values.email, password: values.password }) })
        if (!result.gym) { setOwner(result.owner); setPage('setup'); return }
        onDone(result.owner, result.gym); return
      }
      const gym = await api<GymDto>('/gym', { method: 'POST', body: JSON.stringify({ name: values.gymName, address: values.address, phone: values.gymPhone }) })
      if (owner) onDone(owner, gym)
      else { const result = await api<{ owner: OwnerDto }>('/auth/me'); onDone(result.owner, gym) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.') } finally { setBusy(false) }
  }
  const setup = page === 'setup'
  if (page === 'landing') return <main className="landing-shell"><header className="landing-header"><div className="auth-brand"><div className="brand-mark"><Activity size={19}/></div><span>forma<span className="brand-dot">.</span></span></div><div><button className="landing-login" onClick={() => setPage('login')}>Sign in</button><button className="button button-primary" onClick={() => setPage('register')}>Create your account<ArrowRight size={15}/></button></div></header><section className="landing-hero"><div className="landing-eyebrow"><span/> A calmer way to run your gym</div><h1>Your gym,<br/><em>in good shape.</em></h1><p>Members, memberships, payments, and renewal reminders. A thoughtful workspace built for the people who keep gyms moving.</p><div className="landing-cta"><button className="button button-primary" onClick={() => setPage('register')}>Get started<ArrowRight size={16}/></button><button className="landing-secondary" onClick={() => document.getElementById('landing-features')?.scrollIntoView({ behavior: 'smooth' })}>Take a look <ArrowRight size={14}/></button></div><div className="landing-trust"><div className="trust-avatars"><span>AM</span><span>PS</span><span>RK</span></div><span>Made for gym owners,<br/><strong>with the details in mind.</strong></span></div><div className="hero-decoration"><div className="deco-ring ring-one"/><div className="deco-ring ring-two"/><div className="deco-core"><Dumbbell size={31}/></div><span className="deco-dot dot-one"/><span className="deco-dot dot-two"/><span className="deco-dot dot-three"/></div><div className="landing-note"><span>01</span><p>One clear view<br/>of your business.</p><ArrowUpRight size={16}/></div></section><section id="landing-features" className="landing-features"><div><span className="feature-index">01 / PEOPLE</span><Users size={19}/><h2>Know your members</h2><p>Keep contact details, membership status, and payment history close at hand.</p></div><div><span className="feature-index">02 / MEMBERSHIPS</span><CalendarDays size={19}/><h2>Stay ahead of renewals</h2><p>See who is coming up for renewal and keep their history intact.</p></div><div><span className="feature-index">03 / PAYMENTS</span><Wallet size={19}/><h2>Make payments clearer</h2><p>Track offline payments and send payment links through your own merchant account.</p></div><div><span className="feature-index">04 / REMINDERS</span><Bell size={19}/><h2>Let reminders run</h2><p>Send business-initiated renewal notices with a payment link, on schedule.</p></div></section><footer className="landing-footer">© 2026 Forma <span/>Built for gym owners.</footer></main>
  return <main className="auth-shell"><div className="auth-brand"><div className="brand-mark"><Activity size={19}/></div><span>forma<span className="brand-dot">.</span></span></div><section className="auth-card"><div className="auth-icon">{setup ? <Dumbbell size={21}/> : page === 'register' ? <UserRound size={21}/> : <LockKeyhole size={21}/>}</div><p className="auth-kicker">{setup ? 'YOUR NEW WORKSPACE' : 'A STRONGER WAY TO RUN YOUR GYM'}</p><h1>{setup ? 'Let’s set up your gym' : page === 'register' ? 'Create your account' : 'Welcome back'}</h1><p className="auth-subtitle">{setup ? 'Add a few details so your members feel at home.' : page === 'register' ? 'Everything you need to keep the business moving.' : 'Sign in to get back to your gym.'}</p>
    <form onSubmit={submit} className="auth-form">
      {page === 'register' && <><label className="field-label">Your name<div className="auth-input"><UserRound size={15}/><input name="name" required minLength={2} placeholder="Alex Morgan"/></div></label><label className="field-label">Phone number<div className="auth-input"><Phone size={15}/><input name="phone" required placeholder="+91 98765 43210"/></div></label></>}
      {page !== 'setup' && <label className="field-label">Email address<div className="auth-input"><Mail size={15}/><input name="email" type="email" required placeholder="you@example.com"/></div></label>}
      {page !== 'setup' && <label className="field-label">Password<div className="auth-input"><LockKeyhole size={15}/><input name="password" type="password" required minLength={page === 'register' ? 10 : 1} placeholder={page === 'register' ? 'At least 10 characters' : 'Your password'}/></div></label>}
      {page === 'register' && <label className="field-label">Confirm password<div className="auth-input"><LockKeyhole size={15}/><input name="confirmPassword" type="password" required minLength={10} placeholder="Enter it once more"/></div></label>}
      {setup && <><label className="field-label">Gym name<div className="auth-input"><Dumbbell size={15}/><input name="gymName" required minLength={2} placeholder="Northstar Fitness"/></div></label><label className="field-label">Gym address<div className="auth-input"><MapPin size={15}/><input name="address" required minLength={4} placeholder="Street, city, postal code"/></div></label><label className="field-label">Gym contact number<div className="auth-input"><Phone size={15}/><input name="gymPhone" required placeholder="+91 80 4567 8900"/></div></label></>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'One moment…' : setup ? 'Create gym workspace' : page === 'register' ? 'Create account' : 'Sign in'}<ArrowRight size={16}/></button>
    </form>
    {!setup && <div className="auth-switch">{page === 'login' ? 'New to Forma?' : 'Already have an account?'} <button onClick={() => { setError(''); setPage(page === 'login' ? 'register' : 'login') }}>{page === 'login' ? 'Create an account' : 'Sign in'}</button></div>}
    {setup && <button className="auth-back" onClick={() => { setError(''); setPage('login') }}><ArrowLeft size={14}/>Back to sign in</button>}
    <div className="auth-footnote">Owner access only · Your members don’t need an account</div>
  </section><footer className="auth-footer">© 2026 Forma <span/>Built to keep your gym in motion.</footer></main>
}
