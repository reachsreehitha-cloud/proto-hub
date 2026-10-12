# Build your prototype (Cursor)

Blueprint is already installed in `blueprint-app`. Proto Hub starts the local preview. You should not need a terminal.

**Shipped with every Create (do not skip):**
- `FIGMA_COMPONENT_CONFIG.md`. Figma component usage guidelines + Proto Hub composition rules
- `BLUEPRINT_LAYOUT.md`. Layout / card / table / domain guidance from the Blueprint package
- `blueprint-app/src/patterns/consolePatterns.tsx`. `PageAlert` + `MetricPropertyBand` helpers
- `blueprint-app/src/index.css`. Full-width list pages, filter row, page-level alerts
- Left **service nav** is the only in-app navigation. Do **not** add Home “starter” cards or “Open X” buttons

## Paste this if the agent is not using Blueprint

```
Use ONLY @netapp/blueprint. Keep PrototypeShell. Read FIGMA_COMPONENT_CONFIG.md and reuse PageAlert + MetricPropertyBand from blueprint-app/src/patterns/consolePatterns.tsx.
Keep import "@netapp/blueprint/css". Put screens on service-nav routes (replace HomePage / DetailsPage). Never add starter cards or in-page buttons just to navigate between routes. Left nav is enough. Build the full page in one pass. Do not invent padding/width CSS.
```

## Example prompts (copy / adapt)

**New screen (one-shot)**
```
Replace the Home page with a Systems discovery screen: title + actions, PageAlert warning for 2 systems, MetricPropertyBand KPIs, BpSimpleFilters, and a systems table with realistic rows. Use consolePatterns helpers. Keep PrototypeShell and @netapp/blueprint/css. Do not add starter navigation cards or buttons to other routes.
```

**Iterate**
```
On the discovery page, make Discover systems the primary action and add an empty state when there are no systems. Keep PageAlert and MetricPropertyBand. Navigation stays in the left service nav only.
```

**Preview / stuck**
```
Start or fix the local Vite preview in blueprint-app so I can see the UI. Do not change the design system import away from @netapp/blueprint/css.
```

**Publish reminder**
When the screen looks right, go back to Proto Hub → My drafts → Publish (VPN + NetApp password). Share the ux.netapp.com link with your team.
