import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase, hasConfig } from './supabaseClient'
import { exportMonthlyGrid } from './exportGrid'
import './app.css'

/* ============================================================ DATE HELPERS */
const IST = 'Asia/Kolkata'
const dOnly = (d) => new Date(new Date(d).toLocaleDateString('en-CA', { timeZone: IST }))
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: IST })
function tripDays(boarded_at, deboarded_at) {
  const b = dOnly(boarded_at)
  if (!deboarded_at) return Math.round((dOnly(new Date()) - b) / 86400000) + 1
  return Math.max(0, Math.round((dOnly(deboarded_at) - b) / 86400000))
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST })
}
const pickedToISO = (ymd) => new Date(`${ymd}T12:00:00+05:30`).toISOString()

/* teams / designations */
const DESIGS = [
  { code: 'CO',  label: 'Crane Operator',   team: 'operation' },
  { code: 'CT',  label: 'Crane Technician',  team: 'maintenance' },
  { code: 'SUP', label: 'Supervisor',        team: 'maintenance' },
]
const teamOf = (desig) => (desig === 'CO' ? 'operation' : 'maintenance')
const desigLabel = (c) => DESIGS.find(d => d.code === c)?.label || c

const Brand = ({ pos }) => (
  <div className={`brand brand--${pos}`}>Design &amp; Created by <span>Manoj Mehta</span></div>
)
const Logo = () => (
  <div className="brandmark">
    <img src="/ongc-logo.png" alt="ONGC" className="ongc-logo" />
    <div className="brandmark__txt">
      <div className="topbar__title">Crane Attendance Ledger</div>
      <div className="topbar__sub">ONGC Offshore</div>
    </div>
  </div>
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
  return <ShellApp session={session} />
}

function ConfigNeeded() {
  return <div className="center-screen"><div className="card notice">
    <div className="eyebrow">Setup required</div><h2>Connect Supabase</h2>
    <p>Add your keys to <code>.env</code>, then restart the dev server.</p>
  </div><Brand pos="bottom" /></div>
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
    <div className="login-shell"><Brand pos="top" />
      <div className="login-grid">
        <div className="login-hero"><div className="beacon" />
          <img src="/ongc-logo.png" alt="ONGC" className="ongc-logo ongc-logo--hero" />
          <div className="eyebrow eyebrow--light">Offshore Operations</div>
          <h1>Crane Attendance<br/>Ledger</h1>
          <p>Track crane operation and maintenance teams across platforms — boarding, days onboard, and monthly attendance.</p>
        </div>
        <div className="login-card"><h2>Sign in</h2><p className="muted">In-charge and admin access.</p>
          <label className="field"><span>Email</span>
            <input type="email" value={email} autoComplete="username"
              onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="you@ongc.co.in" /></label>
          <label className="field"><span>Password</span>
            <input type="password" value={pass} autoComplete="current-password"
              onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="password" /></label>
          {err && <div className="err">{err}</div>}
          <button className="btn btn--primary btn--full" disabled={busy} onClick={submit}>{busy?'Signing in…':'Sign in'}</button>
        </div>
      </div><Brand pos="bottom" />
    </div>
  )
}

/* ============================================================ SHELL */
function ShellApp({ session }) {
  const [platforms, setPlatforms] = useState([])
  const [operators, setOperators] = useState([])
  const [logs, setLogs] = useState([])
  const [myInch, setMyInch] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(null)
  const [openPlatform, setOpenPlatform] = useState(null)

  const load = useCallback(async () => {
    const [{ data: p }, { data: o }, { data: l }, { data: inch }] = await Promise.all([
      supabase.from('platforms').select('*').order('code'),
      supabase.from('operators').select('*').eq('active', true).order('full_name'),
      supabase.from('boarding_logs').select('*').order('boarded_at', { ascending: false }),
      supabase.from('platform_incharges').select('platform_id, is_admin').eq('user_id', session.user.id),
    ])
    setPlatforms(p||[]); setOperators(o||[]); setLogs(l||[]); setMyInch(inch||[])
    setIsAdmin((inch||[]).some(r => r.is_admin)); setLoading(false)
  }, [session.user.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'boarding_logs' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])
  useEffect(() => { if (!loading && !tab) setTab(isAdmin ? 'dashboard' : 'myplatform') }, [loading, isAdmin, tab])

  const myPlatformIds = myInch.map(r => r.platform_id)
  const myPlatforms = platforms.filter(p => myPlatformIds.includes(p.id))

  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />
        <div className="topbar__right"><Brand pos="top" />
          <div className="acct"><span className="whoami">{session.user.email}{isAdmin?' · Admin':''}</span>
            <button className="btn btn--ghost" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
        </div>
      </header>

      <nav className="tabs">
        {isAdmin && <button className={tab==='dashboard'?'tab is-active':'tab'}
          onClick={() => { setTab('dashboard'); setOpenPlatform(null) }}>Dashboard</button>}
        {!isAdmin && <button className={tab==='myplatform'?'tab is-active':'tab'}
          onClick={() => setTab('myplatform')}>My platforms {myPlatforms.length?`· ${myPlatforms.length}`:''}</button>}
        <button className={tab==='personnel'?'tab is-active':'tab'}
          onClick={() => setTab('personnel')}>Crane team {operators.length?`· ${operators.length}`:''}</button>
      </nav>

      <main className="main">
        {loading ? <div className="pulse-dot" /> :
          tab === 'personnel'
            ? <PersonnelTab operators={operators} logs={logs} reload={load} />
          : tab === 'dashboard' && isAdmin
            ? (openPlatform
                ? <PlatformSheet platform={platforms.find(p=>p.id===openPlatform)} operators={operators}
                    logs={logs} session={session} canExport readOnly reload={load} onBack={() => setOpenPlatform(null)} />
                : <AdminDashboard platforms={platforms} operators={operators} logs={logs} onOpen={setOpenPlatform} />)
          : (myPlatforms.length === 0
              ? <NoAssignment />
              : <MyPlatformsView myPlatforms={myPlatforms} operators={operators} logs={logs} session={session} reload={load} />)
        }
      </main>

      <footer className="footer"><span>Crane Operator Attendance · ONGC Offshore Operations</span><Brand pos="footer" /></footer>
    </div>
  )
}

function NoAssignment() {
  return <div className="card notice"><div className="eyebrow">No assignment</div>
    <h2>You don’t manage any platform yet</h2>
    <p className="muted">Ask the administrator to assign you a platform.</p></div>
}

/* ============================================================ TEAM STAT BLOCK */
function teamStats(openLogs, operators, team) {
  const opById = Object.fromEntries(operators.map(o => [o.id, o]))
  const items = openLogs.filter(l => teamOf(opById[l.operator_id]?.designation) === team)
  const count = items.length
  const max = items.reduce((m,l)=>Math.max(m, tripDays(l.boarded_at,null)),0)
  const avg = count ? Math.round(items.reduce((s,l)=>s+tripDays(l.boarded_at,null),0)/count) : 0
  return { count, max, avg }
}

/* ============================================================ ADMIN DASHBOARD */
function AdminDashboard({ platforms, operators, logs, onOpen }) {
  const open = logs.filter(l => !l.deboarded_at)
  const opById = Object.fromEntries(operators.map(o => [o.id, o]))
  const opStats = teamStats(open, operators, 'operation')
  const mtStats = teamStats(open, operators, 'maintenance')

  return (
    <div className="stack">
      <div className="tally tally--4">
        <TallyCard label="Platforms" value={platforms.length} tone="teal" />
        <TallyCard label="Total onboard" value={open.length} tone="amber" />
        <TallyCard label="Crane Operation onboard" value={opStats.count} unit="" tone="amber" />
        <TallyCard label="Crane Maintenance onboard" value={mtStats.count} unit="" tone="green" />
      </div>

      <div className="team-grid">
        <TeamBlock title="Crane Operation" tone="amber" s={opStats} onClick={() => {}} />
        <TeamBlock title="Crane Maintenance" tone="teal" s={mtStats} onClick={() => {}} sub="CT + Supervisor" />
      </div>

      <div className="section-head">Platform breakdown <span className="muted">— click to open the sheet</span></div>
      <div className="grid-platforms">
        {platforms.map(p => {
          const oOpen = open.filter(l => l.platform_id === p.id)
          const co = oOpen.filter(l => teamOf(opById[l.operator_id]?.designation)==='operation').length
          const mt = oOpen.filter(l => teamOf(opById[l.operator_id]?.designation)==='maintenance').length
          const mx = oOpen.reduce((m,l)=>Math.max(m,tripDays(l.boarded_at,null)),0)
          return (
            <button className="platform-card platform-card--btn" key={p.id} onClick={() => onOpen(p.id)}>
              <div className="platform-card__head">
                <div><div className="platform-code tnum">{p.code}</div><div className="platform-name">{p.name}</div></div>
                <div className="asset-chip">{p.asset || '—'}</div></div>
              <div className="pc-team-row">
                <span className="pc-pill pc-pill--amber">CO {co}</span>
                <span className="pc-pill pc-pill--teal">Maint {mt}</span>
                <span className="pc-pill pc-pill--muted">max {mx}d</span>
              </div>
              <div className="pc-open">Open sheet →</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================ MY PLATFORMS */
function MyPlatformsView({ myPlatforms, operators, logs, session, reload }) {
  const [selId, setSelId] = useState(myPlatforms[0]?.id)
  useEffect(() => { if (!selId && myPlatforms[0]) setSelId(myPlatforms[0].id) }, [myPlatforms, selId])
  const platform = myPlatforms.find(p => p.id === selId) || myPlatforms[0]
  return (
    <div className="stack">
      {myPlatforms.length > 1 && (
        <div className="platform-switch">
          {myPlatforms.map(p => (
            <button key={p.id} className={p.id===platform.id?'pill is-active':'pill'} onClick={() => setSelId(p.id)}>{p.code}</button>
          ))}
        </div>
      )}
      <PlatformSheet platform={platform} operators={operators} logs={logs} session={session} canExport reload={reload} />
    </div>
  )
}

/* ============================================================ PLATFORM SHEET */
function PlatformSheet({ platform, operators, logs, session, reload, onBack, canExport, readOnly }) {
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [desigF, setDesigF] = useState('all')       // filter by CO/CT/SUP in the table
  const [boarding, setBoarding] = useState(false)
  const [deboardLog, setDeboardLog] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const opById = useMemo(() => Object.fromEntries(operators.map(o => [o.id, o])), [operators])
  const platLogs = logs.filter(l => l.platform_id === platform.id)
  const openHere = platLogs.filter(l => !l.deboarded_at)

  const opStats = teamStats(openHere, operators, 'operation')
  const mtStats = teamStats(openHere, operators, 'maintenance')

  const now = dOnly(new Date())
  const rangeStart = range==='1m'?new Date(now.getTime()-30*86400000)
    : range==='3m'?new Date(now.getTime()-90*86400000)
    : range==='custom'&&from?dOnly(from):null
  const rangeEnd = range==='custom'&&to?dOnly(to):null

  const rows = platLogs.filter(l => {
    const o = opById[l.operator_id]
    if (status==='onboard' && l.deboarded_at) return false
    if (status==='deboarded' && !l.deboarded_at) return false
    if (desigF!=='all' && o?.designation!==desigF) return false
    if (rangeStart && dOnly(l.boarded_at) < rangeStart) return false
    if (rangeEnd && dOnly(l.boarded_at) > rangeEnd) return false
    if (q.trim()) {
      const hay = `${o?.full_name||''} ${o?.emp_code||''} ${o?.ned_pass_no||''}`.toLowerCase()
      if (!hay.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  const doDeboard = async (log_id, ymd) => {
    const log = platLogs.find(l => l.id === log_id)
    if (dOnly(ymd) < dOnly(log.boarded_at)) { alert('Deboard date cannot be before the boarding date.'); return }
    const { error } = await supabase.from('boarding_logs')
      .update({ deboarded_at: pickedToISO(ymd), deboarded_by: session.user.id }).eq('id', log_id)
    if (error) alert(error.message)
    setDeboardLog(null); reload()
  }
  const doBoard = async (operator_id, ymd) => {
    const { error } = await supabase.from('boarding_logs').insert({
      operator_id, platform_id: platform.id, boarded_at: pickedToISO(ymd), boarded_by: session.user.id })
    if (error) alert(error.message.includes('one_open_trip') ? 'This person is already onboard somewhere. Deboard them first.' : error.message)
    setBoarding(false); reload()
  }

  return (
    <div className="stack">
      {onBack && <button className="back-link" onClick={onBack}>← All platforms</button>}

      <div className="sheet-head">
        <div><div className="platform-code tnum">{platform.code}</div>
          <div className="platform-name platform-name--lg">{platform.name}</div></div>
        <div className="sheet-actions">
          {canExport && <button className="btn btn--ghost" onClick={() => setExportOpen(true)}>⭳ Monthly Excel</button>}
          {!readOnly && <button className="btn btn--primary" onClick={() => setBoarding(true)}>+ Board</button>}
        </div>
      </div>

      {/* team stat blocks */}
      <div className="team-grid">
        <TeamBlock title="Crane Operation" tone="amber" s={opStats}
          onClick={() => { setDesigF('CO'); setStatus('onboard') }} />
        <TeamBlock title="Crane Maintenance" tone="teal" s={mtStats}
          onClick={() => { setDesigF('all'); setStatus('onboard') }} sub="CT + Supervisor" />
      </div>

      {/* filters */}
      <div className="filters">
        <div className="seg">
          {['all','onboard','deboarded'].map(s => (
            <button key={s} className={status===s?'seg-btn is-on':'seg-btn'} onClick={()=>setStatus(s)}>
              {s==='all'?'All':s==='onboard'?'Present':'Absent'}</button>))}
        </div>
        <div className="seg">
          {[['all','All roles'],['CO','CO'],['CT','CT'],['SUP','SUP']].map(([v,l]) => (
            <button key={v} className={desigF===v?'seg-btn is-on':'seg-btn'} onClick={()=>setDesigF(v)}>{l}</button>))}
        </div>
        <div className="seg">
          {[['all','All time'],['1m','1 month'],['3m','3 months'],['custom','Custom']].map(([v,l]) => (
            <button key={v} className={range===v?'seg-btn is-on':'seg-btn'} onClick={()=>setRange(v)}>{l}</button>))}
        </div>
        {range==='custom' && <div className="date-range">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /><span>→</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>}
        <input className="search" placeholder="Search name / code / NED…" value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      {/* table */}
      <div className="table-wrap">
        <table className="ledger">
          <thead><tr><th>Personnel</th><th>Desig</th><th>NED</th><th>Boarded on</th><th>Deboarded on</th>
            <th className="ta-r">Days</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length===0
              ? <tr><td colSpan={8} className="empty pad">No records match these filters.</td></tr>
              : rows.map(l => {
                  const o = opById[l.operator_id]; const onboard = !l.deboarded_at
                  return (
                    <tr key={l.id} className={onboard?'row-on':''}>
                      <td><span className="op-name">{o?.full_name||'—'}</span>
                        <span className="op-sub tnum muted">{o?.emp_code}</span></td>
                      <td><span className={`desig desig--${o?.designation}`}>{o?.designation||'—'}</span></td>
                      <td className="tnum muted">{o?.ned_pass_no||'—'}</td>
                      <td className="tnum">{fmtDate(l.boarded_at)}</td>
                      <td className="tnum">{fmtDate(l.deboarded_at)}</td>
                      <td className="ta-r tnum days-cell">{tripDays(l.boarded_at,l.deboarded_at)}</td>
                      <td>{onboard?<span className="status-tag status-tag--on">Present</span>:<span className="status-tag">Absent</span>}</td>
                      <td className="ta-r">{onboard && !readOnly && <button className="btn btn--deboard-sm" onClick={() => setDeboardLog(l)}>Deboard</button>}</td>
                    </tr>)
                })}
          </tbody>
        </table>
      </div>

      {boarding && <BoardModal platform={platform} operators={operators} logs={logs}
        onClose={() => setBoarding(false)} onBoard={doBoard} />}
      {deboardLog && <DeboardModal log={deboardLog} operator={opById[deboardLog.operator_id]}
        onClose={() => setDeboardLog(null)} onConfirm={doDeboard} />}
      {exportOpen && <ExportModal platform={platform} operators={operators} logs={logs}
        onClose={() => setExportOpen(false)} />}
    </div>
  )
}

function TeamBlock({ title, tone, s, onClick, sub }) {
  return (
    <div className={`team-block team-block--${tone}`}>
      <div className="team-head">{title}{sub && <span className="team-sub">{sub}</span>}</div>
      <div className="team-stats">
        <button className="team-stat team-stat--btn" onClick={onClick}>
          <span className="ts-val tnum">{s.count}</span><span className="ts-lbl">onboard now</span></button>
        <div className="team-stat"><span className="ts-val tnum">{s.max}</span><span className="ts-lbl">max days</span></div>
        <div className="team-stat"><span className="ts-val tnum">{s.avg}</span><span className="ts-lbl">avg days</span></div>
      </div>
    </div>
  )
}

/* ---------- Board modal (with filters) ---------- */
function BoardModal({ platform, operators, logs, onClose, onBoard }) {
  const onboardAnywhere = new Set(logs.filter(l => !l.deboarded_at).map(l => l.operator_id))
  const [desigF, setDesigF] = useState('all')
  const [q, setQ] = useState('')
  const [opId, setOpId] = useState('')
  const [ymd, setYmd] = useState(todayISO())

  const available = operators.filter(o => !onboardAnywhere.has(o.id))
    .filter(o => desigF==='all' || o.designation===desigF)
    .filter(o => !q.trim() || `${o.full_name} ${o.emp_code} ${o.ned_pass_no||''}`.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><div className="eyebrow">{platform.code}</div><h3>Board personnel</h3></div>
          <button className="x" onClick={onClose}>×</button></div>

        <div className="board-filters">
          <div className="seg">
            {[['all','All'],['CO','CO'],['CT','CT'],['SUP','SUP']].map(([v,l]) => (
              <button key={v} className={desigF===v?'seg-btn is-on':'seg-btn'} onClick={()=>setDesigF(v)}>{l}</button>))}
          </div>
          <input className="search" placeholder="Search name / code / NED…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>

        <div className="board-list">
          {available.length===0
            ? <div className="empty pad">No available personnel match this filter.</div>
            : available.map(o => (
                <button key={o.id} className={opId===o.id?'board-row is-sel':'board-row'} onClick={()=>setOpId(o.id)}>
                  <span className={`desig desig--${o.designation}`}>{o.designation}</span>
                  <span className="op-name">{o.full_name}</span>
                  <span className="op-sub muted tnum">{o.emp_code}{o.ned_pass_no?` · NED ${o.ned_pass_no}`:''}</span>
                  {opId===o.id && <span className="tick">✓</span>}
                </button>))}
        </div>

        <label className="field field--inline"><span>Boarding date</span>
          <input type="date" value={ymd} max={todayISO()} onChange={e=>setYmd(e.target.value)} /></label>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={!opId} onClick={()=>onBoard(opId, ymd)}>Board</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Deboard modal (fixes clipped popover) ---------- */
function DeboardModal({ log, operator, onClose, onConfirm }) {
  const minDate = new Date(log.boarded_at).toLocaleDateString('en-CA',{timeZone:IST})
  const [ymd, setYmd] = useState(todayISO())
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><div className="eyebrow">Deboard</div>
          <h3>{operator?.full_name || 'Operator'}</h3></div><button className="x" onClick={onClose}>×</button></div>
        <p className="muted small">Boarded on {fmtDate(log.boarded_at)}. Choose the deboard date.</p>
        <label className="field"><span>Deboard date</span>
          <input type="date" value={ymd} min={minDate} max={todayISO()} onChange={e=>setYmd(e.target.value)} /></label>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={()=>onConfirm(log.id, ymd)}>Confirm deboard</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Export modal (pick month) ---------- */
function ExportModal({ platform, operators, logs, onClose }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const years = [now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2]
  const run = () => { exportMonthlyGrid({ platform, operators, logs, year, month }); onClose() }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><div className="eyebrow">{platform.code}</div><h3>Download monthly attendance</h3></div>
          <button className="x" onClick={onClose}>×</button></div>
        <p className="muted small">Day-wise grid (✓ present) for Crane Operation and Crane Maintenance, with total days per person.</p>
        <div className="two-fields">
          <label className="field"><span>Month</span>
            <select value={month} onChange={e=>setMonth(+e.target.value)}>
              {months.map((m,i)=><option key={i} value={i}>{m}</option>)}</select></label>
          <label className="field"><span>Year</span>
            <select value={year} onChange={e=>setYear(+e.target.value)}>
              {years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
        </div>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={run}>Download .xlsx</button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================ PERSONNEL TAB */
function PersonnelTab({ operators, logs, reload }) {
  const [emp, setEmp] = useState(''), [name, setName] = useState('')
  const [desig, setDesig] = useState(''), [ned, setNed] = useState(''), [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [q, setQ] = useState(''), [teamF, setTeamF] = useState('all')
  const onboardIds = new Set(logs.filter(l => !l.deboarded_at).map(l => l.operator_id))

  const add = async () => {
    setErr('')
    if (!name.trim() || !desig || !ned.trim()) { setErr('Name, designation and NED pass are required.'); return }
    setBusy(true)
    const { error } = await supabase.from('operators').insert({
      emp_code: emp.trim() || null, full_name: name.trim(), designation: desig,
      ned_pass_no: ned.trim(), phone: phone.trim() || null })
    setBusy(false)
    if (error) {
      const m = error.message.toLowerCase()
      setErr(m.includes('ned') ? 'This NED pass number already exists.'
        : (m.includes('emp_code') || (m.includes('duplicate') && m.includes('emp'))) ? 'This employee code already exists.'
        : m.includes('duplicate') ? 'This person already exists.' : error.message)
      return
    }
    setEmp(''); setName(''); setDesig(''); setNed(''); setPhone(''); reload()
  }

  const shown = operators
    .filter(o => teamF==='all' || teamOf(o.designation)===teamF)
    .filter(o => !q.trim() || `${o.full_name} ${o.emp_code} ${o.ned_pass_no||''}`.toLowerCase().includes(q.trim().toLowerCase()))

  const co  = shown.filter(o => o.designation==='CO')
  const main = shown.filter(o => o.designation==='CT' || o.designation==='SUP')

  const Rows = ({ items }) => items.map(o => (
    <tr key={o.id}>
      <td className="op-name">{o.full_name}</td>
      <td><span className={`desig desig--${o.designation}`}>{o.designation}</span></td>
      <td className="tnum muted">{o.emp_code}</td>
      <td className="tnum muted">{o.ned_pass_no||'—'}</td>
      <td className="muted">{o.phone||'—'}</td>
      <td>{onboardIds.has(o.id)?<span className="status-tag status-tag--on">Present</span>:<span className="status-tag">Absent</span>}</td>
    </tr>
  ))

  return (
    <div className="stack">
      <div className="col">
        <div className="col-head">Add crane team personnel</div>
        <div className="add-op__grid add-op__grid--5">
          <label className="field"><span>Emp code <em>(optional)</em></span>
            <input value={emp} onChange={e=>setEmp(e.target.value)} placeholder="ONG-4471" /></label>
          <label className="field"><span>Full name</span>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ramesh Yadav" /></label>
          <label className="field"><span>Designation</span>
            <select value={desig} onChange={e=>setDesig(e.target.value)}>
              <option value="">Select…</option>
              {DESIGS.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label}</option>)}</select></label>
          <label className="field"><span>NED pass</span>
            <input value={ned} onChange={e=>setNed(e.target.value)} placeholder="NED-0093" /></label>
          <label className="field"><span>Phone <em>(optional)</em></span>
            <input value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="+91 …" /></label>
        </div>
        <div className="add-row">
          {err && <div className="err">{err}</div>}
          <button className="btn btn--primary" disabled={busy} onClick={add}>{busy?'Adding…':'Add personnel'}</button>
        </div>
        <p className="muted small">Personnel added here are shared across all platforms — the same crew rotates between them.</p>
      </div>

      <div className="col">
        <div className="col-head-row">
          <div className="col-head">Roster · {operators.length}</div>
          <div className="roster-tools">
            <div className="seg">
              {[['all','All'],['operation','Operation'],['maintenance','Maintenance']].map(([v,l]) => (
                <button key={v} className={teamF===v?'seg-btn is-on':'seg-btn'} onClick={()=>setTeamF(v)}>{l}</button>))}
            </div>
            <input className="search search--sm" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
        </div>

        {(teamF==='all'||teamF==='operation') && (
          <>
            <div className="team-band">Crane Operation</div>
            <div className="table-wrap"><table className="ledger">
              <thead><tr><th>Name</th><th>Desig</th><th>Code</th><th>NED</th><th>Phone</th><th>Status</th></tr></thead>
              <tbody>{co.length?<Rows items={co} />:<tr><td colSpan={6} className="empty pad">No operators.</td></tr>}</tbody>
            </table></div>
          </>
        )}
        {(teamF==='all'||teamF==='maintenance') && (
          <>
            <div className="team-band team-band--teal">Crane Maintenance</div>
            <div className="table-wrap"><table className="ledger">
              <thead><tr><th>Name</th><th>Desig</th><th>Code</th><th>NED</th><th>Phone</th><th>Status</th></tr></thead>
              <tbody>{main.length?<Rows items={main} />:<tr><td colSpan={6} className="empty pad">No maintenance personnel.</td></tr>}</tbody>
            </table></div>
          </>
        )}
      </div>
    </div>
  )
}

/* ============================================================ SHARED */
function TallyCard({ label, value, unit, tone, onClick, active, hint, hidden }) {
  if (hidden) return null
  const C = onClick ? 'button' : 'div'
  return (
    <C className={`tally-card tally-card--${tone}${onClick?' tally-card--btn':''}${active?' is-active':''}`} onClick={onClick}>
      <div className="tally-value tnum">{value}{unit && <span className="tally-unit">{unit}</span>}</div>
      <div className="tally-label">{label}{hint && onClick && <span className="tally-hint"> · {hint}</span>}</div>
    </C>
  )
}
