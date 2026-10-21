# Proto Hub

Hackathon tool for NetApp UX: create Blueprint prototypes, build in Cursor, publish to ux.netapp.com, share links with the team.

## One command for the team (Team Proto Hub)

Needs macOS, Node 20+, and git. The repo is **public** - anyone can install (no collaborator invite).

Paste this in Slack / email:

```bash
# Team Proto Hub
npx --yes github:reachsreehitha-cloud/proto-hub
```

**Smoke-test on your Mac without touching your real install:**

```bash
cd /path/to/proto-hub
./scripts/dry-run-fresh-mac.sh
# later: rm -rf ~/ProtoHub-dry-run
```

That will:

1. Install Proto Hub
2. Put a **Proto Hub** icon in the menu bar (near Wi‑Fi) and pin **Proto Hub** to the Dock
3. Open the app window and set it to start at login

**If the menu bar is crowded and you do not see the icon:**

| How | What to do |
|-----|------------|
| Dock | Click **Proto Hub** (pinned on install) |
| Spotlight | `⌘Space` → type **Proto Hub** → Enter |
| Finder | `~/Applications` → **Proto Hub** |
| Menu bar overflow | Click `»` on the right of the menu bar |

No browser. No typing localhost. Right-click the menu-bar icon (or Dock icon) → **Quit Proto Hub** to stop it.

**Need for Publish:** VPN/Zscaler, NetApp SSO password (not Mac password).

## How multi-user works (hackathon)

| What | Works for everyone? | How |
|------|---------------------|-----|
| **Team gallery** (browse / open / copy live links) | Yes | Shared `data/team-registry.json` + GitHub. Everyone's Proto Hub loads it. |
| **Create new / drafts / Publish** | On each person's Mac | One `npx` command (or clone). Needs Desktop, VPN, SSO password. |
| **Hosting Proto Hub on ux.netapp.com** | Browse-only at best | OpenLab is static. Create/Publish need a local (or future IT-hosted) Node app. |

## Clone and run (manual)

```bash
git clone https://github.com/reachsreehitha-cloud/proto-hub.git
cd proto-hub
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The Blueprint starter lives in `template/` (including dependencies) so **Create new** works after clone without a separate Hackathon folder.

## Share a prototype with the team

1. Publish from **My drafts**.
2. Proto Hub writes your live URL into `data/team-registry.json`.
3. Commit and push:

```bash
git add data/team-registry.json
git commit -m "Add my prototype to team gallery"
git push
```

4. Teammates refresh Team gallery (or restart `npm run dev`) - they see Open / Copy for your ux.netapp.com link.

## Notes

- `data/prototypes.json` is local per Mac (gitignored).
- `data/team-registry.json` is shared (committed).
- Do not commit `.env` or passwords.
