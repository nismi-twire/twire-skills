# Twire skills

Claude Code skills for Twire staff. Install once, then just ask Claude in plain English.

| Skill | What it does |
|---|---|
| [`hubstaff`](#hubstaff) | Hours worked today, this week or this month, hours still to work, your leave and leave balance, Sri Lanka holidays, and booking leave. Uses your own Hubstaff account. |

---

## Install

You only do this once.

### Option 1: Claude Code plugin (recommended)

Type these inside Claude Code, one at a time:

```
/plugin marketplace add nismi-twire/twire-skills
```

```
/plugin install hubstaff@twire
```

```
/reload-plugins
```

### Turn on automatic updates

Claude Code does not update skills from this repo automatically unless you switch it on. Do this once:

1. Type `/plugin` in Claude Code.
2. Open the **Marketplaces** tab.
3. Select **twire**.
4. Choose **Enable auto-update**.

From then on, Claude Code checks for a new version a few minutes after you start a session. When one arrives you will see `Plugin updated: hubstaff`. It is used from your next session, or straight away if you type `/reload-plugins`.

To update by hand instead, type `/plugin marketplace update twire`.

### Option 2: npx skills (also works in Cursor, Codex and others)

In a normal terminal:

```bash
npx skills add nismi-twire/twire-skills --skill hubstaff -g -a claude-code
```

`-g` installs it for all your projects. Leave out `-a claude-code` if you want to pick other tools.

This option has **no automatic updates**. Run `npx skills update` now and then, and at least once every January, when the new year's holiday calendar is added.

---

## Hubstaff

### First-time setup

1. Install the Hubstaff command-line tool (needs [Homebrew](https://brew.sh)):

   ```bash
   brew install netsoftholdings/tap/hubstaff
   ```

   You also need [Bun](https://bun.sh) or Node.js installed.

2. Ask Claude anything, for example **"How many hours have I worked today?"**

3. Claude sees you are not connected yet and walks you through it:
   - open https://developer.hubstaff.com/personal_access_tokens and create a token,
   - save it yourself by typing `! hubstaff config set-pat <your token>` in Claude Code,
   - pick your organization.

   **Never paste your token into the chat.** The `!` in front runs the command on your machine without sending the token to Claude.

Each person uses their own token, so Claude only ever sees your own data.

### Things you can ask

You don't need to remember any commands. Ask the way you would ask a colleague:

**Hours**
- How many hours have I worked today?
- How many hours have I worked this week?
- Am I behind on my hours this month?
- How many hours do I still need to work this month?
- How many hours a day do I need to work to finish this month?
- Did I hit my hours last week?
- How many hours did I work between 1 July and 30 September?

**Leave and holidays**
- Do I have any leave this month?
- Do we have any holidays this month?
- Show this year's holidays.
- When is the next Poya day?
- How much annual leave do I have left?
- Show my pending leave requests.
- What leave types can I apply for?

**Booking leave**
- Book annual leave for next Friday, reason "personal".
- Apply for a half day of casual leave tomorrow afternoon.
- Cancel my pending leave request for 14 November.

### Sample replies

The numbers below are made up, and some replies are shortened.

**"How many hours have I worked today?"**

> **Today: Fri 2 Oct 2026**
>
> - **Worked:** 3h 10m
> - **Expected so far:** 8h 00m (today counted in full)
> - **Result:** **4h 50m short**
> - **Still to work:** **4h 50m**
> - **Activity:** 62%

**"How many hours do I still need to work this month?"** (asked on Thu 20 Aug, with a full day of leave on 14 Aug, a half day booked for 31 Aug, and two holidays on 26 and 27 Aug)

> **This month: 1 to 20 Aug 2026** (period runs to 31 Aug)
>
> - **Worked:** 96h 30m
> - **Approved leave:** 8h 00m (1d, Annual leaves: 14 Aug)
> - **Expected so far:** 112h 00m (14 workdays x 8h, today counted in full)
> - **Result:** **7h 30m short**
> - **Full target:** 152h 00m (19 workdays x 8h, weekends and weekday holidays excluded)
> - **Still to work:** **43h 30m**
>
> | Date | Day | Worked | Leave | Target | Difference | Note |
> |---|---|---:|---:|---:|---:|---|
> | 13 Aug | Thu | 8h 20m | | 8h 00m | +0h 20m | |
> | 14 Aug | Fri | | 8h 00m | 8h 00m | 0h 00m | Annual leaves |
> | 15 Aug | Sat | | | | | weekend |
> | ... | | | | | | |
>
> **Hours still to work, 43h 30m, spread over the days left (including today):**
>
> | If you work | Days left | Hours per day |
> |---|---:|---:|
> | Working days only (no weekends, holidays or leave days) | 6 | **7h 15m** |
> | Every day (weekends, holidays and leave days too) | 12 | **3h 38m** |
>
> **Coming up:**
>
> - **Wed 26 Aug:** holiday: Milad-Un-Nabi (Holy Prophet's Birthday)
> - **Thu 27 Aug:** holiday: Nikini Full Moon Poya Day
> - **Mon 31 Aug:** Annual leaves 4h 00m

Here the month has 21 weekdays. The two holidays (Milad-Un-Nabi and Nikini Poya) take that down to 19 workdays, so the target is 152h instead of 168h. Both leave days (8h + 4h) also count as covered, including the half day that hasn't happened yet.

**"Do we have any holidays this month?"** (asked in November)

> | Date | Day | Holiday | Type | Effect |
> |---|---|---|---|---|
> | 8 Nov | Sun | Deepawali Festival Day | Bank, Public | weekend, no effect |
> | 24 Nov | Tue | Ill Full Moon Poya Day | Bank, Public | **day off** |
>
> One weekday off this month (24 Nov), so your November target is 8h lower.

**"How much leave do I have left?"**

> | Leave type | Allowance | Approved | Pending | Left (est.) |
> |---|---:|---:|---:|---:|
> | Casual Leave/ Sick Leave Policy | 7d | 4d | 0d | **~3d** |
> | Annual leaves | 14d | 9d | 1d | **~4d** |
>
> This is an estimate: Hubstaff hides real balances from members, so carry-over and manager adjustments are not included.

**"Book annual leave for next Friday"**

> Here is the request. Nothing has been sent yet:
>
> - **Type:** Annual leaves
> - **Date:** Fri 16 Oct 2026, 8h
> - **Reason:** personal
>
> Shall I submit it?

Claude only submits after you say yes to that exact preview.

### How your hours target is worked out

The skill doesn't just add up your tracked time. It works out what you **should** have worked, taking your leave and Sri Lanka's holidays into account:

- **A normal workday is 8 hours**, Monday to Friday.
- **Holidays reduce your target.** Poya days and Mercantile holidays that fall on a weekday are days off, so they are taken out of the hours you need to work. On a weekend they change nothing. Bank- or Public-only holidays (for example Good Friday) are normal working days. The full list is [below](#sri-lanka-holidays-2026).
- **Approved leave counts as hours covered.** A full day of leave covers 8h and a half day covers 4h, so those hours come off what you still have to work. This includes leave that is approved for later in the period.
- **Pending leave is shown but not counted** until it is approved. **Work from Home** requests are never counted as leave.
- **Today counts as a full day** while it is still in progress, so "short" early in the day is normal.
- **"Hours per day" shows two ways to catch up:** working only the remaining working days, or spreading the hours over every remaining day, including weekends and holidays.
- If a day has both approved leave and tracked time, Claude points it out, since the leave may not have been taken.
- Days follow the organization's timezone, so very late-night work can land on the next date.

### Sri Lanka holidays 2026

Source: Central Bank of Sri Lanka, [Bank Holidays 2026](https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-2026). The skill ships this calendar in `holidays/LK-2026.json`, taken from that page.

**Day off** means the holiday is taken out of your hours target. **Working day** means it is a Bank or Public holiday only, so you are expected to work as normal.

| Date | Day | Holiday | Type | Effect on your target |
|---|---|---|---|---|
| 3 Jan | Sat | Duruthu Full Moon Poya Day | Bank, Public | weekend, no effect |
| 15 Jan | Thu | Tamil Thai Pongal Day | Bank, Public, Mercantile | **day off** |
| 1 Feb | Sun | Navam Full Moon Poya Day | Bank, Public | weekend, no effect |
| 4 Feb | Wed | Independence Day | Bank, Public, Mercantile | **day off** |
| 15 Feb | Sun | Mahasivarathri Day | Bank, Public | weekend, no effect |
| 2 Mar | Mon | Medin Full Moon Poya Day | Bank, Public | **day off** |
| 21 Mar | Sat | Id-Ul-Fitre (Ramazan Festival Day) | Bank, Public | weekend, no effect |
| 1 Apr | Wed | Bak Full Moon Poya Day | Bank, Public | **day off** |
| 3 Apr | Fri | Good Friday | Bank, Public | working day |
| 13 Apr | Mon | Day prior to Sinhala & Tamil New Year Day | Bank, Public, Mercantile | **day off** |
| 14 Apr | Tue | Sinhala & Tamil New Year Day | Bank, Public, Mercantile | **day off** |
| 1 May | Fri | Vesak Full Moon Poya Day | Bank, Public | **day off** |
| 1 May | Fri | May Day (International Workers' Day) | Bank, Public, Mercantile | **day off** (same day as Vesak) |
| 2 May | Sat | Day following Vesak Full Moon Poya Day | Bank, Public, Mercantile | weekend, no effect |
| 28 May | Thu | Id-Ul-Allah (Hadji Festival Day) | Bank, Public | working day |
| 30 May | Sat | Adhi Poson Full Moon Poya Day | Bank, Public | weekend, no effect |
| 29 Jun | Mon | Poson Full Moon Poya Day | Bank, Public | **day off** |
| 29 Jul | Wed | Esala Full Moon Poya Day | Bank, Public | **day off** |
| 26 Aug | Wed | Milad-Un-Nabi (Holy Prophet's Birthday) | Bank, Public, Mercantile | **day off** |
| 27 Aug | Thu | Nikini Full Moon Poya Day | Bank, Public | **day off** |
| 26 Sep | Sat | Binara Full Moon Poya Day | Bank, Public | weekend, no effect |
| 25 Oct | Sun | Vap Full Moon Poya Day | Bank, Public | weekend, no effect |
| 8 Nov | Sun | Deepawali Festival Day | Bank, Public | weekend, no effect |
| 24 Nov | Tue | Ill Full Moon Poya Day | Bank, Public | **day off** |
| 23 Dec | Wed | Unduwap Full Moon Poya Day | Bank, Public | **day off** |
| 25 Dec | Fri | Christmas Day | Bank, Public, Mercantile | **day off** |

**14 weekday days off in 2026**, so a full year's target is 14 x 8h = 112h lower than counting every weekday.

Ask Claude **"Show this year's holidays"** to get this table at any time. For a year that isn't in the skill yet (for example 2027, once CBSL publishes it), Claude can download it from the same CBSL page.

### Leave requests are always confirmed first

Booking or cancelling leave always shows you a preview first, and Claude waits for your yes before sending anything to Hubstaff. "Just do it" still gets a preview. If anything changes, you see the preview again.

### Troubleshooting

| Problem | Fix |
|---|---|
| `hubstaff: command not found` | Run `brew install netsoftholdings/tap/hubstaff` |
| "session expired" or an auth error | Create a new token and type `! hubstaff config set-pat <token>` |
| "no Sri Lanka holiday calendar for 2027" | Update the skill (`/plugin marketplace update twire`). If it is still missing, Claude can download it, but tell the maintainer so it gets added for everyone. |
| The skill doesn't respond to Hubstaff questions | Type `/reload-plugins`, or restart Claude Code |

### Uninstall

- Plugin: `/plugin uninstall hubstaff@twire`
- npx skills: `npx skills remove hubstaff -g`

---

## For maintainers

- Each skill lives in `plugins/<name>/skills/<name>/`, with a `plugins/<name>/.claude-plugin/plugin.json` and an entry in `.claude-plugin/marketplace.json`.
- **Bump `version` in the skill's `plugin.json` on every change**, or plugin users will not receive the update.
- Each new year, run `bun plugins/hubstaff/skills/hubstaff/scripts/hs.js holidays-sync <year>` in this repo, commit the new `holidays/LK-<year>.json` and bump the version.
- Check changes with `claude plugin validate .` before pushing.
