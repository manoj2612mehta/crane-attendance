import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase, hasConfig } from './supabaseClient'
import { exportMonthlyGrid } from './exportGrid'
import HelpGuide from './HelpGuide'
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
  const [help, setHelp] = useState(false)
  const submit = async () => {
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) setErr(error.message); setBusy(false)
  }
  return (
    <div className="login-shell"><Brand pos="top" />
      <button className="help-fab" onClick={() => setHelp(true)}>? Help &amp; Guide</button>
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
      {help && <HelpGuide onClose={() => setHelp(false)} loggedIn={false} />}
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
  const [help, setHelp] = useState(false)

  const load = useCallback(async () => {
    const [{ data: p }, { data: o }, { data: l }, { data: inch }] = await Promise.all([
      supabase.from('platforms').select('*').order('code'),
      supabase.from('operators').select('*').eq('active', true).order('full_name'),
      supabase.from('boarding_logs').select('*').order('boarded_at', { ascending: false }),
      supabase.from('platform_incharges').select('platform_id, is_admin, role').eq('user_id', session.user.id),
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
  const roleByPlatform = Object.fromEntries(myInch.map(r => [r.platform_id, r.role || 'view']))

  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />
        <div className="topbar__right"><Brand pos="top" />
          <div className="acct"><span className="whoami">{session.user.email}{isAdmin?' · Admin':''}</span>
            <button className="btn btn--ghost" onClick={() => setHelp(true)}>? Help</button>
            <button className="btn btn--ghost" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
        </div>
      </header>

      <nav className="tabs">
        {isAdmin && <button className={tab==='dashboard'?'tab is-active':'tab'}
          onClick={() => { setTab('dashboard'); setOpenPlatform(null) }}>Dashboard</button>}
        {!isAdmin && <button className={tab==='myplatform'?'tab is-active':'tab'}
          onClick={() => setTab('myplatform')}>My platforms {myPlatforms.length?`· ${myPlatforms.length}`:''}</button>}
        <button className={tab==='verifier'?'tab is-active':'tab'}
          onClick={() => setTab('verifier')}>Rest verifier</button>
        <button className={tab==='personnel'?'tab is-active':'tab'}
          onClick={() => setTab('personnel')}>Crane team {operators.length?`· ${operators.length}`:''}</button>
      </nav>

      <main className="main">
        {loading ? <div className="pulse-dot" /> :
          tab === 'verifier'
            ? <VerifierTab operators={operators} logs={logs} platforms={platforms} />
          : tab === 'personnel'
            ? <PersonnelTab operators={operators} logs={logs} reload={load} isAdmin={isAdmin} platforms={platforms} />
          : tab === 'dashboard' && isAdmin
            ? (openPlatform
                ? <PlatformSheet platform={platforms.find(p=>p.id===openPlatform)} operators={operators}
                    logs={logs} session={session} canExport readOnly reload={load} onBack={() => setOpenPlatform(null)} />
                : <AdminDashboard platforms={platforms} operators={operators} logs={logs} onOpen={setOpenPlatform} />)
          : (myPlatforms.length === 0
              ? <NoAssignment />
              : <MyPlatformsView myPlatforms={myPlatforms} operators={operators} logs={logs}
                  session={session} reload={load} roleByPlatform={roleByPlatform} />)
        }
      </main>

      <footer className="footer"><span>Crane Operator Attendance · ONGC Offshore Operations</span><Brand pos="footer" /></footer>
      {help && <HelpGuide onClose={() => setHelp(false)} loggedIn={true} />}
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
  return { count, max }
}
/* actual on-board count per designation for a set of open logs */
function actualByDesig(openLogs, operators) {
  const opById = Object.fromEntries(operators.map(o => [o.id, o]))
  const a = { CO: 0, CT: 0, SUP: 0 }
  openLogs.forEach(l => { const d = opById[l.operator_id]?.designation; if (a[d] !== undefined) a[d]++ })
  return a
}
/* required/actual/shortage matrix for one platform (or totals) */
function rasFor(platform, openLogs, operators) {
  const a = actualByDesig(openLogs, operators)
  const req = { CO: platform?.required_co||0, CT: platform?.required_ct||0, SUP: platform?.required_sup||0 }
  const short = { CO: Math.max(0, req.CO-a.CO), CT: Math.max(0, req.CT-a.CT), SUP: Math.max(0, req.SUP-a.SUP) }
  const tReq = req.CO+req.CT+req.SUP, tAct = a.CO+a.CT+a.SUP
  return { req, act: a, short, tReq, tAct, tShort: Math.max(0, tReq-tAct) }
}

/* ============================================================ ADMIN DASHBOARD */
function AdminDashboard({ platforms, operators, logs, onOpen }) {
  const open = logs.filter(l => !l.deboarded_at)
  const opById = Object.fromEntries(operators.map(o => [o.id, o]))
  const [platFilter, setPlatFilter] = useState([])   // empty = all
  const togglePlat = (id) => setPlatFilter(f => f.includes(id) ? f.filter(x=>x!==id) : [...f, id])
  const shown = platFilter.length ? platforms.filter(p => platFilter.includes(p.id)) : platforms

  // fleet totals across SHOWN platforms
  const shownIds = new Set(shown.map(p=>p.id))
  const openShown = open.filter(l => shownIds.has(l.platform_id))
  const totReq = shown.reduce((s,p)=>s+(p.required_co||0)+(p.required_ct||0)+(p.required_sup||0),0)
  const totAct = openShown.length
  const totShort = Math.max(0, totReq-totAct)
  const maxDays = openShown.reduce((m,l)=>Math.max(m,tripDays(l.boarded_at,null)),0)
  const overstays = openShown.filter(l=>tripDays(l.boarded_at,null)>28).length

  return (
    <div className="stack">
      <div className="tally tally--4">
        <TallyCard label="Required (contract)" value={totReq} tone="teal" />
        <TallyCard label="Actual on board" value={totAct} tone="green" />
        <TallyCard label="Shortage" value={totShort} tone={totShort>0?'red':'green'} />
        <TallyCard label="Max days on board" value={maxDays} unit="days" tone={maxDays>28?'red':'amber'}
          hint={overstays>0?`${overstays} over 28d`:undefined} />
      </div>

      {/* platform filter */}
      <div className="plat-filter">
        <button className={platFilter.length===0?'pill is-active':'pill'} onClick={()=>setPlatFilter([])}>All · {platforms.length}</button>
        {platforms.map(p => (
          <button key={p.id} className={platFilter.includes(p.id)?'pill is-active':'pill'}
            onClick={()=>togglePlat(p.id)}>{p.code}</button>
        ))}
      </div>

      <div className="section-head">Platform breakdown <span className="muted">— click a card to open its sheet</span></div>
      <div className="grid-platforms">
        {shown.map(p => {
          const oOpen = open.filter(l => l.platform_id === p.id)
          const ras = rasFor(p, oOpen, operators)
          const mx = oOpen.reduce((m,l)=>Math.max(m,tripDays(l.boarded_at,null)),0)
          const over = oOpen.some(l=>tripDays(l.boarded_at,null)>28)
          return (
            <button className={`platform-card platform-card--btn${ras.tShort>0?' platform-card--short':''}`}
              key={p.id} onClick={() => onOpen(p.id)}>
              <div className="platform-card__head">
                <div><div className="platform-code tnum">{p.code}</div><div className="platform-name">{p.name}</div></div>
                {ras.tShort>0
                  ? <div className="short-chip">−{ras.tShort} short</div>
                  : <div className="ok-chip">Full</div>}
              </div>
              <div className="ras-mini tnum">
                <div className="ras-mini__col"><span className="rm-n">{ras.tReq}</span><span className="rm-l">Required</span></div>
                <div className="ras-mini__col"><span className="rm-n rm-n--act">{ras.tAct}</span><span className="rm-l">Actual</span></div>
                <div className="ras-mini__col"><span className={ras.tShort>0?'rm-n rm-n--short':'rm-n rm-n--ok'}>{ras.tShort}</span><span className="rm-l">Shortage</span></div>
              </div>
              <div className="pc-team-row">
                <span className="pc-pill pc-pill--amber">CO {ras.act.CO}/{ras.req.CO}</span>
                <span className="pc-pill pc-pill--teal">CT {ras.act.CT}/{ras.req.CT}</span>
                <span className="pc-pill pc-pill--teal">SUP {ras.act.SUP}/{ras.req.SUP}</span>
                <span className={over?'pc-pill pc-pill--red':'pc-pill pc-pill--muted'}>max {mx}d</span>
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
function MyPlatformsView({ myPlatforms, operators, logs, session, reload, roleByPlatform }) {
  const [selId, setSelId] = useState(myPlatforms[0]?.id)
  useEffect(() => { if (!selId && myPlatforms[0]) setSelId(myPlatforms[0].id) }, [myPlatforms, selId])
  const platform = myPlatforms.find(p => p.id === selId) || myPlatforms[0]
  const isView = (roleByPlatform[platform.id] || 'view') !== 'icm'
  return (
    <div className="stack">
      {myPlatforms.length > 1 && (
        <div className="platform-switch">
          {myPlatforms.map(p => (
            <button key={p.id} className={p.id===platform.id?'pill is-active':'pill'} onClick={() => setSelId(p.id)}>
              {p.code}{(roleByPlatform[p.id]||'view')!=='icm' ? ' · view' : ''}</button>
          ))}
        </div>
      )}
      <PlatformSheet platform={platform} operators={operators} logs={logs} session={session}
        canExport readOnly={isView} reload={reload} />
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
  const [dnfOnly, setDnfOnly] = useState(false)
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
    if (dnfOnly && !o?.is_dnf) return false
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
  const doBoardDNF = async ({ name, ned, desig }, ymd) => {
    // create a DNF operator, then board them
    const { data, error } = await supabase.from('operators').insert({
      full_name: name.trim(), ned_pass_no: ned.trim(), designation: desig || 'CO', is_dnf: true })
      .select().single()
    if (error) {
      alert(error.message.toLowerCase().includes('ned') ? 'A person with this NED pass already exists in the master. Board them from the list instead.' : error.message)
      return
    }
    const { error: e2 } = await supabase.from('boarding_logs').insert({
      operator_id: data.id, platform_id: platform.id, boarded_at: pickedToISO(ymd), boarded_by: session.user.id })
    if (e2) alert(e2.message)
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

      {/* required / actual / shortage */}
      <RasBar ras={rasFor(platform, openHere, operators)} />

      {/* team stat blocks */}
      <div className="team-grid">
        <TeamBlock title="Crane Operator" tone="amber" s={opStats}
          onClick={() => { setDesigF('CO'); setStatus('onboard') }} />
        <TeamBlock title="Crane Maintenance" tone="teal" s={mtStats}
          onClick={() => { setDesigF('all'); setStatus('onboard') }} sub="CT + Supervisor" />
      </div>

      {/* filters */}
      <div className="filters">
        <div className="seg">
          {['all','onboard','deboarded'].map(s => (
            <button key={s} className={status===s?'seg-btn is-on':'seg-btn'} onClick={()=>setStatus(s)}>
              {s==='all'?'All':s==='onboard'?'On Board':'Deboarded'}</button>))}
        </div>
        <div className="seg">
          {[['all','All roles'],['CO','CO'],['CT','CT'],['SUP','SUP']].map(([v,l]) => (
            <button key={v} className={desigF===v?'seg-btn is-on':'seg-btn'} onClick={()=>setDesigF(v)}>{l}</button>))}
        </div>
        <button className={dnfOnly?'seg-btn seg-btn--dnf is-on':'seg-btn seg-btn--dnf'} onClick={()=>setDnfOnly(v=>!v)}>DNF only</button>
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
                  const days = tripDays(l.boarded_at, l.deboarded_at)
                  const overstay = onboard && days > 28
                  return (
                    <tr key={l.id} className={overstay ? 'row-over' : (onboard?'row-on':'')}>
                      <td><span className="op-name">{o?.full_name||'—'}</span>
                        {o?.is_dnf && <span className="dnf-badge">DNF</span>}
                        <span className="op-sub tnum muted">{o?.emp_code||''}</span></td>
                      <td><span className={`desig desig--${o?.designation}`}>{o?.designation||'—'}</span></td>
                      <td className="tnum muted">{o?.ned_pass_no||'—'}</td>
                      <td className="tnum">{fmtDate(l.boarded_at)}</td>
                      <td className="tnum">{fmtDate(l.deboarded_at)}</td>
                      <td className="ta-r tnum days-cell">{days}{overstay && <span className="over-flag">!</span>}</td>
                      <td>{onboard?<span className="status-tag status-tag--on">On Board</span>:<span className="status-tag">Deboarded</span>}</td>
                      <td className="ta-r">{onboard && !readOnly && <button className="btn btn--deboard-sm" onClick={() => setDeboardLog(l)}>Deboard</button>}</td>
                    </tr>)
                })}
          </tbody>
        </table>
      </div>

      {boarding && <BoardModal platform={platform} operators={operators} logs={logs}
        onClose={() => setBoarding(false)} onBoard={doBoard} onBoardDNF={doBoardDNF} />}
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
      <div className="team-stats team-stats--2">
        <button className="team-stat team-stat--btn" onClick={onClick}>
          <span className="ts-val tnum">{s.count}</span><span className="ts-lbl">on board now</span></button>
        <div className="team-stat"><span className={s.max>28?'ts-val tnum ts-val--red':'ts-val tnum'}>{s.max}</span>
          <span className="ts-lbl">max days{s.max>28?' · over 28!':''}</span></div>
      </div>
    </div>
  )
}

/* Required / Actual / Shortage bar for a platform */
function RasBar({ ras }) {
  const Cell = ({ d }) => (
    <div className="ras-cell">
      <div className="ras-cell__d">{d}</div>
      <div className="ras-cell__nums tnum">
        <span title="Required">{ras.req[d]}</span>
        <span className="ras-sep">/</span>
        <span className="ras-act" title="Actual">{ras.act[d]}</span>
        <span className="ras-sep">/</span>
        <span className={ras.short[d]>0?'ras-short':'ras-ok'} title="Shortage">{ras.short[d]}</span>
      </div>
    </div>
  )
  return (
    <div className={`ras-bar${ras.tShort>0?' ras-bar--short':''}`}>
      <div className="ras-bar__head">
        <span className="ras-bar__title">Manpower · Required / Actual / Shortage</span>
        {ras.tShort>0
          ? <span className="short-chip">−{ras.tShort} short overall</span>
          : <span className="ok-chip">Fully manned</span>}
      </div>
      <div className="ras-bar__grid">
        <Cell d="CO" /><Cell d="CT" /><Cell d="SUP" />
        <div className="ras-cell ras-cell--total">
          <div className="ras-cell__d">Total</div>
          <div className="ras-cell__nums tnum">
            <span>{ras.tReq}</span><span className="ras-sep">/</span>
            <span className="ras-act">{ras.tAct}</span><span className="ras-sep">/</span>
            <span className={ras.tShort>0?'ras-short':'ras-ok'}>{ras.tShort}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Board modal (with filters + DNF fallback) ---------- */
function BoardModal({ platform, operators, logs, onClose, onBoard, onBoardDNF }) {
  const onboardAnywhere = new Set(logs.filter(l => !l.deboarded_at).map(l => l.operator_id))
  const [mode, setMode] = useState('list')          // 'list' | 'dnf'
  const [desigF, setDesigF] = useState('all')
  const [q, setQ] = useState('')
  const [opId, setOpId] = useState('')
  const [ymd, setYmd] = useState(todayISO())
  const [dnfName, setDnfName] = useState(''), [dnfNed, setDnfNed] = useState(''), [dnfDesig, setDnfDesig] = useState('')

  const available = operators.filter(o => !onboardAnywhere.has(o.id))
    .filter(o => desigF==='all' || o.designation===desigF)
    .filter(o => !q.trim() || `${o.full_name} ${o.emp_code||''} ${o.ned_pass_no||''}`.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><div className="eyebrow">{platform.code}</div><h3>Board personnel</h3></div>
          <button className="x" onClick={onClose}>×</button></div>

        <div className="seg board-mode">
          <button className={mode==='list'?'seg-btn is-on':'seg-btn'} onClick={()=>setMode('list')}>From master list</button>
          <button className={mode==='dnf'?'seg-btn is-on':'seg-btn'} onClick={()=>setMode('dnf')}>Details not found (DNF)</button>
        </div>

        {mode==='list' ? <>
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
                    <span className="op-name">{o.full_name}{o.is_dnf && <span className="dnf-badge">DNF</span>}</span>
                    <span className="op-sub muted tnum">{o.emp_code||'—'}{o.ned_pass_no?` · NED ${o.ned_pass_no}`:''}</span>
                    {opId===o.id && <span className="tick">✓</span>}
                  </button>))}
          </div>
        </> : <>
          <div className="dnf-note">Person not in the master list. Enter rough details — admin will review and approve later.</div>
          <div className="two-fields">
            <label className="field"><span>Name</span>
              <input value={dnfName} onChange={e=>setDnfName(e.target.value)} placeholder="Rough name" /></label>
            <label className="field"><span>NED pass no</span>
              <input value={dnfNed} onChange={e=>setDnfNed(e.target.value)} placeholder="NED number" /></label>
          </div>
          <label className="field"><span>Designation</span>
            <select value={dnfDesig} onChange={e=>setDnfDesig(e.target.value)}>
              <option value="">Select…</option>
              {DESIGS.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label}</option>)}</select></label>
        </>}

        <label className="field field--inline"><span>Boarding date</span>
          <input type="date" value={ymd} max={todayISO()} onChange={e=>setYmd(e.target.value)} /></label>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          {mode==='list'
            ? <button className="btn btn--primary" disabled={!opId} onClick={()=>onBoard(opId, ymd)}>Board</button>
            : <button className="btn btn--primary" disabled={!dnfName.trim()||!dnfNed.trim()||!dnfDesig}
                onClick={()=>onBoardDNF({ name: dnfName, ned: dnfNed, desig: dnfDesig }, ymd)}>Board as DNF</button>}
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
        <p className="muted small">Day-wise grid (✓ present) for Crane Operator and Crane Maintenance, with total days per person.</p>
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
function PersonnelTab({ operators, logs, reload, isAdmin, platforms }) {
  const [emp, setEmp] = useState(''), [name, setName] = useState('')
  const [desig, setDesig] = useState(''), [ned, setNed] = useState(''), [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [q, setQ] = useState(''), [teamF, setTeamF] = useState('all')
  const [importMsg, setImportMsg] = useState('')
  const [editDnf, setEditDnf] = useState(null)
  const onboardIds = new Set(logs.filter(l => !l.deboarded_at).map(l => l.operator_id))
  const pById = Object.fromEntries((platforms||[]).map(p => [p.id, p]))

  const dnfPeople = operators.filter(o => o.is_dnf)

  const add = async () => {
    setErr('')
    if (!name.trim() || !desig || !ned.trim()) { setErr('Name, designation and NED pass are required.'); return }
    setBusy(true)
    const { error } = await supabase.from('operators').insert({
      emp_code: emp.trim() || null, full_name: name.trim(), designation: desig,
      ned_pass_no: ned.trim(), phone: phone.trim() || null, is_dnf: false })
    setBusy(false)
    if (error) {
      const m = error.message.toLowerCase()
      setErr(m.includes('ned') ? 'This NED pass number already exists.'
        : (m.includes('emp_code') || (m.includes('duplicate') && m.includes('emp'))) ? 'This employee code already exists.'
        : m.includes('duplicate') ? 'This person already exists.'
        : m.includes('row-level') || m.includes('policy') ? 'Only admins can add master personnel.' : error.message)
      return
    }
    setEmp(''); setName(''); setDesig(''); setNed(''); setPhone(''); reload()
  }

  const onImport = async (e) => {
    setImportMsg('')
    const file = e.target.files?.[0]; if (!file) return
    try {
      const { parseImportFile } = await import('./exportGrid')
      const { valid, errors } = await parseImportFile(file)
      if (valid.length === 0) { setImportMsg(`No valid rows. ${errors.slice(0,3).join('; ')}`); e.target.value=''; return }
      const { error } = await supabase.from('operators').insert(valid)
      if (error) {
        setImportMsg(error.message.toLowerCase().includes('duplicate')
          ? 'Some NED numbers already exist. Remove duplicates and re-import.' : error.message)
      } else {
        setImportMsg(`Imported ${valid.length} personnel.${errors.length?` Skipped ${errors.length}: ${errors.slice(0,3).join('; ')}`:''}`)
        reload()
      }
    } catch (ex) { setImportMsg('Could not read the file. Use the sample template format.') }
    e.target.value = ''
  }

  const downloadTemplate = async () => {
    const { downloadImportTemplate } = await import('./exportGrid')
    downloadImportTemplate()
  }

  const shown = operators
    .filter(o => teamF==='all' || teamOf(o.designation)===teamF)
    .filter(o => !q.trim() || `${o.full_name} ${o.emp_code||''} ${o.ned_pass_no||''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const co  = shown.filter(o => o.designation==='CO')
  const main = shown.filter(o => o.designation==='CT' || o.designation==='SUP')

  const Rows = ({ items }) => items.map(o => (
    <tr key={o.id}>
      <td className="op-name">{o.full_name}{o.is_dnf && <span className="dnf-badge">DNF</span>}</td>
      <td><span className={`desig desig--${o.designation}`}>{o.designation}</span></td>
      <td className="tnum muted">{o.emp_code||'—'}</td>
      <td className="tnum muted">{o.ned_pass_no||'—'}</td>
      <td className="muted">{o.phone||'—'}</td>
      <td>{onboardIds.has(o.id)?<span className="status-tag status-tag--on">On Board</span>:<span className="status-tag">Deboarded</span>}</td>
    </tr>
  ))

  return (
    <div className="stack">
      {/* DNF review — admin only */}
      {isAdmin && dnfPeople.length > 0 && (
        <div className="col col--flag">
          <div className="col-head col-head--flag">DNF review · {dnfPeople.length} pending approval</div>
          <p className="muted small" style={{marginTop:'-8px',marginBottom:'14px'}}>
            These were boarded by ICM without master details. Review, complete the details, and approve to move them into the master roster.</p>
          <div className="table-wrap"><table className="ledger">
            <thead><tr><th>Name</th><th>Desig</th><th>NED</th><th>Platform</th><th>Status</th><th></th></tr></thead>
            <tbody>{dnfPeople.map(o => {
              const openLog = logs.find(l => l.operator_id === o.id && !l.deboarded_at)
              const lastLog = logs.filter(l => l.operator_id === o.id)
                .sort((a,b)=>new Date(b.boarded_at)-new Date(a.boarded_at))[0]
              const refLog = openLog || lastLog
              const platCode = refLog ? (pById[refLog.platform_id]?.code || '—') : '—'
              return (
                <tr key={o.id}>
                  <td className="op-name">{o.full_name}<span className="dnf-badge">DNF</span></td>
                  <td><span className={`desig desig--${o.designation}`}>{o.designation}</span></td>
                  <td className="tnum muted">{o.ned_pass_no}</td>
                  <td className="tnum">{platCode}</td>
                  <td className="muted">{openLog?'Currently onboard':'Deboarded'}</td>
                  <td className="ta-r"><button className="btn btn--primary btn--xs" onClick={()=>setEditDnf(o)}>Review &amp; approve</button></td>
                </tr>)
            })}</tbody>
          </table></div>
        </div>
      )}

      {/* Add + import — admin only */}
      {isAdmin ? (
        <div className="col">
          <div className="col-head-row">
            <div className="col-head">Add crane team personnel</div>
            <div className="import-tools">
              <button className="btn btn--ghost btn--xs" onClick={downloadTemplate}>⭳ Sample template</button>
              <label className="btn btn--primary btn--xs import-btn">⭱ Import Excel
                <input type="file" accept=".xlsx,.xls,.csv" onChange={onImport} hidden /></label>
            </div>
          </div>
          {importMsg && <div className="import-msg">{importMsg}</div>}
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
          <p className="muted small">Personnel are shared across all platforms — the same crew rotates between them.</p>
        </div>
      ) : (
        <div className="col"><p className="muted small" style={{margin:0}}>
          Only admins can add or import master personnel. ICM can add unknown persons as DNF during boarding.</p></div>
      )}

      {/* Roster */}
      <div className="col">
        <div className="col-head-row">
          <div className="col-head">Roster · {operators.length}</div>
          <div className="roster-tools">
            <div className="seg">
              {[['all','All'],['operation','Operator'],['maintenance','Maintenance']].map(([v,l]) => (
                <button key={v} className={teamF===v?'seg-btn is-on':'seg-btn'} onClick={()=>setTeamF(v)}>{l}</button>))}
            </div>
            <input className="search search--sm" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
        </div>
        {(teamF==='all'||teamF==='operation') && (<>
          <div className="team-band">Crane Operator</div>
          <div className="table-wrap"><table className="ledger">
            <thead><tr><th>Name</th><th>Desig</th><th>Code</th><th>NED</th><th>Phone</th><th>Status</th></tr></thead>
            <tbody>{co.length?<Rows items={co} />:<tr><td colSpan={6} className="empty pad">No operators.</td></tr>}</tbody>
          </table></div></>)}
        {(teamF==='all'||teamF==='maintenance') && (<>
          <div className="team-band team-band--teal">Crane Maintenance</div>
          <div className="table-wrap"><table className="ledger">
            <thead><tr><th>Name</th><th>Desig</th><th>Code</th><th>NED</th><th>Phone</th><th>Status</th></tr></thead>
            <tbody>{main.length?<Rows items={main} />:<tr><td colSpan={6} className="empty pad">No maintenance personnel.</td></tr>}</tbody>
          </table></div></>)}
      </div>

      {editDnf && <DnfApproveModal op={editDnf} onClose={()=>setEditDnf(null)} reload={reload} />}
    </div>
  )
}

/* ---------- DNF approve modal (admin) ---------- */
function DnfApproveModal({ op, onClose, reload }) {
  const [name, setName] = useState(op.full_name || '')
  const [ned, setNed] = useState(op.ned_pass_no || '')
  const [desig, setDesig] = useState(op.designation || 'CO')
  const [emp, setEmp] = useState(op.emp_code || ''), [phone, setPhone] = useState(op.phone || '')
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')

  const approve = async () => {
    setErr('')
    if (!name.trim() || !ned.trim()) { setErr('Name and NED are required.'); return }
    setBusy(true)
    const { error } = await supabase.from('operators').update({
      full_name: name.trim(), ned_pass_no: ned.trim(), designation: desig,
      emp_code: emp.trim() || null, phone: phone.trim() || null, is_dnf: false }).eq('id', op.id)
    setBusy(false)
    if (error) { setErr(error.message.toLowerCase().includes('ned') ? 'This NED already exists on another person.' : error.message); return }
    onClose(); reload()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><div className="eyebrow">DNF review</div><h3>Approve into master</h3></div>
          <button className="x" onClick={onClose}>×</button></div>
        <div className="two-fields">
          <label className="field"><span>Full name</span><input value={name} onChange={e=>setName(e.target.value)} /></label>
          <label className="field"><span>NED pass</span><input value={ned} onChange={e=>setNed(e.target.value)} /></label>
        </div>
        <div className="two-fields">
          <label className="field"><span>Designation</span>
            <select value={desig} onChange={e=>setDesig(e.target.value)}>
              {DESIGS.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label}</option>)}</select></label>
          <label className="field"><span>Emp code <em>(optional)</em></span><input value={emp} onChange={e=>setEmp(e.target.value)} /></label>
        </div>
        <label className="field"><span>Phone <em>(optional)</em></span><input value={phone} onChange={e=>setPhone(e.target.value)} /></label>
        {err && <div className="err">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy} onClick={approve}>{busy?'Approving…':'Approve'}</button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================ VERIFIER (rest-period check) */
const MIN_REST_DAYS = 28
function VerifierTab({ operators, logs, platforms }) {
  const [q, setQ] = useState('')
  const [histFor, setHistFor] = useState(null)   // operator id with history expanded
  const pById = Object.fromEntries(platforms.map(p => [p.id, p]))

  const results = operators
    .filter(o => q.trim() && `${o.full_name} ${o.ned_pass_no||''} ${o.emp_code||''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 12)
    .map(o => {
      const opLogs = logs.filter(l => l.operator_id === o.id)
        .sort((a,b) => new Date(b.boarded_at) - new Date(a.boarded_at))
      const onboardNow = opLogs.find(l => !l.deboarded_at)
      const closed = opLogs.filter(l => l.deboarded_at)
        .sort((a,b) => new Date(b.deboarded_at) - new Date(a.deboarded_at))[0]
      let state, daysSince = null
      if (onboardNow) state = 'onboard'
      else if (!closed) state = 'never'
      else {
        daysSince = Math.round((dOnly(new Date()) - dOnly(closed.deboarded_at)) / 86400000)
        state = daysSince >= MIN_REST_DAYS ? 'eligible' : 'resting'
      }
      return { o, state, daysSince, onboardNow, closed, opLogs }
    })

  return (
    <div className="stack">
      <div className="col">
        <div className="col-head">Reboarding eligibility check</div>
        <p className="muted small" style={{marginTop:'-8px', marginBottom:'14px'}}>
          Minimum {MIN_REST_DAYS} days rest required after deboarding before a person can be reboarded.
          Search by name or NED pass number.</p>
        <input className="search" autoFocus placeholder="Search name or NED pass number…"
          value={q} onChange={e=>{setQ(e.target.value); setHistFor(null)}} />
      </div>

      {q.trim() && (
        <div className="col">
          {results.length === 0
            ? <div className="empty pad">No personnel match “{q}”.</div>
            : <div className="verify-list">
                {results.map(({ o, state, daysSince, onboardNow, closed, opLogs }) => (
                  <div key={o.id} className={`verify-card verify-card--${state} verify-card--stack`}>
                    <div className="verify-row">
                      <div className="verify-main">
                        <div className="verify-name">{o.full_name}
                          <span className={`desig desig--${o.designation}`}>{o.designation}</span>
                          {o.is_dnf && <span className="dnf-badge">DNF</span>}</div>
                        <div className="op-sub muted tnum">NED {o.ned_pass_no}{o.emp_code?` · ${o.emp_code}`:''}</div>
                      </div>
                      <div className="verify-body">
                        {state==='onboard' && <>
                          <div className="verify-badge vb-onboard">On board · {tripDays(onboardNow.boarded_at,null)} days</div>
                          <div className="verify-note">On <b>{pById[onboardNow.platform_id]?.code}</b> since {fmtDate(onboardNow.boarded_at)}.</div></>}
                        {state==='never' && <>
                          <div className="verify-badge vb-neutral">No prior trip</div>
                          <div className="verify-note">No boarding record. Eligible to board.</div></>}
                        {state==='eligible' && <>
                          <div className="verify-badge vb-eligible">Eligible · {daysSince} days rested</div>
                          <div className="verify-note">Deboarded <b>{pById[closed.platform_id]?.code}</b> on {fmtDate(closed.deboarded_at)} · shift was {tripDays(closed.boarded_at, closed.deboarded_at)} days.</div></>}
                        {state==='resting' && <>
                          <div className="verify-badge vb-resting">Not yet · {daysSince} / {MIN_REST_DAYS} days</div>
                          <div className="verify-note">Deboarded <b>{pById[closed.platform_id]?.code}</b> on {fmtDate(closed.deboarded_at)} · shift was {tripDays(closed.boarded_at, closed.deboarded_at)} days · {MIN_REST_DAYS - daysSince} more days needed.</div></>}
                      </div>
                    </div>

                    {opLogs.length > 0 && (
                      <button className="hist-toggle" onClick={()=>setHistFor(histFor===o.id?null:o.id)}>
                        {histFor===o.id ? 'Hide history ▴' : `History · ${opLogs.length} trip${opLogs.length>1?'s':''} ▾`}
                      </button>
                    )}
                    {histFor===o.id && (
                      <div className="hist-table">
                        <table className="ledger ledger--compact">
                          <thead><tr><th>Platform</th><th>Boarded</th><th>Deboarded</th><th className="ta-r">Days</th></tr></thead>
                          <tbody>
                            {opLogs.map(l => (
                              <tr key={l.id} className={!l.deboarded_at?'row-on':''}>
                                <td className="tnum">{pById[l.platform_id]?.code||'—'}</td>
                                <td className="tnum">{fmtDate(l.boarded_at)}</td>
                                <td className="tnum">{l.deboarded_at?fmtDate(l.deboarded_at):'On board'}</td>
                                <td className="ta-r tnum days-cell">{tripDays(l.boarded_at,l.deboarded_at)}</td>
                              </tr>))}
                            <tr className="hist-total">
                              <td colSpan={3}>Total days across all trips</td>
                              <td className="ta-r tnum days-cell">{opLogs.reduce((s,l)=>s+tripDays(l.boarded_at,l.deboarded_at),0)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>}
        </div>
      )}
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
