# HubstaffBar

A macOS menu bar widget for the **hubstaff** skill. Your hours are always visible and refresh every 5 minutes, without asking Claude.

```
⏱ 4h 35m  −3h 25m
```

- **First number:** time tracked today. It turns **orange** when you're behind pace for the day.
- **Second number:** this week's balance, **green** if you're ahead, **red** if you're short.
- `⏱ ⚠️ login` means your Hubstaff login has expired. Ask Claude to connect you again.

Click it for details:

| Section | Shows |
|---|---|
| **Today** | Tracked against 8h, time to go, and whether you're on pace |
| **This week** | Worked against target, result, still to work, per working day, activity % |
| **This month** | The same figures |

It also has **Refresh now** (⌘R), **Open Hubstaff**, and an on/off switch for the behind-pace alert.

## Behind-pace alert

Today's 8h is expected to build up evenly from **09:00 to 18:00**. If you fall more than **30 minutes** behind that, you get a notification:

> **Behind for today**
> 35m behind pace. Tracked 4h 43m of 8h 00m, 3h 17m to go.

While you stay behind it repeats at most once an hour. There are no alerts on weekends, holidays, or full leave days, or once you've reached 8h. To use different hours, change `workdayStart`, `workdayEnd` and `behindGrace` at the top of `main.swift`, then run `./install.sh` again.

## Install

**You need:** macOS 11+, Node.js 18+, the Xcode Command Line Tools (`xcode-select --install`), and the hubstaff plugin installed and connected (see [Quick start](../../README.md#quick-start)).

```bash
git clone https://github.com/nismi-twire/twire-skills.git
cd twire-skills/widgets/hubstaff-bar
./install.sh
```

This builds `~/Applications/HubstaffBar.app` and starts it now and at every login. Allow notifications when macOS asks. Run `./install.sh` again after any change.

**Uninstall:** `./uninstall.sh`

## How it works

- It runs the plugin's own `hs.js hours week --json` and `hours month --json` with Node, so holidays, leave and the 8h target count exactly as they do in Claude.
- It uses the newest plugin version under `~/.claude/plugins/cache/twire/hubstaff/`, so plugin updates are picked up automatically.
- It uses your existing Hubstaff login (`~/.config/hubstaff-skill/auth.json`). No extra token is needed.
- It refreshes every 5 minutes and right after your Mac wakes.
- It's a single Swift file with no dependencies.
