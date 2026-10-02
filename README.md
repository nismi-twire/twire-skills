# Twire skills

Claude Code skills for Twire staff.

| Skill | What it does |
|---|---|
| `hubstaff` | Hours worked this week or month, hours still to work, leave requests and balance, Sri Lanka holidays. Uses your own Hubstaff token. |

## Install: Claude Code plugin (recommended)

Inside Claude Code:

```
/plugin marketplace add nismi-twire/twire-skills
/plugin install hubstaff@twire
```

Then turn on automatic updates (one time): run `/plugin`, open the **Marketplaces** tab, select **twire** and choose **Enable auto-update**.

To update by hand instead: `/plugin marketplace update twire`.

## Install: npx skills (Claude Code, Cursor, Codex, ...)

In a terminal:

```bash
npx skills add nismi-twire/twire-skills --skill hubstaff -g -a claude-code
```

`-g` installs it for all your projects. Leave out `-a claude-code` to choose other agents.

This route has no automatic updates. Run `npx skills update` now and then, at least every January when the new holiday calendar is added.

## Hubstaff first-time setup

Install the Hubstaff CLI once (needs Homebrew), and make sure `bun` or `node` is installed:

```bash
brew install netsoftholdings/tap/hubstaff
```

Then ask Claude something like "how many hours did I work this week". It walks you through creating a personal access token and saving it with `hubstaff config set-pat`. Never paste the token into the chat.

## Maintaining

- Each skill lives in `plugins/<name>/skills/<name>/`, with a `plugins/<name>/.claude-plugin/plugin.json` and an entry in `.claude-plugin/marketplace.json`.
- Bump `version` in the skill's `plugin.json` on every change, or plugin users will not receive the update.
- Each new year, run `bun plugins/hubstaff/skills/hubstaff/scripts/hs.js holidays-sync <year>` in this repo and commit the new `holidays/LK-<year>.json`.
