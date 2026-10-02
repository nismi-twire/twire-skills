#!/usr/bin/env bun
// Hubstaff helper: hours summaries and time off on top of the official `hubstaff` CLI.
// The CLI owns auth (PAT refresh) and the default organization; this script only
// shells out to `hubstaff -j ...` and does the date maths and summing.
// Runs under bun or node: `bun hs.js <command>`.

const { execFileSync } = require('node:child_process')

const DAY_SECONDS = 8 * 3600
const MAX_RANGE_DAYS = 31 // activities/daily rejects longer ranges

// ---------- CLI plumbing ----------

function hs(args) {
  try {
    const out = execFileSync('hubstaff', ['-j', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return out.trim() ? JSON.parse(out) : {}
  } catch (err) {
    if (err.code === 'ENOENT') die('hubstaff CLI not found. Install: brew install netsoftholdings/tap/hubstaff')
    const msg = (err.stderr || err.message || '').toString().trim()
    const e = new Error(`hubstaff ${args.join(' ')}\n${msg}`)
    e.exitCode = err.status === 2 ? 2 : 1 // 2 = auth error, re-run set-pat
    throw e
  }
}

// Follows page_start_id cursors until the API stops returning one.
function listAll(args, key) {
  const items = []
  let cursor
  for (;;) {
    const page = hs([...args, '--page_limit', '500', ...(cursor ? ['--page_start_id', String(cursor)] : [])])
    items.push(...(page[key] || []))
    cursor = page.pagination && (page.pagination.next_page_start_id || page.pagination.page_start_id)
    if (!cursor) return { items, page }
  }
}

function die(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`)
  process.exit(code)
}

function parseArgs(argv) {
  const pos = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      pos.push(a)
      continue
    }
    const [k, inline] = a.slice(2).split(/=(.*)/s)
    if (inline !== undefined) flags[k] = inline
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[k] = argv[++i]
    else flags[k] = true
  }
  return { pos, flags }
}

let meCache
function me() {
  if (!meCache) meCache = hs(['users', 'me']).user
  return meCache
}

// ---------- dates (local calendar dates, YYYY-MM-DD) ----------

const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) die(`bad date "${s}", expected YYYY-MM-DD`)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6
const weekday = (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Human labels for markdown output: "30 Sep", "Wed 30 Sep", "1 to 4 Sep (Tue to Fri)".
const dm = (s) => {
  const d = parse(s)
  return `${d.getDate()} ${MON[d.getMonth()]}`
}
const dayLabel = (s) => `${weekday(parse(s))} ${dm(s)}`
const joinAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// "a to b" for two YYYY-MM-DD dates; year added when `withYear`.
function spanText(from, to, withYear) {
  const a = parse(from)
  const b = parse(to)
  const y = withYear ? ` ${b.getFullYear()}` : ''
  if (from === to) return `${dayLabel(from)}${y}`
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const yA = withYear && a.getFullYear() !== b.getFullYear() ? ` ${a.getFullYear()}` : ''
  return `${sameMonth ? a.getDate() : `${dm(from)}${yA}`} to ${dm(to)}${y}`
}

// A Mon-Sun week prints as "7 to 13 Sep"; a clipped one adds its weekdays.
function weekSpan(from, to) {
  if (from === to) return dayLabel(from)
  const full = parse(from).getDay() === 1 && parse(to).getDay() === 0
  return full ? spanText(from, to) : `${spanText(from, to)} (${weekday(parse(from))} to ${weekday(parse(to))})`
}

// "19, 20 and 26 Sep" / "31 Jul and 30 Sep" / "30 Sep; 1 and 2 Oct"; long lists collapse to a count.
function dateList(dates, max = 10) {
  if (dates.length > max) return `${dates.length} days`
  const groups = []
  for (const s of dates) {
    const d = parse(s)
    const k = `${d.getFullYear()}-${d.getMonth()}`
    let g = groups[groups.length - 1]
    if (!g || g.k !== k) groups.push((g = { k, mon: MON[d.getMonth()], days: [] }))
    g.days.push(d.getDate())
  }
  const parts = groups.map((g) => `${joinAnd(g.days.map(String))} ${g.mon}`)
  return groups.every((g) => g.days.length === 1) ? joinAnd(parts) : parts.join('; ')
}

function eachDate(from, to) {
  const out = []
  for (let d = parse(from); d <= parse(to); d = addDays(d, 1)) out.push(d)
  return out
}

// Weeks start on Monday. Returns [start, end of data, natural end of the period];
// the natural end is later than today for the current week/month/year.
function periodRange(period) {
  const today = new Date()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const monday = addDays(t, -((t.getDay() + 6) % 7))
  switch (period) {
    case 'today':
      return [t, t, t]
    case 'yesterday':
      return [addDays(t, -1), addDays(t, -1), addDays(t, -1)]
    case 'week':
      return [monday, t, addDays(monday, 6)]
    case 'last-week':
      return [addDays(monday, -7), addDays(monday, -1), addDays(monday, -1)]
    case 'month':
      return [new Date(t.getFullYear(), t.getMonth(), 1), t, new Date(t.getFullYear(), t.getMonth() + 1, 0)]
    case 'last-month': {
      const end = new Date(t.getFullYear(), t.getMonth(), 0)
      return [new Date(t.getFullYear(), t.getMonth() - 1, 1), end, end]
    }
    case 'year':
      return [new Date(t.getFullYear(), 0, 1), t, new Date(t.getFullYear(), 11, 31)]
    default:
      die(`unknown period "${period}" (today|yesterday|week|last-week|month|last-month|year, or --from/--to)`)
  }
}

const hm = (s) => {
  const mins = Math.round(s / 60)
  return `${Math.floor(mins / 60)}h ${pad(mins % 60)}m`
}
const hmShort = (s) => hm(s).replace(' 00m', '')
const pct = (part, whole) => (whole ? `${Math.round((100 * part) / whole)}%` : '-')

// ---------- hours ----------

const projectNames = {}
function projectName(id) {
  if (!(id in projectNames)) {
    try {
      projectNames[id] = hs(['projects', 'get', String(id)]).project.name
    } catch {
      projectNames[id] = `project ${id}`
    }
  }
  return projectNames[id]
}

const PERIOD_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  'last-week': 'Last week',
  month: 'This month',
  'last-month': 'Last month',
  year: 'This year',
}

function cmdHours(pos, flags) {
  const todayStr = fmt(new Date())
  let from, to, periodEnd, label
  if (flags.from) {
    from = flags.from
    to = flags.to || todayStr
    if (to > todayStr) die('--to is in the future; tracked time only exists up to today')
    periodEnd = to
    label = 'Hours'
  } else {
    const period = pos[0] || 'week'
    ;[from, to, periodEnd] = periodRange(period).map(fmt)
    label = PERIOD_LABELS[period]
  }
  const userId = flags.user || me().id
  const dayHours = flags['day-hours'] ? Number(flags['day-hours']) : DAY_SECONDS / 3600
  const daySeconds = Math.round(dayHours * 3600)

  // Tracked time, split into <=31 day chunks for the API.
  const rows = []
  for (let start = parse(from); start <= parse(to); start = addDays(start, MAX_RANGE_DAYS)) {
    const end = addDays(start, MAX_RANGE_DAYS - 1) < parse(to) ? addDays(start, MAX_RANGE_DAYS - 1) : parse(to)
    rows.push(
      ...listAll(
        ['activities', 'daily', '--date[start]', fmt(start), '--date[stop]', fmt(end), '--user_ids', String(userId)],
        'daily_activities',
      ).items,
    )
  }
  const byDay = {}
  const byProject = {}
  const total = { tracked: 0, overall: 0, manual: 0, idle: 0 }
  for (const r of rows) {
    const d = (byDay[r.date] ||= { tracked: 0, overall: 0 })
    d.tracked += r.tracked
    d.overall += r.overall
    byProject[r.project_id] = (byProject[r.project_id] || 0) + r.tracked
    total.tracked += r.tracked
    total.overall += r.overall
    total.manual += r.manual || 0
    total.idle += r.idle || 0
  }

  // Calendar for the whole period (to its natural end, so future leave/holidays count).
  const holidays = holidayDates(from, periodEnd)
  for (const d of String(flags.off || '').split(',').filter(Boolean)) if (!holidays.has(d)) holidays.set(d, 'extra day off (--off)')
  const leave = leaveByDate(userId, from, periodEnd)
  const cal = eachDate(from, periodEnd).map((d) => {
    const date = fmt(d)
    const l = leave.approved[date]
    return {
      date,
      weekend: isWeekend(d),
      holiday: holidays.get(date) || null,
      workday: !isWeekend(d) && !holidays.has(date),
      leave: l ? l.amount : 0,
      leavePolicy: l ? l.policy : null,
      pendingLeave: leave.pending[date] || 0,
      worked: byDay[date]?.tracked || 0,
      overall: byDay[date]?.overall || 0,
    }
  })
  const sum = (list, k) => list.reduce((s, x) => s + x[k], 0)
  const past = cal.filter((c) => c.date <= to)
  const workdaysToDate = past.filter((c) => c.workday).length
  const expectedToDate = workdaysToDate * daySeconds
  const leaveToDate = sum(past, 'leave')
  const diff = total.tracked + leaveToDate - expectedToDate

  // Full-period target and what is left, for periods that run past today.
  let remaining = null
  if (periodEnd > to || (to === todayStr && periodEnd === todayStr)) {
    const workdaysTotal = cal.filter((c) => c.workday).length
    const target = workdaysTotal * daySeconds
    const leaveTotal = sum(cal, 'leave')
    const left = cal.filter((c) => c.date >= todayStr)
    const stillToWork = Math.max(0, target - total.tracked - leaveTotal)
    // Working days left: weekdays from today on that are not holidays or full-day leave.
    const workingLeft = left.filter((c) => c.workday && c.leave < daySeconds).length
    remaining = {
      target,
      workdaysTotal,
      leaveTotal,
      stillToWork,
      workingDaysLeft: workingLeft,
      perWorkingDay: workingLeft ? Math.round(stillToWork / workingLeft) : null,
      allDaysLeft: left.length,
      perAnyDay: left.length ? Math.round(stillToWork / left.length) : null,
      upcoming: left.filter((c) => c.holiday || c.leave || c.pendingLeave),
    }
  }

  const pendingTotal = sum(cal, 'pendingLeave')
  const workedOnLeave = past.filter((c) => c.leave && c.worked >= 3600)
  if (flags.json) {
    console.log(JSON.stringify({ from, to, periodEnd, userId, dayHours, total, expectedToDate, leaveToDate, diff, remaining, pendingTotal, calendar: cal, byProject }, null, 2))
    return
  }

  // Output is markdown on purpose: the agent pastes it into its reply verbatim,
  // because the user cannot see tool output. Layout the user chose: a bullet
  // summary first, then one table (by day for a week or less, by week up to two
  // months, by month beyond that).
  const inProgress = to === todayStr
  const targetOf = (c) => (c.workday ? daySeconds : 0)
  const verdict = (x) => (x === 0 ? 'on target' : `${hm(Math.abs(x))} ${x < 0 ? 'short' : 'ahead'}`)
  const sign = (x) => (x === 0 ? '0h 00m' : `${x < 0 ? '-' : '+'}${hm(Math.abs(x))}`)
  const dates = (list) => list.map((c) => c.date)
  const settled = past.filter((c) => c.date !== todayStr) // today is still in progress
  const out = []
  const line = (x = '') => out.push(x)
  const multiYear = from.slice(0, 4) !== periodEnd.slice(0, 4)
  line(`**${label}: ${spanText(from, to, true)}**${periodEnd > to ? ` (period runs to ${dm(periodEnd)})` : ''}`)
  line()

  // ----- summary bullets -----
  line(`- **Worked:** ${hm(total.tracked)}`)
  const leaveDays = past.filter((c) => c.leave)
  if (leaveToDate) {
    const byPolicy = {}
    for (const c of leaveDays) (byPolicy[c.leavePolicy] ||= []).push(c)
    const parts = Object.entries(byPolicy).map(([p, cs]) => `${p}: ${dateList(dates(cs), 6)}`)
    if (parts.length === 1) line(`- **Approved leave:** ${hm(leaveToDate)} (${daysLabel(leaveToDate)}, ${parts[0]})`)
    else {
      line(`- **Approved leave:** ${hm(leaveToDate)} (${daysLabel(leaveToDate)})`)
      for (const p of parts) line(`  - ${p}`)
    }
  } else line('- **Approved leave:** none')
  const holidaysPast = past.filter((c) => c.holiday && !c.weekend)
  const targetWhy = [
    `${workdaysToDate} workdays x ${hmShort(daySeconds)}`,
    holidaysPast.length && `${holidaysPast.length} weekday holiday${holidaysPast.length > 1 ? 's' : ''} excluded`,
    inProgress && 'today counted in full',
  ].filter(Boolean)
  line(`- **${remaining ? 'Expected so far' : 'Target'}:** ${hm(expectedToDate)} (${targetWhy.join(', ')})`)
  line(`- **Result:** **${verdict(diff)}**`)
  if (remaining) {
    const r = remaining
    line(`- **Full target:** ${hm(r.target)} (${r.workdaysTotal} workdays x ${hmShort(daySeconds)}, weekends and weekday holidays excluded)`)
    line(`- **Still to work:** ${r.stillToWork ? `**${hm(r.stillToWork)}**` : 'nothing, target already covered'}`)
  }
  const offWork = past.filter((c) => !c.workday && c.worked)
  if (offWork.length) {
    const what = offWork.every((c) => c.weekend && !c.holiday) ? 'Weekend work' : 'Weekend and holiday work'
    line(`- **${what}:** ${hm(sum(offWork, 'worked'))} (${dateList(dates(offWork))})`)
  }
  const settledWork = settled.filter((c) => c.workday)
  if (settledWork.length > 1) {
    const full = settledWork.filter((c) => c.worked >= daySeconds).length
    line(`- **Days at ${hmShort(daySeconds)} or more:** ${full} of ${settledWork.length} workdays`)
    const longest = past.reduce((a, c) => (c.worked > (a ? a.worked : 0) ? c : a), null)
    if (longest) line(`- **Longest day:** ${hm(longest.worked)} on ${dayLabel(longest.date)}`)
    const shortest = settledWork.filter((c) => c.worked && !c.leave).reduce((a, c) => (!a || c.worked < a.worked ? c : a), null)
    if (shortest && shortest !== longest) line(`- **Shortest workday:** ${hm(shortest.worked)} on ${dayLabel(shortest.date)}`)
  }
  line(`- **Activity:** ${pct(total.overall, total.tracked)}${total.manual || total.idle ? ` (${[total.manual && `manual ${hm(total.manual)}`, total.idle && `idle ${hm(total.idle)}`].filter(Boolean).join(', ')})` : ''}`)
  const projects = Object.entries(byProject).sort((a, b) => b[1] - a[1])
  if (projects.length) line(`- **Project${projects.length > 1 ? 's' : ''}:** ${projects.map(([id, x]) => (projects.length > 1 ? `${projectName(id)} ${hm(x)}` : projectName(id))).join(', ')}`)
  if (pendingTotal) line(`- **Pending leave:** ${hm(pendingTotal)} (${dateList(dates(cal.filter((c) => c.pendingLeave)))}), not counted until approved`)
  const untracked = settledWork.filter((c) => !c.worked && !c.leave)
  if (untracked.length) line(`- ⚠️ **No time tracked:** ${dateList(dates(untracked))} (workday${untracked.length > 1 ? 's' : ''} with no leave)`)
  if (workedOnLeave.length) {
    const n = workedOnLeave.length
    line(`- ⚠️ **Flag:** ${dateList(dates(workedOnLeave))} ${n > 1 ? 'are' : 'is'} approved leave but ${n > 1 ? 'have' : 'has'} ${hm(sum(workedOnLeave, 'worked'))} tracked; both are counted.`)
    line(`  - If you worked ${n > 1 ? 'those days' : 'that day'}, the manager can cancel the leave so it goes back into your balance (approved leave cannot be withdrawn from here).`)
    line(`  - Without that leave the result would be **${verdict(diff - sum(workedOnLeave, 'leave'))}**.`)
  }

  // ----- table -----
  const by = flags.by || (flags.days ? 'day' : past.length <= 7 ? 'day' : past.length <= 62 ? 'week' : 'month')
  if (!['day', 'week', 'month', 'none'].includes(by)) die(`--by must be day, week, month or none`)
  const totalRow = (first) =>
    `| **Total** | ${first} | **${hm(total.tracked)}** | ${leaveToDate ? `**${hm(leaveToDate)}**` : ''} | **${hm(expectedToDate)}** | **${sign(diff)}** | |`

  if (by === 'day') {
    line()
    line('| Date | Day | Worked | Leave | Target | Difference | Note |')
    line('|---|---|---:|---:|---:|---:|---|')
    for (const c of past) {
      const notes = []
      if (c.holiday) notes.push(`holiday: ${c.holiday}`)
      else if (c.weekend) notes.push('weekend')
      if (c.leave) notes.push(c.leavePolicy)
      if (c.leave && c.worked >= 3600) notes.push('⚠️ leave day also worked')
      if (c.pendingLeave) notes.push(`pending leave ${hmShort(c.pendingLeave)}`)
      if (c.date === todayStr) notes.push('today, in progress')
      if (c.workday && !c.worked && !c.leave && c.date !== todayStr) notes.push('⚠️ no time tracked')
      const d = c.worked + c.leave - targetOf(c)
      line(`| ${dm(c.date)} | ${weekday(parse(c.date))} | ${c.worked ? hm(c.worked) : '-'} | ${c.leave ? hm(c.leave) : ''} | ${targetOf(c) ? hm(targetOf(c)) : ''} | ${c.worked || targetOf(c) ? sign(d) : ''} | ${notes.join('; ')} |`)
    }
    line(totalRow(''))
  } else if (by !== 'none') {
    const groups = []
    for (const c of past) {
      const d = parse(c.date)
      const key = by === 'week' ? fmt(addDays(d, -((d.getDay() + 6) % 7))) : c.date.slice(0, 7)
      let g = groups[groups.length - 1]
      if (!g || g.key !== key) groups.push((g = { key, days: [] }))
      g.days.push(c)
    }
    line()
    line(by === 'week' ? '| Week | Days | Worked | Leave | Target | Difference | Notes |' : '| Month | Days | Worked | Leave | Target | Difference | Notes |')
    line('|---|---|---:|---:|---:|---:|---|')
    groups.forEach((g, i) => {
      const ds = g.days
      const first = ds[0].date
      const last = ds[ds.length - 1].date
      const worked = sum(ds, 'worked')
      const leaveS = sum(ds, 'leave')
      const target = ds.reduce((s, c) => s + targetOf(c), 0)
      const notes = []
      const hol = ds.filter((c) => c.holiday && !c.weekend)
      if (hol.length) notes.push(by === 'week' ? hol.map((c) => `holiday ${dm(c.date)}: ${c.holiday}`).join('; ') : `${hol.length} holiday${hol.length > 1 ? 's' : ''}`)
      const lv = ds.filter((c) => c.leave)
      if (lv.length) notes.push(by === 'week' ? `${lv[0].leavePolicy} ${dateList(dates(lv))}` : `leave ${daysLabel(sum(lv, 'leave'))}`)
      if (lv.some((c) => c.worked >= 3600)) notes.push('⚠️ leave day also worked')
      const wk = ds.filter((c) => !c.workday && c.worked)
      if (wk.length) notes.push(`weekend ${hm(sum(wk, 'worked'))}`)
      const pend = ds.filter((c) => c.pendingLeave)
      if (pend.length) notes.push(`pending leave ${hmShort(sum(pend, 'pendingLeave'))}`)
      const none = ds.filter((c) => c.workday && !c.worked && !c.leave && c.date !== todayStr)
      if (none.length) notes.push(`⚠️ no time: ${by === 'week' ? dateList(dates(none)) : `${none.length} day${none.length > 1 ? 's' : ''}`}`)
      if (last === todayStr) notes.push('in progress')
      const name = by === 'week' ? String(i + 1) : `${MONTH_NAMES[parse(first).getMonth()]}${multiYear ? ` ${first.slice(0, 4)}` : ''}`
      line(`| ${name} | ${by === 'week' ? weekSpan(first, last) : spanText(first, last)} | ${hm(worked)} | ${leaveS ? hm(leaveS) : ''} | ${hm(target)} | ${sign(worked + leaveS - target)} | ${notes.join('; ')} |`)
    })
    line(totalRow(''))
  }

  if (remaining && remaining.stillToWork > 0) {
    const r = remaining
    line()
    line(`**Hours still to work, ${hm(r.stillToWork)}, spread over the days left (including today):**`)
    line()
    line('| If you work | Days left | Hours per day |')
    line('|---|---:|---:|')
    line(`| Working days only (no weekends, holidays or leave days) | ${r.workingDaysLeft} | ${r.perWorkingDay === null ? 'no working days left' : `**${hm(r.perWorkingDay)}**`} |`)
    line(`| Every day (weekends, holidays and leave days too) | ${r.allDaysLeft} | **${hm(r.perAnyDay)}** |`)
  }

  if (remaining && remaining.upcoming.length) {
    line()
    line('**Coming up:**')
    line()
    for (const c of remaining.upcoming) {
      const what = [c.holiday && `holiday: ${c.holiday}${c.weekend ? ' (weekend, no effect)' : ''}`, c.leave && `${c.leavePolicy} ${hm(c.leave)}`, c.pendingLeave && `pending leave ${hm(c.pendingLeave)}`].filter(Boolean).join('; ')
      line(`- **${dayLabel(c.date)}:** ${what}`)
    }
  }

  console.log(out.join('\n'))
}

// Approved and pending leave per date in [from, to]. "Work from Home" is a Hubstaff
// policy but not an absence, so it is never credited against the target.
function leaveByDate(userId, from, to) {
  const policies = policyMap()
  const approved = {}
  const pending = {}
  for (const r of requestsFor(userId)) {
    const policy = policies[r.time_off_policy_id]?.name || `policy ${r.time_off_policy_id}`
    if (/work from home/i.test(policy)) continue
    for (const d of reqDays(r)) {
      if (d.date < from || d.date > to) continue
      if (r.status === 'approved') {
        const a = (approved[d.date] ||= { amount: 0, policy })
        a.amount += d.amount_used
      } else if (r.status === 'pending') pending[d.date] = (pending[d.date] || 0) + d.amount_used
    }
  }
  return { approved, pending }
}

// ---------- time off ----------

function myPolicies() {
  return listAll(['time_off_policies', 'user_policies', '--user_id', String(me().id)], 'time_off_policies').items
}

function policyMap() {
  // org-wide list is readable by members and also covers archived policies on old requests
  const all = listAll(['time_off_policies', 'list'], 'time_off_policies').items
  return Object.fromEntries(all.map((p) => [p.id, p]))
}

function resolvePolicy(query) {
  const policies = myPolicies()
  if (/^\d+$/.test(query)) {
    const p = policies.find((x) => x.id === Number(query))
    if (!p) die(`policy ${query} is not one of your policies. Run: hs.js policies`)
    return p
  }
  const q = query.toLowerCase()
  const exact = policies.filter((p) => p.name.toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  const hits = policies.filter((p) => p.name.toLowerCase().includes(q))
  if (hits.length === 1) return hits[0]
  const list = (hits.length ? hits : policies).map((p) => `  ${p.id}  ${p.name}`).join('\n')
  die(`${hits.length ? 'ambiguous' : 'no'} policy match for "${query}". Use an id:\n${list}`)
}

function requestsFor(userId) {
  return listAll(['time_off_requests', 'list', '--user_ids', String(userId)], 'time_off_requests').items.sort(
    (a, b) => a.starts_at.localeCompare(b.starts_at),
  )
}
const myRequests = () => requestsFor(me().id)

const reqDays = (r) => (r.time_off_request_days || []).filter((d) => d.amount_used > 0)
const reqFrom = (r) => r.starts_at.slice(0, 10)
const reqTo = (r) => r.stops_at.slice(0, 10)
const daysLabel = (seconds) => {
  const d = seconds / DAY_SECONDS
  return `${Number.isInteger(d) ? d : d.toFixed(2)}d`
}

function cmdLeave(pos, flags) {
  const policies = policyMap()
  const year = flags.all ? null : String(flags.year || new Date().getFullYear())
  let reqs = myRequests()
  if (year) reqs = reqs.filter((r) => reqFrom(r).startsWith(year) || reqTo(r).startsWith(year))
  if (flags.status) reqs = reqs.filter((r) => r.status === flags.status)
  if (flags.upcoming) reqs = reqs.filter((r) => reqTo(r) >= fmt(new Date()))

  if (flags.json) {
    console.log(JSON.stringify(reqs, null, 2))
    return
  }
  const out = [`**Time off requests${year ? ` in ${year}` : ''}: ${reqs.length}**`]
  if (!reqs.length) return console.log(out[0])
  const STATUS = { approved: '✅ approved', pending: '⏳ pending', denied: '❌ denied' }
  const multiYear = new Set(reqs.map((r) => reqFrom(r).slice(0, 4))).size > 1
  out.push('', '| Request | Dates | Days | Hours | Status | Type | Reason |', '|---|---|---:|---:|---|---|---|')
  const totals = {}
  for (const r of reqs) {
    const policy = policies[r.time_off_policy_id]?.name || `policy ${r.time_off_policy_id}`
    // r.paid is payroll payout state, not paid leave; the policy name carries that
    out.push(`| #${r.id} | ${spanText(reqFrom(r), reqTo(r), multiYear)} | ${daysLabel(r.amount_used)} | ${hmShort(r.amount_used)} | ${STATUS[r.status] || r.status} | ${policy} | ${(r.message || '').replace(/\|/g, '/')} |`)
    const t = (totals[r.status] ||= { n: 0, s: 0 })
    t.n++
    t.s += r.amount_used
  }
  out.push('')
  for (const [status, t] of Object.entries(totals)) out.push(`- **${status[0].toUpperCase()}${status.slice(1)}:** ${t.n} request${t.n > 1 ? 's' : ''}, ${daysLabel(t.s)} (${hmShort(t.s)})`)
  console.log(out.join('\n'))
}

function cmdPolicies(pos, flags) {
  const ps = myPolicies()
  if (flags.json) return console.log(JSON.stringify(ps, null, 2))
  const out = ['**Your time off policies**', '', '| ID | Leave type | Paid | Yearly allowance | Approval |', '|---|---|---|---:|---|']
  for (const p of ps) {
    const h = p.policy_config?.hours_per_year
    const allowance = h ? `${daysLabel(h * 3600)} (${h}h)` : 'no fixed allowance'
    out.push(`| ${p.id} | ${p.name} | ${p.paid ? 'paid' : 'unpaid'} | ${allowance} | ${p.requires_approval ? 'needs approval' : 'auto-approved'} |`)
  }
  console.log(out.join('\n'))
}

// The balances endpoint is manager-only (403 for members), so this is an estimate
// from the member's own requests: yearly allowance minus approved and pending days
// dated in the calendar year. Carry-over and manual adjustments are invisible here.
function cmdBalance(pos, flags) {
  const year = String(flags.year || new Date().getFullYear())
  const reqs = myRequests()
  const rows = myPolicies().map((p) => {
    let approved = 0
    let pending = 0
    for (const r of reqs) {
      if (r.time_off_policy_id !== p.id) continue
      const used = reqDays(r)
        .filter((d) => d.date.startsWith(year))
        .reduce((s, d) => s + d.amount_used, 0)
      if (r.status === 'approved') approved += used
      else if (r.status === 'pending') pending += used
    }
    const allowance = (p.policy_config?.hours_per_year || 0) * 3600
    return { id: p.id, name: p.name, allowance, approved, pending, remaining: allowance ? allowance - approved - pending : null, rollsOver: p.balance_rolls_over_annually }
  })
  if (flags.json) return console.log(JSON.stringify({ year, rows }, null, 2))
  const out = [`**Leave used in ${year}** (estimate)`, '', '| Leave type | Allowance | Approved | Pending | Left (est.) | Note |', '|---|---:|---:|---:|---:|---|']
  for (const r of rows) {
    if (!r.allowance && !r.approved && !r.pending) continue
    out.push(`| ${r.name} | ${r.allowance ? daysLabel(r.allowance) : '-'} | ${daysLabel(r.approved)} | ${daysLabel(r.pending)} | ${r.remaining === null ? '-' : `**~${daysLabel(r.remaining)}**`} | ${r.rollsOver ? 'rolls over, true balance may be higher' : ''} |`)
  }
  out.push('', '- Hubstaff hides real balances from members, so this is allowance minus approved and pending days.', '- Carry-over from last year and manager adjustments are not included.')
  console.log(out.join('\n'))
}

// ---------- Sri Lanka holiday calendar ----------
// Twire works to the CBSL calendar: a Poya day or a Mercantile (M) holiday that falls
// on a weekday is a day off and comes out of Expected. Public/Bank-only holidays
// (Good Friday, Hadji, ...) are working days. Weekend holidays change nothing.

const fs = require('node:fs')
const path = require('node:path')
const HOLIDAY_DIR = path.join(__dirname, '..', 'holidays')
const cbslUrl = (year) => `https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-${year}`
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

const loadedYears = {}
function lkHolidays(year) {
  if (!(year in loadedYears)) {
    const file = path.join(HOLIDAY_DIR, `LK-${year}.json`)
    loadedYears[year] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
    if (!loadedYears[year]) process.stderr.write(`warning: no Sri Lanka holiday calendar for ${year}; run: bun hs.js holidays-sync ${year}\n`)
  }
  return loadedYears[year] || []
}

// Map of date -> holiday name for every weekday day off in [from, to]:
// CBSL Poya/Mercantile days plus anything configured in Hubstaff itself.
function holidayDates(from, to) {
  const out = new Map()
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const h of lkHolidays(y)) {
      if (!h.off || h.date < from || h.date > to || isWeekend(parse(h.date))) continue
      out.set(h.date, out.has(h.date) ? `${out.get(h.date)} / ${h.name}` : h.name)
    }
  }
  try {
    const items = listAll(['holidays', 'list', '--date[start]', from, '--date[stop]', to], 'holidays').items
    for (const h of items) {
      const date = (h.date || h.starts_at || '').slice(0, 10)
      if (date && !isWeekend(parse(date)) && !out.has(date)) out.set(date, h.name || 'Hubstaff holiday')
    }
  } catch {}
  return out
}

function cmdHolidays(pos, flags) {
  const year = Number(flags.year || new Date().getFullYear())
  const list = lkHolidays(year)
  if (flags.json) return console.log(JSON.stringify(list, null, 2))
  if (!list.length) return
  const out = [`**Sri Lanka holidays ${year}** (CBSL calendar)`, '', '| Date | Day | Holiday | Type | Effect |', '|---|---|---|---|---|']
  for (const h of list) {
    const d = parse(h.date)
    const type = [h.bank && 'Bank', h.public && 'Public', h.mercantile && 'Mercantile'].filter(Boolean).join(', ')
    const effect = isWeekend(d) ? 'weekend, no effect' : h.off ? '**day off**' : 'working day'
    out.push(`| ${dm(h.date)} | ${weekday(d)} | ${h.name} | ${type} | ${effect} |`)
  }
  const offDays = new Set(list.filter((h) => h.off && !isWeekend(parse(h.date))).map((h) => h.date))
  out.push('', `- **Weekday days off in ${year}:** ${offDays.size} (Poya and Mercantile holidays on weekdays; these come out of the target)`, '- Bank or Public only holidays are normal working days.')
  console.log(out.join('\n'))
}

// Downloads the CBSL table for a year into holidays/LK-<year>.json (local file only).
async function cmdHolidaysSync(pos, flags) {
  const year = Number(pos[0] || flags.year || new Date().getFullYear())
  const res = await fetch(cbslUrl(year), { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) die(`CBSL returned ${res.status} for ${cbslUrl(year)} (calendar not published yet?)`)
  const page = await res.text()
  const table = (page.match(/<table[\s\S]*?<\/table>/) || [])[0]
  if (!table) die('no holiday table found on the CBSL page; the layout may have changed')
  const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  const list = []
  for (const row of table.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map(strip)
    const m = /^([A-Za-z]+)\s+(\d{1,2})/.exec(cells[0] || '')
    if (!m || MONTHS.indexOf(m[1].toLowerCase()) < 0) continue
    const date = `${year}-${pad(MONTHS.indexOf(m[1].toLowerCase()) + 1)}-${pad(Number(m[2]))}`
    const desc = cells[1] || ''
    const tags = (/((?:\b[BPM]\.\s*)+)$/.exec(desc) || ['', ''])[1]
    const name = desc.slice(0, desc.length - tags.length).trim()
    const h = { date, name, bank: /B\./.test(tags), public: /P\./.test(tags), mercantile: /M\./.test(tags), poya: /poya/i.test(name) }
    h.off = h.poya || h.mercantile
    list.push(h)
  }
  if (!list.length) die('parsed 0 holidays from the CBSL page; the layout may have changed')
  fs.mkdirSync(HOLIDAY_DIR, { recursive: true })
  const file = path.join(HOLIDAY_DIR, `LK-${year}.json`)
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n')
  console.log(`Saved ${list.length} holidays to ${file}`)
  loadedYears[year] = list
  cmdHolidays([], { year })
}

// Without --confirm this only prints the request; nothing is sent.
function cmdLeaveRequest(pos, flags) {
  if (!flags.policy) die('--policy <id|name> is required. Run: hs.js policies')
  if (!flags.from) die('--from YYYY-MM-DD is required')
  if (!flags.message || flags.message === true) die('--message "reason" is required')
  const from = flags.from
  const to = flags.to || from
  if (parse(to) < parse(from)) die('--to is before --from')
  const policy = resolvePolicy(String(flags.policy))

  const partial = flags.half || flags.hours
  if (partial && from !== to) die('--half / --hours only work for a single day')
  const perDay = flags.half ? DAY_SECONDS / 2 : flags.hours ? Math.round(Number(flags.hours) * 3600) : DAY_SECONDS
  if (!(perDay > 0 && perDay <= 24 * 3600)) die('--hours must be between 0 and 24')

  const holidays = holidayDates(from, to)
  const days = eachDate(from, to).map((d) => {
    const date = fmt(d)
    const skip = (!flags['include-weekends'] && isWeekend(d)) || holidays.has(date)
    return { date, amount_used: skip ? 0 : perDay }
  })
  const total = days.reduce((s, d) => s + d.amount_used, 0)
  if (!total) die('every day in the range is a weekend or holiday; nothing to request')

  // Times are wall-clock in the user's Hubstaff timezone; the API ignores offsets.
  const startClock = flags.start || '09:00'
  const endClock = partial ? addClock(startClock, perDay) : '17:00'
  const body = {
    user_id: me().id,
    time_off_policy_id: policy.id,
    starts_at: `${from}T${startClock}:00`,
    stops_at: `${to}T${endClock}:00`,
    all_day: !partial,
    exclude_weekends: !flags['include-weekends'],
    message: flags.message,
    time_off_request_days: days,
  }

  const out = [
    `**Time off request ${flags.confirm ? '(sending)' : '(preview, not sent)'}**`,
    '',
    `- **Leave type:** ${policy.name} (${policy.paid ? 'paid' : 'unpaid'}, ${policy.requires_approval ? 'needs approval' : 'auto-approved'})`,
    `- **Dates:** ${spanText(from, to, true)}${partial ? `, ${startClock} to ${endClock}` : ''}`,
    `- **Total:** ${daysLabel(total)} (${hmShort(total)})`,
    `- **Reason:** ${flags.message}`,
  ]
  if (days.length > 1) {
    out.push('', '| Date | Day | Booked |', '|---|---|---:|')
    for (const d of days) out.push(`| ${dm(d.date)} | ${weekday(parse(d.date))} | ${d.amount_used ? hmShort(d.amount_used) : `skipped (${holidays.get(d.date) || 'weekend'})`} |`)
  }
  console.log(out.join('\n'))

  if (!flags.confirm) {
    console.log('\nNothing sent. Re-run with --confirm to submit.')
    return
  }
  const res = hs(['time_off_requests', 'create', '--body-json', JSON.stringify(body)])
  const r = res.time_off_request || res
  console.log(`\nSubmitted: request #${r.id} status=${r.status}`)
  if (res.balance_preview) console.log(`Balance preview: ${JSON.stringify(res.balance_preview)}`)
}

function addClock(hhmm, seconds) {
  const [h, m] = hhmm.split(':').map(Number)
  const mins = h * 60 + m + Math.round(seconds / 60)
  if (mins > 24 * 60) die('--start plus --hours runs past midnight')
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
}

// Only pending requests can be withdrawn; the API refuses approved or paid ones.
function cmdLeaveCancel(pos, flags) {
  const id = pos[0]
  if (!/^\d+$/.test(id || '')) die('usage: hs.js leave-cancel <request_id> [--confirm]')
  const r = hs(['time_off_requests', 'get', id]).time_off_request
  if (!r) die(`request ${id} not found`)
  if (r.user_id !== me().id) die(`request ${id} belongs to another user`)
  const policy = policyMap()[r.time_off_policy_id]?.name || r.time_off_policy_id
  console.log(`- **Request #${r.id}:** ${policy}, ${spanText(reqFrom(r), reqTo(r), true)}, ${daysLabel(r.amount_used)}, ${r.status}`)
  if (r.status !== 'pending') die(`status is ${r.status}; only pending requests can be cancelled`)
  if (!flags.confirm) {
    console.log('Nothing deleted. Re-run with --confirm to cancel it.')
    return
  }
  hs(['time_off_requests', 'delete', id])
  console.log(`Cancelled request #${id}.`)
}

function cmdMe() {
  const u = me()
  console.log(`${u.name} <${u.email}>  user_id=${u.id}  tz=${u.time_zone}`)
}

const HELP = `Usage: bun hs.js <command> [options]

  me                               Who the token belongs to
  hours [period]                   Bullet summary of worked vs target, then a table, and for
                                   the current week/month/year, hours still to work per day.
                                   period: today|yesterday|week (default)|last-week|
                                   month|last-month|year
  hours --from D [--to D]          Custom range (YYYY-MM-DD, inclusive)
        [--by day|week|month|none] Table grouping (default: day up to 7 days, week up to
                                   62 days, month beyond; --days = --by day)
        [--off D1,D2] [--day-hours N]  Extra days off (public holidays) / hours per workday (8)
  leave [--year Y|--all] [--status pending|approved|denied] [--upcoming]
  policies                         Your leave types with ids and yearly allowance
  balance [--year Y]               ESTIMATED leave left (real balances are manager-only)
  holidays [--year Y]              Sri Lanka (CBSL) holidays and which ones reduce Expected
  holidays-sync [Y]                Download the CBSL calendar for year Y into holidays/
  leave-request --policy <id|name> --from D [--to D] --message "why"
                [--half | --hours N [--start HH:MM]] [--include-weekends] [--confirm]
  leave-cancel <request_id> [--confirm]

Add --json to read commands for raw output. Writes are previews until --confirm.`

const { pos, flags } = parseArgs(process.argv.slice(2))
const cmd = pos.shift()
const commands = {
  me: cmdMe,
  hours: cmdHours,
  leave: cmdLeave,
  policies: cmdPolicies,
  balance: cmdBalance,
  holidays: cmdHolidays,
  'leave-request': cmdLeaveRequest,
  'leave-cancel': cmdLeaveCancel,
  'holidays-sync': cmdHolidaysSync,
}
if (!cmd || flags.help || !commands[cmd]) {
  console.log(HELP)
  process.exit(cmd && !commands[cmd] && !flags.help ? 3 : 0)
}
Promise.resolve()
  .then(() => commands[cmd](pos, flags))
  .catch((err) => die(err.message, err.exitCode || 1))
