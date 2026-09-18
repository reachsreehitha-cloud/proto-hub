# Proto Hub

Hackathon tool for NetApp UX: create Blueprint prototypes, build in Cursor or Claude, publish to ux.netapp.com, share links with the team.

This runs **on your Mac** (localhost). It is not a shared hosted web app yet. Everyone clones and runs their own copy.

## Prerequisites

- Mac with Node.js 20+ (`node -v`)
- NetApp VPN or Zscaler (`@netapp.com` tenant) when installing Blueprint / publishing
- Cursor and/or Claude Code installed (optional but recommended)
- Your NetApp SSO password for Publish (not your Mac login)

## Clone and run

```bash
git clone https://github.com/reachsreehitha-cloud/proto-hub.git
cd proto-hub
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to use

1. **Create new** - names a project, copies the Blueprint starter to your Desktop, opens your editor.
2. Build the UI in Cursor or Claude inside that folder.
3. In Proto Hub, open **My drafts**, enter your NetApp SSO password, hit **Publish**.
4. Share the live `https://ux.netapp.com/~YOURID/slug/` link (also listed under **Team gallery** on your machine).

Team gallery on localhost only shows prototypes **this Mac** knows about (its local data). To see someone else's live demo, open their ux.netapp.com link directly.

## Notes

- Do not commit `.env` files or SSO passwords.
- `data/prototypes.json` is local to each machine (gitignored).
- Publish needs VPN/Zscaler and access to OpenLab (`cyclortp` / ux.netapp.com).
