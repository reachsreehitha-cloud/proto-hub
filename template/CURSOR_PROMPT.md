# Build your prototype (Cursor or Claude)

Blueprint is already installed in `blueprint-app`.

**Paste this if the agent is not using Blueprint:**

```
Use ONLY @netapp/blueprint components (BpButton, BpAppShell, BpHeader, BpStack, BpText, BpCard, etc.).
Read blueprint-app/node_modules/@netapp/blueprint/dist/agent/docs/ai-layout-guidance.md first.
Do not use shadcn, MUI, plain custom CSS layouts, or invent new design systems.
Implement in blueprint-app/src with React + TypeScript. Keep hash routes (#/home).
```

Then describe what you want to build in plain language.

When ready to publish:
1. In `blueprint-app`, run `npm run dev` and check http://localhost:5173
2. Open Proto Hub → Publish
3. Share the ux.netapp.com link
