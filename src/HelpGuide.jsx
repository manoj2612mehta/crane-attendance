import { useState } from 'react'

/* ============================================================
   HELP & GUIDE  — interactive, role-based
   Accessible before and after login.
   ============================================================ */

const ROLES = [
  {
    key: 'pc', label: 'Project_Coordinator', tone: 'teal',
    tag: 'Full oversight',
    line: 'Sees everything, manages the master crew — but does not board or deboard.',
    can: [
      'View the fleet-wide Dashboard: every platform, both teams, live counts',
      'Open any platform sheet and download its monthly Excel',
      'Add crane team personnel — manually or by bulk Excel import',
      'Review and approve DNF (Details Not Found) entries into the master roster',
      'Check reboarding eligibility in the Manifest Checker',
    ],
    cannot: ['Board or deboard personnel — that is the ICM’s job'],
    flow: [
      { t: 'Sign in', d: 'Log in with your coordinator email.' },
      { t: 'Open Dashboard', d: 'See all platforms with live On Board counts for both teams.' },
      { t: 'Drill into a platform', d: 'Click any platform card to open its full attendance sheet.' },
      { t: 'Manage the crew', d: 'In Crane team, add people or import an Excel sheet of them.' },
      { t: 'Clear DNF backlog', d: 'Approve any DNF entries so they join the master roster.' },
      { t: 'Export', d: 'Download the month’s day-wise attendance grid for records.' },
    ],
  },
  {
    key: 'icm', label: 'Platform_ICM', tone: 'amber',
    tag: 'In-charge, Maintenance',
    line: 'Runs the day-to-day for their platform — the only role that boards and deboards.',
    can: [
      'Board a person from the master list (filter by role, name, or NED)',
      'Board an unknown person as DNF when they’re not in the master list',
      'Deboard a person and set the exact deboard date',
      'View their platform’s live counts, history, and download monthly Excel',
      'Use the Manifest Checker before reboarding anyone',
    ],
    cannot: ['Add or import master personnel', 'Approve DNF entries', 'See other platforms'],
    flow: [
      { t: 'Sign in', d: 'Log in with your platform ICM email.' },
      { t: 'Open My platform', d: 'Land straight on your platform’s sheet.' },
      { t: 'Check rest first', d: 'Use the Manifest Checker — is the person 28-day eligible?' },
      { t: 'Board', d: 'Tap + Board → pick from master, or DNF if not listed → set date.' },
      { t: 'Watch overstays', d: 'Rows onboard over 28 days turn red — plan the rotation.' },
      { t: 'Deboard', d: 'When they leave, tap Deboard and set the departure date.' },
    ],
  },
  {
    key: 'view', label: 'Platform_View', tone: 'green',
    tag: 'Read-only',
    line: 'Watches a platform’s attendance without changing anything.',
    can: [
      'View their platform’s live On Board count and full history',
      'Filter and search the attendance table',
      'Download the monthly Excel for their platform',
      'Use the Manifest Checker',
    ],
    cannot: ['Board or deboard', 'Add personnel', 'Approve DNF'],
    flow: [
      { t: 'Sign in', d: 'Log in with your platform view email.' },
      { t: 'Open My platform', d: 'See the live sheet — who’s on board and for how long.' },
      { t: 'Filter & search', d: 'Narrow by status, role, date range, or name.' },
      { t: 'Export', d: 'Download the monthly attendance grid when you need it.' },
    ],
  },
]

const CONCEPTS = [
  { icon: '⚓', title: 'Board & Deboard', body: 'Boarding logs an arrival; deboarding logs a departure. Days onboard are counted automatically from the two dates.' },
  { icon: '❓', title: 'DNF — Details Not Found', body: 'If a person isn’t in the master list, the ICM can still board them with a rough name, NED and designation. The coordinator reviews and approves them later.' },
  { icon: '🔁', title: '28-day rest rule', body: 'Rest required equals the last shift length before a person can be reboarded. The Manifest Checker checks this instantly by name or NED, and flags any safety remarks.' },
  { icon: '📊', title: 'Monthly Excel', body: 'A day-wise grid (✓ on board / ✗ off) for both teams, with total days per person — one sheet per platform, per month.' },
]

export default function HelpGuide({ onClose, loggedIn }) {
  const [role, setRole] = useState(null)
  const active = ROLES.find(r => r.key === role)

  return (
    <div className="help-overlay">
      <div className="help-shell">
        <button className="help-close" onClick={onClose} aria-label="Close">×</button>

        <header className="help-hero">
          <div className="help-badge">Guide</div>
          <h1>How the Crane Attendance Ledger works</h1>
          <p>{loggedIn
            ? 'A quick map of what you can do. Pick your role to see your exact flow.'
            : 'Sign in with the account your coordinator gave you. Here’s what each role does.'}</p>
        </header>

        {/* WHAT IT IS */}
        <section className="help-section">
          <div className="help-eyebrow">The idea</div>
          <p className="help-lead">
            This is a shared ledger for crane crews across offshore platforms. Instead of daily
            punch-in, each person is <b>boarded</b> when they arrive and <b>deboarded</b> when they
            leave — the system counts the days in between and keeps a live picture of who is where.
          </p>
        </section>

        {/* ROLE PICKER */}
        <section className="help-section">
          <div className="help-eyebrow">Choose your role</div>
          <div className="role-pick">
            {ROLES.map(r => (
              <button key={r.key}
                className={`role-chip role-chip--${r.tone}${role===r.key?' is-on':''}`}
                onClick={() => setRole(role===r.key ? null : r.key)}>
                <span className="role-chip__label">{r.label}</span>
                <span className="role-chip__tag">{r.tag}</span>
              </button>
            ))}
          </div>

          {!active && <div className="role-hint">↑ Tap a role to reveal its step-by-step flow.</div>}

          {active && (
            <div className={`role-panel role-panel--${active.tone}`}>
              <div className="role-panel__head">
                <h2>{active.label}</h2>
                <p>{active.line}</p>
              </div>

              <div className="flow">
                {active.flow.map((s, i) => (
                  <div className="flow-step" key={i}>
                    <div className="flow-node">{i+1}</div>
                    <div className="flow-body">
                      <div className="flow-t">{s.t}</div>
                      <div className="flow-d">{s.d}</div>
                    </div>
                    {i < active.flow.length-1 && <div className="flow-line" />}
                  </div>
                ))}
              </div>

              <div className="cando">
                <div className="cando-col cando-col--yes">
                  <div className="cando-head">Can do</div>
                  <ul>{active.can.map((c,i)=><li key={i}>{c}</li>)}</ul>
                </div>
                <div className="cando-col cando-col--no">
                  <div className="cando-head">Cannot do</div>
                  <ul>{active.cannot.map((c,i)=><li key={i}>{c}</li>)}</ul>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* KEY CONCEPTS */}
        <section className="help-section">
          <div className="help-eyebrow">Key ideas at a glance</div>
          <div className="concept-grid">
            {CONCEPTS.map((c,i) => (
              <div className="concept-card" key={i}>
                <div className="concept-icon">{c.icon}</div>
                <div className="concept-title">{c.title}</div>
                <div className="concept-body">{c.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* STATUS LEGEND */}
        <section className="help-section">
          <div className="help-eyebrow">Reading the board</div>
          <div className="legend">
            <span className="legend-item"><span className="status-tag status-tag--on">On Board</span> currently on the platform</span>
            <span className="legend-item"><span className="status-tag">Deboarded</span> has left</span>
            <span className="legend-item"><span className="dnf-badge">DNF</span> boarded without master details, awaiting approval</span>
            <span className="legend-item"><span className="legend-red">Red row</span> onboard over 28 days — plan rotation</span>
          </div>
        </section>

        {/* SUPPORT */}
        <section className="help-support">
          <div className="help-eyebrow help-eyebrow--light">Help &amp; support</div>
          <h2>Stuck, or something looks off?</h2>
          <p>For anything about this system — access, data, a bug, or a new feature — reach out directly.</p>
          <div className="support-card">
            <div className="support-name">Manoj Mehta</div>
            <div className="support-lines">
              <a href="tel:+918828318767">+91 88283 18767</a>
              <a href="mailto:mehta_manoj@ongc.co.in">mehta_manoj@ongc.co.in</a>
            </div>
          </div>
        </section>

        <div className="help-foot">Design &amp; Created by <span>Manoj Mehta</span></div>
      </div>
    </div>
  )
}
