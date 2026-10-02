# Twire skills

Claude Code skills for Twire staff. Install once, then ask Claude in plain English.

| Skill | What it does |
|---|---|
| **hubstaff** | Your hours, hours left to work, leave, leave balance and Sri Lanka holidays. Books leave too. |

**Contents:** [Quick start](#quick-start) · [What you can ask](#what-you-can-ask) · [Sample replies](#sample-replies) · [How the target works](#how-the-target-works) · [Holidays 2026](#sri-lanka-holidays-2026) · [Troubleshooting](#troubleshooting)

---

## Quick start

**You need:** [Bun](https://bun.sh) or Node.js 18+. Keep tracking time in the Hubstaff desktop app as usual.

### 1. Install

In Claude Code, type each line on its own:

```
/plugin marketplace add nismi-twire/twire-skills
/plugin install hubstaff@twire
/reload-plugins
```

### 2. Turn on auto-update

`/plugin` → **Marketplaces** → **twire** → **Enable auto-update**

### 3. Connect Hubstaff

1. Ask Claude: *"How many hours have I worked today?"*
2. Open [Hubstaff personal access tokens](https://developer.hubstaff.com/personal_access_tokens), create a token and click **Copy**.
3. Reply **"done"**.

> [!IMPORTANT]
> **Never paste the token into the chat.** Claude reads it straight from your clipboard, so it never appears in the conversation. The clipboard is cleared afterwards.

> [!NOTE]
> **No daily login.** It renews itself. You only connect again after 90 days without using it.

---

## What you can ask

Ask the way you would ask a colleague. No commands to remember.

**Hours**

| # | Ask | You get |
|---|---|---|
| 1 | How many hours have I worked today? | Today against 8h |
| 2 | How many hours have I worked this week? | Day by day, plus what's left |
| 3 | How many hours do I still need to work this month? | Hours left, and per day to finish |
| 4 | Did I hit my hours last week? | Ahead or short |
| 5 | How many hours did I work between 1 July and 30 September? | Any date range |

**Leave and holidays**

| # | Ask | You get |
|---|---|---|
| 6 | Do I have any leave this month? | Your leave requests |
| 7 | Do we have any holidays this month? | Holidays and which are days off |
| 8 | When is the next Poya day? | Next holiday |
| 9 | How much annual leave do I have left? | Estimated balance |
| 10 | What leave types can I apply for? | Your leave policies |

**Booking leave**

| # | Ask | You get |
|---|---|---|
| 11 | Book annual leave for next Friday. | A preview to approve |
| 12 | Apply for a half day tomorrow afternoon. | A preview to approve |
| 13 | Cancel my pending leave request for 14 November. | A preview to approve |

> [!TIP]
> Nothing is sent to Hubstaff until you say **yes** to the preview.

---

## Sample replies

*Made-up numbers.*

### 1. "How many hours have I worked today?"

> **Today: Fri 2 Oct 2026**
>
> - **Worked:** 3h 10m
> - **Result:** **4h 50m short**
> - **Still to work:** **4h 50m**

### 2. "How many hours do I still need to work this month?"

*Asked on 20 Aug. One day of leave taken, a half day booked for 31 Aug, two holidays on 26 and 27 Aug.*

> **This month: 1 to 20 Aug 2026**
>
> - **Worked:** 96h 30m
> - **Approved leave:** 8h 00m (14 Aug)
> - **Full target:** 152h 00m (19 workdays x 8h)
> - **Still to work:** **43h 30m**
>
> | If you work | Days left | Per day |
> |---|---:|---:|
> | Working days only | 6 | **7h 15m** |
> | Every day | 12 | **3h 38m** |
>
> **Coming up:** 26 Aug holiday · 27 Aug Poya · 31 Aug half-day leave

**Why 152h?** August has 21 weekdays; the 2 holidays bring it to 19 (19 x 8h = 152h). Both leave days count as covered, including the half day that hasn't happened yet.

### 3. "Do we have any holidays this month?"

> | Date | Holiday | Effect |
> |---|---|---|
> | Sun 8 Nov | Deepawali | weekend, no effect |
> | Tue 24 Nov | Ill Full Moon Poya Day | **day off** (8h off your target) |

### 4. "How much annual leave do I have left?"

> | Leave type | Allowance | Used | Left |
> |---|---:|---:|---:|
> | Casual / Sick | 7d | 4d | **~3d** |
> | Annual | 14d | 10d | **~4d** |
>
> Estimate only: carry-over and manager adjustments aren't visible to members.

### 5. "Book annual leave for next Friday"

> **Preview, not sent yet**
>
> - **Type:** Annual leaves
> - **Date:** Fri 16 Oct 2026 (8h)
> - **Reason:** personal
>
> Shall I submit it?

---

## How the target works

| Day | Counts as |
|---|---|
| Weekday | 8h to work |
| Poya or Mercantile holiday on a weekday | **Day off**, removed from the target |
| Bank or Public-only holiday (e.g. Good Friday) | Normal workday |
| Approved leave | **Worked**: 8h full day, 4h half day, future leave included |
| Pending leave, Work from Home | Not counted |
| Today | A full day, so "short" early in the day is normal |

---

## Sri Lanka holidays 2026

**14 weekday days off** this year (112h off the yearly target). Source: [CBSL Bank Holidays 2026](https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-2026).

<details>
<summary><b>Show all 2026 holidays</b></summary>

| Date | Holiday | Effect |
|---|---|---|
| Sat 3 Jan | Duruthu Full Moon Poya Day | weekend |
| Thu 15 Jan | Tamil Thai Pongal Day | **day off** |
| Sun 1 Feb | Navam Full Moon Poya Day | weekend |
| Wed 4 Feb | Independence Day | **day off** |
| Sun 15 Feb | Mahasivarathri Day | weekend |
| Mon 2 Mar | Medin Full Moon Poya Day | **day off** |
| Sat 21 Mar | Id-Ul-Fitre (Ramazan Festival Day) | weekend |
| Wed 1 Apr | Bak Full Moon Poya Day | **day off** |
| Fri 3 Apr | Good Friday | workday |
| Mon 13 Apr | Day prior to Sinhala & Tamil New Year | **day off** |
| Tue 14 Apr | Sinhala & Tamil New Year Day | **day off** |
| Fri 1 May | Vesak Full Moon Poya Day + May Day | **day off** |
| Sat 2 May | Day following Vesak Poya | weekend |
| Thu 28 May | Id-Ul-Allah (Hadji Festival Day) | workday |
| Sat 30 May | Adhi Poson Full Moon Poya Day | weekend |
| Mon 29 Jun | Poson Full Moon Poya Day | **day off** |
| Wed 29 Jul | Esala Full Moon Poya Day | **day off** |
| Wed 26 Aug | Milad-Un-Nabi (Holy Prophet's Birthday) | **day off** |
| Thu 27 Aug | Nikini Full Moon Poya Day | **day off** |
| Sat 26 Sep | Binara Full Moon Poya Day | weekend |
| Sun 25 Oct | Vap Full Moon Poya Day | weekend |
| Sun 8 Nov | Deepawali Festival Day | weekend |
| Tue 24 Nov | Ill Full Moon Poya Day | **day off** |
| Wed 23 Dec | Unduwap Full Moon Poya Day | **day off** |
| Fri 25 Dec | Christmas Day | **day off** |

</details>

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Not connected" or "login has expired" | Copy a new token, reply "done" |
| "The clipboard does not hold a Hubstaff token" | Click **Copy** on the token again |
| "Hubstaff did not accept that token" | Each token works once. Create a new one |
| `bun: command not found` | Install [Bun](https://bun.sh) or Node.js 18+ |
| Claude doesn't answer Hubstaff questions | `/reload-plugins` or restart Claude Code |
| No holiday calendar for a new year | `/plugin marketplace update twire` |

<details>
<summary><b>More: other install option, uninstall, no clipboard</b></summary>

**Install with npx skills** (also works in Cursor and Codex; no auto-update, run `npx skills update` now and then):

```bash
npx skills add nismi-twire/twire-skills --skill hubstaff -g -a claude-code
```

**Update by hand:** `/plugin marketplace update twire`

**Uninstall:** `/plugin uninstall hubstaff@twire` or `npx skills remove hubstaff -g`

**Log out:** ask Claude to log you out of Hubstaff, or delete the token on the Hubstaff page.

**No clipboard** (e.g. a Linux server), in your own terminal:

```bash
HUBSTAFF_TOKEN=<token> bun <skill folder>/scripts/hs.js login
```

**Where the login lives:** `~/.config/hubstaff-skill/auth.json`, readable only by you.

</details>

<details>
<summary><b>For maintainers</b></summary>

- Each skill lives in `plugins/<name>/skills/<name>/`, with `plugins/<name>/.claude-plugin/plugin.json` and an entry in `.claude-plugin/marketplace.json`.
- **Bump `version` in `plugin.json` on every change**, or plugin users won't get the update.
- Each January: `bun plugins/hubstaff/skills/hubstaff/scripts/hs.js holidays-sync <year>`, commit the new `holidays/LK-<year>.json`, bump the version.
- Run `claude plugin validate .` before pushing.

</details>
