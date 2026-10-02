---
name: hubstaff
description: Use when the user asks about Hubstaff, tracked hours or time worked (today, this week, this month, a date range), hours left to work, activity percentage, leave or time off (list, balance, request, cancel), leave policies, Sri Lanka holidays or Poya days, or any other Hubstaff data such as projects, tasks, timesheets or screenshots.
---

# Hubstaff

For Twire (Sri Lanka) staff. Everything here is self-contained: the person's identity comes from their own Hubstaff token, so the same skill works for anyone who installs it.

Two layers, both on the official `hubstaff` CLI:

1. **`scripts/hs.js`** for anything that needs date maths, summing or a safe write: hours, leave, balance, leave requests.
2. **Raw `hubstaff` CLI** for everything else (it exposes every public API v2 endpoint).

```bash
HS=<this skill's base directory>/scripts/hs.js
```

Use the base directory Claude Code shows when this skill loads. Do not assume `~/.claude/skills/hubstaff`: installed as a plugin, the skill lives under `~/.claude/plugins/cache/...` instead.

## First-time setup (check before the first command)

If `hubstaff` is missing or `bun $HS me` fails with an auth error, walk the user through:

1. Install: `brew install netsoftholdings/tap/hubstaff` (needs Homebrew). Runtime: `bun` (or `node`) must be installed.
2. Token: the user opens https://developer.hubstaff.com/personal_access_tokens, creates a token and copies it (shown once).
3. The user runs, themselves: `! hubstaff config set-pat <TOKEN>`. Never ask them to paste the token in chat.
4. Default organization: run `hubstaff -j organizations list`, then `hubstaff config set organization <id>`.
5. Verify: `hubstaff check` (all OK) and `bun $HS me`.

## Quick reference (hs.js)

| Question | Command |
|---|---|
| Hours this week / month / year | `bun $HS hours week` · `month` · `year` |
| Hours for a past period | `bun $HS hours last-week` · `last-month` · `--from 2026-07-01 --to 2026-09-30` |
| My leave requests | `bun $HS leave` (this year) · `--all` · `--year 2025` · `--status pending` · `--upcoming` |
| Leave types and ids | `bun $HS policies` |
| Leave left | `bun $HS balance` |
| Sri Lanka holidays | `bun $HS holidays [--year Y]` · new year: `bun $HS holidays-sync 2027` |
| Request leave | `bun $HS leave-request --policy <id> --from D [--to D] --message "why"` |
| Partial day | add `--half`, or `--hours 2 --start 14:00` (single day only) |
| Withdraw a pending request | `bun $HS leave-cancel <id>` |
| Raw JSON from a read command | add `--json` |

Weeks start Monday. Dates are YYYY-MM-DD, inclusive.

## How every answer is formatted

**The user cannot see command output** (Claude Code collapses it to "Ran 1 shell command"), so every answer must carry the data itself, in this house style (the user picked it after comparing layouts):

- **Tables** for anything with rows that share columns: days, weeks, months, leave requests, policies, balances, holidays, projects, tasks.
- **Bullet lists** for summaries, key figures, flags and next steps. Use bold labels: `- **Worked:** 168h 43m`. Nest sub-bullets for details of one item.
- **Flags** start with ⚠️ (leave day also worked, workday with no time tracked).
- **Dates** are human: `Wed 30 Sep`, `1 to 4 Sep`, `19, 20 and 26 Sep`, not ISO, unless the user asks for ISO.
- No long prose paragraphs, and no em dashes.

Every `hs.js` read command already prints markdown in this style: **paste its stdout verbatim**, then add at most one or two sentences of your own if something needs saying. For raw `hubstaff` CLI results, build the same layout yourself: a bullet summary first, then a table.

## Reporting hours

`bun $HS hours ...` prints, in this order:

1. **Bullet summary**: Worked, Approved leave (dates and type), Target (or Expected so far, for a period still running), Result (ahead or short), and, for current periods, Full target and Still to work. It then adds weekend work, days at 8h or more, longest day, shortest workday, activity, project, pending leave and ⚠️ flags (leave day also worked, with what the result would be without that leave; workdays with no time tracked).
2. **One table**, grouped by period length (`--by day|week|month|none` overrides):
   - **Up to 7 days, by day**: Date, Day, Worked, Leave, Target, Difference, Note.
   - **Up to 62 days, by week** (Mon to Sun, clipped to the range): Week, Days, Worked, Leave, Target, Difference, Notes, with a bold Total row. This is the user's preferred view for a month.
   - **Longer ranges, by month**: the same columns, one row per month.
3. **For the current week, month or year:** a table of the hours per day still needed to finish the target:
   - *Working days only*: hours per day if they work only the remaining weekdays that are not holidays or full-day leave.
   - *Every day*: hours per day if they also work weekends, holidays and leave days.
4. **Coming up**: upcoming holidays and leave in the period, as bullets.

Table rows are summed from exact seconds, so weekly or monthly rows add up to the Total.

How the target is built:

- Expected = workdays x 8h. Hubstaff has no schedule or weekly limit configured; 8h is what a leave day is booked as. `--day-hours N` overrides.
- **Holidays** come from the Central Bank of Sri Lanka calendar saved in `holidays/LK-<year>.json` inside this skill. A **Poya day or a Mercantile (M) holiday on a weekday** is a day off and is removed from the target. On a weekend it changes nothing. Public/Bank-only holidays (Good Friday, Hadji, ...) are working days.
- **Approved leave** counts as time covered, including leave later in the period. Pending leave is shown but not counted. "Work from Home" requests are never counted as leave.
- A "⚠️ Flag: ... is approved leave but has Xh tracked" bullet means both were counted for that day; the leave may not have been taken. Only a manager can cancel approved leave (`leave-cancel` handles pending requests only).
- `Expected so far` counts today as a full day while today is still in progress.
- If the output warns `no Sri Lanka holiday calendar for <year>`, run `bun $HS holidays-sync <year>` (downloads from cbsl.gov.lk into this skill's `holidays/` folder) and re-run. A synced file is lost on the next skill update, so also tell the user the new year's file should be added to the shared repo (github.com/nismi-twire/twire-skills). `--off D1,D2` adds one-off extra days off.

## Writes need the user's explicit yes

`leave-request` and `leave-cancel` only print a preview unless `--confirm` is passed. The flow is always:

1. Run without `--confirm` and paste the preview (bullets for leave type, dates, total and reason, plus a per-day table for multi-day requests).
2. Wait for the user to approve that exact preview in chat.
3. Re-run the identical command with `--confirm`.

A request to "book leave" is not approval of the preview, and neither is "don't ask me, just do it": every Hubstaff write must be asked first. If anything in the preview changes, show it again.

Policy names are ambiguous ("annual" matches paid and unpaid); when the user has not said which, run `policies` and ask. Weekends and Poya/Mercantile holidays are booked as 0h automatically; `--include-weekends` overrides weekends.

## Things the data can't tell you

- **Balance is an estimate.** The real balances endpoint returns 403 for regular members. `balance` subtracts approved and pending days from the yearly allowance; carry-over (policies marked "rolls over") and manager adjustments are invisible. Say so when reporting it.
- A request's `paid` field is payroll payout state, not paid leave. Use the policy name.
- Days follow the organization's timezone, so late-night work can land on the next date.

## Raw CLI for everything else

```bash
hubstaff list | grep -i <topic>          # find the command
hubstaff <command> --help                # flags for one command
hubstaff -j <command> ...                # minified JSON
```

- **Quote bracket flags** in zsh or it errors with `no matches found`: `'--date[start]' 2026-10-01`.
- Range endpoints (`activities daily`) cap at 31 days; list endpoints page with `--page_limit 500 --page_start_id <next>`.
- Durations are seconds. The user id is in `bun $HS me`; the organization id is the CLI default.
- Exit code 2 means the session expired: the user creates a new token and runs `! hubstaff config set-pat <TOKEN>`.
- For any raw write (`create`, `update`, `delete`), show the user what will be sent and get a yes first.
