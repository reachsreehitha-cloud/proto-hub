# Proto Hub

Hackathon tool for NetApp UX: create Blueprint prototypes, build in Cursor or Claude, publish to ux.netapp.com, share links with the team.

## How multi-user works (hackathon)

| What | Works for everyone? | How |
|------|---------------------|-----|
| **Team gallery** (browse / open / copy live links) | Yes | Shared `data/team-registry.json` + GitHub. Everyone's Proto Hub loads it. |
| **Create new / drafts / Publish** | On each person's Mac | Clone and run locally. Needs Desktop, VPN, SSO password. |
| **Hosting Proto Hub on ux.netapp.com** | Browse-only at best | OpenLab is static. Create/Publish need a local (or future IT-hosted) Node app. |

## Clone and run

```bash
git clone https://github.com/reachsreehitha-cloud/proto-hub.git
cd proto-hub
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Need:** Node 20+, VPN/Zscaler for Publish to OpenLab, NetApp SSO password for Publish (not Mac password).

The Blueprint starter lives in `template/` (including dependencies) so **Create new** works after clone without a separate Hackathon folder.

Private repo: ask the owner to add you under **Settings → Collaborators**.

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
