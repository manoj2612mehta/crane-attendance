import * as XLSX from 'xlsx'

const IST = 'Asia/Kolkata'
const dOnly = (d) => new Date(new Date(d).toLocaleDateString('en-CA', { timeZone: IST }))
const DESIG_LABEL = { CO: 'Crane Operation', CT: 'Crane Maintenance', SUP: 'Crane Maintenance' }

/* Was this operator onboard on a given calendar day (any stint)? */
function presentOn(dayDate, logs) {
  return logs.some(l => {
    const b = dOnly(l.boarded_at)
    const e = l.deboarded_at ? dOnly(l.deboarded_at) : dOnly(new Date())
    // present board..deboard-1 (boarding day counted, deboard day not) — for onboard, up to today
    return dayDate >= b && dayDate < e || (dayDate.getTime() === b.getTime())
  })
}

/*
  Build a monthly attendance grid for ONE platform.
  Rows grouped: Crane Operation (CO) then Crane Maintenance (CT, SUP).
  Columns: day 1..N, then Total.
  present = tick, absent = blank/cross.
*/
export function exportMonthlyGrid({ platform, operators, logs, year, month /* 0-based */ }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month, 1).toLocaleString('en-US', { month: 'long' })
  const platLogs = logs.filter(l => l.platform_id === platform.id)
  const opById = Object.fromEntries(operators.map(o => [o.id, o]))

  // which operators appear at least one day this month on this platform
  const rowsByGroup = { 'Crane Operation': [], 'Crane Maintenance': [] }
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month, daysInMonth)

  // gather operators active this month
  const activeOps = new Map() // opId -> logs for this platform overlapping month
  platLogs.forEach(l => {
    const b = dOnly(l.boarded_at)
    const e = l.deboarded_at ? dOnly(l.deboarded_at) : dOnly(new Date())
    if (b <= monthEnd && e >= monthStart) {
      if (!activeOps.has(l.operator_id)) activeOps.set(l.operator_id, [])
      activeOps.get(l.operator_id).push(l)
    }
  })

  const aoa = []
  // title rows
  aoa.push([`${platform.name} (${platform.code}) — Attendance ${monthName} ${year}`])
  aoa.push([]) // spacer

  const header = ['Team', 'Personnel', 'Emp Code', 'Desig', 'NED Pass']
  for (let d = 1; d <= daysInMonth; d++) header.push(String(d))
  header.push('Total days')
  aoa.push(header)

  const order = ['CO', 'CT', 'SUP']
  const grouped = { CO: [], CT: [], SUP: [] }
  for (const [opId, opLogs] of activeOps.entries()) {
    const o = opById[opId]; if (!o) continue
    grouped[o.designation || 'CO'].push({ o, opLogs })
  }

  const pushGroup = (label, keys) => {
    const items = keys.flatMap(k => grouped[k]).sort((a, b) => a.o.full_name.localeCompare(b.o.full_name))
    if (items.length === 0) return
    aoa.push([label]) // section band
    items.forEach(({ o, opLogs }) => {
      const row = [DESIG_LABEL[o.designation] || '', o.full_name, o.emp_code, o.designation, o.ned_pass_no || '']
      let total = 0
      for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(year, month, d)
        const present = presentOn(day, opLogs)
        if (present) total++
        row.push(present ? '✓' : '')
      }
      row.push(total)
      aoa.push(row)
    })
  }

  pushGroup('CRANE OPERATION', ['CO'])
  pushGroup('CRANE MAINTENANCE', ['CT', 'SUP'])

  if (activeOps.size === 0) aoa.push(['No attendance recorded for this month.'])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  // column widths
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 7 }, { wch: 12 },
    ...Array(daysInMonth).fill({ wch: 3.2 }), { wch: 11 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${year}`.slice(0, 31))
  const fname = `${platform.code}_attendance_${monthName}_${year}.xlsx`
  XLSX.writeFile(wb, fname)
}
