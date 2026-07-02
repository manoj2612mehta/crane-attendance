import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase, hasConfig } from './supabaseClient'
import './app.css'

/* ============================================================
   DATE HELPERS  (IST, calendar-day based)
   completed trip days = deboard - board  (board day counted, deboard not)
   currently onboard   = today - board + 1
   ============================================================ */
const IST = 'Asia/Kolkata'
const dOnly = (d) => new Date(new Date(d).toLocaleDateString('en-CA', { timeZone: IST }))
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: IST }) // yyyy-mm-dd for <input type=date>
function tripDays(boarded_at, deboarded_at) {
  const b = dOnly(boarded_at)
  if (!deboarded_at) return Math.round((dOnly(new Date()) - b) / 86400000) + 1
  return Math.max(0, Math.round((dOnly(deboarded_at) - b) / 86400000))
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST })
}
// convert a yyyy-mm-dd picked date to an ISO timestamp at IST noon (avoids TZ edge slips)
const pickedToISO = (ymd) => new Date(`${ymd}T12:00:00+05:30`).toISOString()

const Brand = ({ pos }) => (
  <div className={`brand brand--${pos}`}>Design &amp; Created by <span>Manoj Mehta</span></div>
)

/* ============================================================ */
export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!hasConfig) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!hasConfig) return <ConfigNeeded />
  if (checking) return <Splash />
  if (!session) return <Login />
  return <Shell session={session} />
}

function ConfigNeeded() {
  return (
    <div className="center-screen">
      <div className="card notice">
        <div className="eyebrow">Setup required</div>
        <h2>Connect Supabase</h2>
        <p>Add your project keys to <code>.env</code>, then restart the dev server.</p>
      </div>
      <Brand pos="bottom" />
    </div>
  )
}
function Splash() { return <div className="center-screen"><div className="pulse-dot" /><Brand pos="bottom" /></div> }

/* ============================================================ LOGIN */
function Login() {
  const [email, setEmail] = useState(''), [pass, setPass] = useState('')
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async () => {
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) setErr(error.message); setBusy(false)
  }
  return (
    <div className="login-shell">
      <Brand pos="top" />
      <div className="login-grid">
        <div className="login-hero">
          <div className="beacon" />
          <div className="eyebrow eyebrow--light">ONGC · Offshore Operations</div>
          <h1>Crane Operator<br/>Attendance Ledger</h1>
          <p>Board and deboard operators across platforms. Live headcount, days onboard, per-platform authorization.</p>
        </div>
        <div className="login-card">
          <h2>Sign in</h2>
          <p className="muted">In-charge and admin access.</p>
          <label className="field"><span>Email</span>
            <input type="email" value={email} autoComplete="username"
              onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter'&&submit()}
              placeholder="you@ongc.co.in" /></label>
          <label className="field"><span>Password</span>
            <input type="password" value={pass} autoComplete="current-password"
              onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==='Enter'&&submit()}
              placeholder="password" /></label>
          {err && <div className="err">{err}</div>}
          <button className="btn btn--primary btn--full" disabled={busy} onClick={submit}>
            {busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </div>
      <Brand pos="bottom" />
    </div>
  )
}

/* ============================================================ SHELL */
function Shell({ session }) {
  const [platforms, setPlatforms] = useState([])
  const [operators, setOperators] = useState([])
  const [logs, setLogs] = useState([])            // ALL logs (open + closed)
  const [myInch, setMyInch] = useState([])        // this user's incharge rows
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(null)
  const [openPlatform, setOpenPlatform] = useState(null) // platform id when drilled in

  const load = useCallback(async () => {
    const [{ data: p }, { data: o }, { data: l }, { data: inch }] = await Promise.all([
      supabase.from('platforms').select('*').order('code'),
      supabase.from('operators').select('*').eq('active', true).order('full_name'),
      supabase.from('boarding_logs').select('*').order('boarded_at', { ascending: false }),
      supabase.from('platform_incharges').select('platform_id, is_admin').eq('user_id', session.user.id),
    ])
    setPlatforms(p || []); setOperators(o || []); setLogs(l || [])
    setMyInch(inch || [])
    setIsAdmin((inch || []).some(r => r.is_admin))
    setLoading(false)
  }, [session.user.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boarding_logs' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  // default landing tab depends on role
  useEffect(() => {
    if (loading || tab) return
    setTab(isAdmin ? 'dashboard' : 'myplatform')
  }, [loading, isAdmin, tab])

  const myPlatformIds = myInch.map(r => r.platform_id)
  const myPlatforms = platforms.filter(p => myPlatformIds.includes(p.id))

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__left">
          <div className="logo-mark" />
          <div><div className="topbar__title">Crane Attendance Ledger</div>
            <div className="topbar__sub">ONGC Offshore{isAdmin ? ' · Admin' : ''}</div></div>
        </div>
        <div className="topbar__right">
          <Brand pos="top" />
          <div className="acct">
            <span className="whoami">{session.user.email}</span>
            <button className="btn btn--ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {isAdmin && (
          <button className={tab==='dashboard'?'tab is-active':'tab'}
            onClick={() => { setTab('dashboard'); setOpenPlatform(null) }}>Dashboard</button>
        )}
        {!isAdmin && (
          <button className={tab==='myplatform'?'tab is-active':'tab'}
            onClick={() => setTab('myplatform')}>My platforms {myPlatforms.length?`· ${myPlatforms.length}`:''}</button>
        )}
        <button className={tab==='operators'?'tab is-active':'tab'}
          onClick={() => setTab('operators')}>Operators {operators.length?`· ${operators.length}`:''}</button>
      </nav>

      <main className="main">
        {loading ? <div className="pulse-dot" /> :
          tab === 'operators'
            ? <OperatorsTab operators={operators} logs={logs} reload={load} />
          : tab === 'dashboard' && isAdmin
            ? (openPlatform
                ? <PlatformSheet platform={platforms.find(p=>p.id===openPlatform)}
                    operators={operators} logs={logs} session={session} isAdmin reload={load}
                    onBack={() => setOpenPlatform(null)} />
                : <AdminDashboard platforms={platforms} operators={operators} logs={logs}
                    onOpen={setOpenPlatform} />)
          : /* in-charge */ (
              myPlatforms.length === 0
                ? <NoAssignment />
                : <MyPlatformsView myPlatforms={myPlatforms} operators={operators} logs={logs}
                    session={session} reload={load} />)
        }
      </main>

      <footer className="footer">
        <span>Crane Operator Attendance · ONGC Offshore Operations</span>
        <Brand pos="footer" />
      </footer>
    </div>
  )
}

function NoAssignment() {
  return <div className="card notice">
    <div className="eyebrow">No assignment</div>
    <h2>You don’t manage any platform yet</h2>
    <p className="muted">Ask the administrator to assign you a platform.</p>
  </div>
}

/* ============================================================ ADMIN DASHBOARD */
function AdminDashboard({ platforms, operators, logs, onOpen }) {
  const open = logs.filter(l => !l.deboarded_at)
  const maxDays = open.reduce((m, l) => Math.max(m, tripDays(l.boarded_at, null)), 0)

  const perPlatform = platforms.map(p => {
    const oOpen = open.filter(l => l.platform_id === p.id)
    const mx = oOpen.reduce((m, l) => Math.max(m, tripDays(l.boarded_at, null)), 0)
    return { ...p, onboard: oOpen.length, maxDays: mx }
  })

  return (
    <div className="stack">
      <div className="tally">
        <TallyCard label="Platforms" value={platforms.length} tone="teal" />
        <TallyCard label="Operators onboard now" value={open.length} tone="amber" />
        <TallyCard label="Longest current stay" value={maxDays} unit="days" tone="green" />
      </div>

      <div className="section-head">Platform breakdown <span className="muted">— click to open the sheet</span></div>
      <div className="grid-platforms">
        {perPlatform.map(p => (
          <button className="platform-card platform-card--btn" key={p.id} onClick={() => onOpen(p.id)}>
            <div className="platform-card__head">
              <div><div className="platform-code tnum">{p.code}</div>
                <div className="platform-name">{p.name}</div></div>
              <div className="asset-chip">{p.asset || '—'}</div>
            </div>
            <div className="pc-stats">
              <div className="pc-stat"><span className={p.onboard?'big big--on':'big'}>{p.onboard}</span>
                <span className="unit">onboard</span></div>
              <div className="pc-stat"><span className="big big--muted tnum">{p.maxDays}</span>
                <span className="unit">max days</span></div>
            </div>
            <div className="pc-open">Open sheet →</div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ============================================================ MY PLATFORMS (in-charge) */
function MyPlatformsView({ myPlatforms, operators, logs, session, reload }) {
  const [selId, setSelId] = useState(myPlatforms[0]?.id)
  useEffect(() => { if (!selId && myPlatforms[0]) setSelId(myPlatforms[0].id) }, [myPlatforms, selId])
  const platform = myPlatforms.find(p => p.id === selId) || myPlatforms[0]
  return (
    <div className="stack">
      {myPlatforms.length > 1 && (
        <div className="platform-switch">
          {myPlatforms.map(p => (
            <button key={p.id} className={p.id===platform.id?'pill is-active':'pill'}
              onClick={() => setSelId(p.id)}>{p.code}</button>
          ))}
        </div>
      )}
      <PlatformSheet platform={platform} operators={operators} logs={logs}
        session={session} reload={reload} />
    </div>
  )
}

/* ============================================================ PLATFORM SHEET (core) */
function PlatformSheet({ platform, operators, logs, session, reload, onBack }) {
  const [status, setStatus] = useState('all')      // all | onboard | deboarded
  const [range, setRange] = useState('all')        // all | 1m | 3m | custom
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [boarding, setBoarding] = useState(false)  // board modal open

  const opById = useMemo(() => Object.fromEntries(operators.map(o => [o.id, o])), [operators])
  const platLogs = logs.filter(l => l.platform_id === platform.id)
  const openHere = platLogs.filter(l => !l.deboarded_at)

  // stats (current onboard)
  const onboardCount = openHere.length
  const maxDays = openHere.reduce((m, l) => Math.max(m, tripDays(l.boarded_at, null)), 0)
  const avgDays = onboardCount
    ? Math.round(openHere.reduce((s, l) => s + tripDays(l.boarded_at, null), 0) / onboardCount)
    : 0

  // filters
  const now = dOnly(new Date())
  const rangeStart =
    range === '1m' ? new Date(now.getTime() - 30*86400000) :
    range === '3m' ? new Date(now.getTime() - 90*86400000) :
    range === 'custom' && from ? dOnly(from) : null
  const rangeEnd = range === 'custom' && to ? dOnly(to) : null

  const rows = platLogs.filter(l => {
    if (status === 'onboard' && l.deboarded_at) return false
    if (status === 'deboarded' && !l.deboarded_at) return false
    if (rangeStart && dOnly(l.boarded_at) < rangeStart) return false
    if (rangeEnd && dOnly(l.boarded_at) > rangeEnd) return false
    if (q.trim()) {
      const o = opById[l.operator_id]
      const hay = `${o?.full_name || ''} ${o?.emp_code || ''}`.toLowerCase()
      if (!hay.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  const deboard = async (log_id, ymd) => {
    const log = platLogs.find(l => l.id === log_id)
    if (dOnly(ymd) < dOnly(log.boarded_at)) { alert('Deboard date cannot be before the boarding date.'); return }
    const { error } = await supabase.from('boarding_logs')
      .update({ deboarded_at: pickedToISO(ymd), deboarded_by: session.user.id }).eq('id', log_id)
    if (error) alert(error.message); reload()
  }
  const board = async (operator_id, ymd) => {
    const { error } = await supabase.from('boarding_logs').insert({
      operator_id, platform_id: platform.id, boarded_at: pickedToISO(ymd), boarded_by: session.user.id,
    })
    if (error) alert(error.message.includes('one_open_trip') ? 'This operator is already onboard somewhere. Deboard them first.' : error.message)
    setBoarding(false); reload()
  }

  return (
    <div className="stack">
      {onBack && <button className="back-link" onClick={onBack}>← All platforms</button>}

      <div className="sheet-head">
        <div>
          <div className="platform-code tnum">{platform.code}</div>
          <div className="platform-name platform-name--lg">{platform.name}</div>
        </div>
        <button className="btn btn--primary" onClick={() => setBoarding(true)}>+ Board operator</button>
      </div>

      <div className="tally tally--3">
        <TallyCard label="Onboard now" value={onboardCount} tone="amber"
          onClick={() => setStatus('onboard')} active={status==='onboard'} hint="click to filter" />
        <TallyCard label="Max days onboard" value={maxDays} unit="days" tone="teal" />
        <TallyCard label="Avg days onboard" value={avgDays} unit="days" tone="green" />
      </div>

      {/* filters */}
      <div className="filters">
        <div className="seg">
          {['all','onboard','deboarded'].map(s => (
            <button key={s} className={status===s?'seg-btn is-on':'seg-btn'} onClick={() => setStatus(s)}>
              {s==='all'?'All':s==='onboard'?'Onboard':'Deboarded'}</button>
          ))}
        </div>
        <div className="seg">
          {[['all','All time'],['1m','1 month'],['3m','3 months'],['custom','Custom']].map(([v,l]) => (
            <button key={v} className={range===v?'seg-btn is-on':'seg-btn'} onClick={() => setRange(v)}>{l}</button>
          ))}
        </div>
        {range==='custom' && (
          <div className="date-range">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <span>→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        )}
        <input className="search" placeholder="Search operator name / code…"
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {/* table */}
      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr><th>Operator</th><th>Code</th><th>Boarded on</th><th>Deboarded on</th>
              <th className="ta-r">Days</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={7} className="empty pad">No records match these filters.</td></tr>
              : rows.map(l => {
                  const o = opById[l.operator_id]
                  const onboard = !l.deboarded_at
                  return (
                    <tr key={l.id} className={onboard ? 'row-on' : ''}>
                      <td className="op-name">{o?.full_name || '—'}</td>
                      <td className="tnum muted">{o?.emp_code || '—'}</td>
                      <td className="tnum">{fmtDate(l.boarded_at)}</td>
                      <td className="tnum">{fmtDate(l.deboarded_at)}</td>
                      <td className="ta-r tnum days-cell">{tripDays(l.boarded_at, l.deboarded_at)}</td>
                      <td>{onboard
                        ? <span className="status-tag status-tag--on">Onboard</span>
                        : <span className="status-tag">Deboarded</span>}</td>
                      <td className="ta-r">{onboard && <DeboardBtn log={l} onDeboard={deboard} />}</td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      {boarding && <BoardModal platform={platform} operators={operators} logs={logs}
        onClose={() => setBoarding(false)} onBoard={board} />}
    </div>
  )
}

/* deboard with date picker (inline popover) */
function DeboardBtn({ log, onDeboard }) {
  const [open, setOpen] = useState(false)
  const [ymd, setYmd] = useState(todayISO())
  return (
    <span className="deboard-wrap">
      <button className="btn btn--deboard-sm" onClick={() => setOpen(o => !o)}>Deboard</button>
      {open && (
        <div className="popover">
          <div className="pop-label">Deboard date</div>
          <input type="date" value={ymd} min={new Date(log.boarded_at).toLocaleDateString('en-CA',{timeZone:IST})}
            onChange={e => setYmd(e.target.value)} />
          <div className="pop-actions">
            <button className="btn btn--ghost btn--xs" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn--primary btn--xs" onClick={() => { onDeboard(log.id, ymd); setOpen(false) }}>Confirm</button>
          </div>
        </div>
      )}
    </span>
  )
}

/* board modal: choose operator + date */
function BoardModal({ platform, operators, logs, onClose, onBoard }) {
  const onboardAnywhere = new Set(logs.filter(l => !l.deboarded_at).map(l => l.operator_id))
  const available = operators.filter(o => !onboardAnywhere.has(o.id))
  const [opId, setOpId] = useState('')
  const [ymd, setYmd] = useState(todayISO())
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="eyebrow">{platform.code}</div><h3>Board operator</h3></div>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <label className="field"><span>Operator</span>
          <select value={opId} onChange={e => setOpId(e.target.value)}>
            <option value="">Select an operator…</option>
            {available.map(o => <option key={o.id} value={o.id}>{o.full_name} · {o.emp_code}</option>)}
          </select>
        </label>
        {available.length === 0 && <div className="muted small">All operators are onboard somewhere. Add more in the Operators tab.</div>}
        <label className="field"><span>Boarding date</span>
          <input type="date" value={ymd} max={todayISO()} onChange={e => setYmd(e.target.value)} /></label>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={!opId} onClick={() => onBoard(opId, ymd)}>Board</button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================ OPERATORS TAB */
function OperatorsTab({ operators, logs, reload }) {
  const [emp, setEmp] = useState(''), [name, setName] = useState(''), [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const onboardIds = new Set(logs.filter(l => !l.deboarded_at).map(l => l.operator_id))

  const add = async () => {
    setErr('')
    if (!emp.trim() || !name.trim()) { setErr('Employee code and name are required.'); return }
    setBusy(true)
    const { error } = await supabase.from('operators').insert({
      emp_code: emp.trim(), full_name: name.trim(), phone: phone.trim() || null })
    setBusy(false)
    if (error) { setErr(error.message.includes('duplicate') ? 'That employee code already exists.' : error.message); return }
    setEmp(''); setName(''); setPhone(''); reload()
  }
  const shown = operators.filter(o =>
    !q.trim() || `${o.full_name} ${o.emp_code}`.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="stack">
      <div className="col">
        <div className="col-head">Add crane operator</div>
        <div className="add-op__grid">
          <label className="field"><span>Employee code</span>
            <input value={emp} onChange={e => setEmp(e.target.value)} placeholder="ONG-4471" /></label>
          <label className="field"><span>Full name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ramesh Yadav" /></label>
          <label className="field"><span>Phone <em>(optional)</em></span>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key==='Enter'&&add()} placeholder="+91 …" /></label>
          <button className="btn btn--primary add-op__btn" disabled={busy} onClick={add}>
            {busy?'Adding…':'Add operator'}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>

      <div className="col">
        <div className="col-head-row">
          <div className="col-head">Roster · {operators.length}</div>
          <input className="search search--sm" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="ledger">
            <thead><tr><th>Name</th><th>Code</th><th>Phone</th><th>Status</th></tr></thead>
            <tbody>
              {shown.length === 0
                ? <tr><td colSpan={4} className="empty pad">No operators.</td></tr>
                : shown.map(o => (
                    <tr key={o.id}>
                      <td className="op-name">{o.full_name}</td>
                      <td className="tnum muted">{o.emp_code}</td>
                      <td className="muted">{o.phone || '—'}</td>
                      <td>{onboardIds.has(o.id)
                        ? <span className="status-tag status-tag--on">Onboard</span>
                        : <span className="status-tag">Ashore</span>}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ============================================================ SHARED */
function TallyCard({ label, value, unit, tone, onClick, active, hint }) {
  const C = onClick ? 'button' : 'div'
  return (
    <C className={`tally-card tally-card--${tone}${onClick?' tally-card--btn':''}${active?' is-active':''}`}
       onClick={onClick}>
      <div className="tally-value tnum">{value}{unit && <span className="tally-unit">{unit}</span>}</div>
      <div className="tally-label">{label}{hint && onClick && <span className="tally-hint"> · {hint}</span>}</div>
    </C>
  )
}
