# Figma component configuration (from @netapp/blueprint)

These are the **Usage guidelines** pasted from each Blueprint component’s Figma configuration
(also in \`dist/agent/manifests/components.json\`). Read the relevant section before coding that component.

## Proto Hub composition rules (enforce with the configs below)

These rules are **not** fully encoded in Blueprint CSS alone. Every Create ships helpers. **use them**:
`blueprint-app/src/patterns/consolePatterns.tsx` (`PageAlert`, `MetricPropertyBand`) and copy `DetailsPage.tsx` for list screens.

1. **Content width:** Console list / inventory pages use `BpContentRegion width="full" center={false} padded` so the page fills the column beside the service nav (not a narrow left strip). Keep Proto Hub `index.css` full-width helpers.
1b. **Service nav height:** Left `BpServiceNav` fills the viewport column under the header (Proto Hub `index.css` + shell stretch). Never let the rail stop after the last nav item.
2. **KPI metric band:** Prefer `<MetricPropertyBand items={[…]} />`. Equivalent: `<BpCard padding={false} style={{ width: "100%" }}>` + `<BpInline space="0" wrap style={{ width: "100%" }}>` of `BpCardProperty` with `hasRightSeparator` (omit on last). Each property needs `style={{ flex: "1 0 0", minWidth: 149, padding: "var(--space-300) var(--space-500)" }}`.
3. **Page-level notifications:** Prefer `<PageAlert … />`. Standalone Figma Notification is max-width 792px for component demos; page banners must span the content region (`width: "100%", maxWidth: "none"`). Keep `actionLabel` beside the title; no exclamation marks / “successfully”.
4. **Filters:** `BpSimpleFilters` + up to 4 `BpDropdown variant="underline"` as **direct** children. Keep Proto Hub `index.css` width:auto override (dropdown default is width 100%).
5. Prefer these Figma configs over the legacy Cloud Style Guide for React composition.


---

## BpCard

Blueprint plain card (Figma node `83788:97391`).
https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97391
Docs: https://styleguide.services.cloud.netapp.com/cards/Card#Plain%20Card

Usage guidelines:
- Set `header` to render a top card header section (typically `BpCardHeader`).
- Default body applies `--space-500` horizontal inset (`padding`, Figma Has padding). Do not add `paddingX` on inner wrappers.
- Use `padding={false}` for full-bleed metric bands. Use `hasRightSeparator` on `BpCardProperty` for column dividers.
- Use `type="flat"` for nested cards inside another card or panel.
- Use `bodyLayout="form"` for scrolling takeover forms.

---

## BpCardProperty

Blueprint card property (Figma node `83788:97620`).
https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97620

Use to show a property and value, with or without an icon.

Layout variants:
- `direction="horizontal"` (default): icon on the left, large value+unit above property text.
- `direction="compact"`: icon on the left, 14 px semibold value+unit above property text. Dense metric rows.
- `direction="vertical"`: icon above, medium value above property text. Suited for narrower layouts.

Display modes:
- Default: renders `value` at a prominent size with an optional `unit` suffix.
- Status mode: provide `statusTone` to render a notification icon + 14 px semibold value
  beside the optional 2-color icon. The `unit` prop is ignored in status mode.

---

## BpCardHeader

Blueprint card header (Figma node `83788:97581`).
https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97581

Usage guidelines:
- `size="default"` supports optional subtitle, media (logo/icon), and action slot.
- `size="compact"` renders a tight title-only header for dense card layouts.
- Figma design-only visibility toggles are value-driven in code: pass `subtitle`,
  `logo`, `icon`, and `actions` to render those sections.

---

## BpNotification

Figma node `85534:98447` (Notification).

Messaging guidance from Figma:
- Prefer direct, present-tense statements and include corrective action when possible.
- Keep actions separate from the message body. The action belongs beside the title.
- Avoid "successfully", "failed", exclamation marks, and embedded links.
- For object names, prefer semibold emphasis instead of quotes.

`aria-live` defaults to `"assertive"` for error and warning, and `"polite"`
for information and success. Pass `"off"` when the notification is already
represented in a labeled list.

---

## BpInlineNotification

Figma node `1519:11870` (Inline notification).

Usage guidance from Figma:
- Use for page/section-level contextual messaging.
- For error/warning, keep a semibold prefix label; keep body text as primary text color.

---

## BpSimpleFilters

Simple filters bar (Figma node `86422:42107`).

Renders a horizontal surface with a filter icon and "Filters" heading on the
leading side, a wrapping flex row of filter controls in the center, and an
optional Reset button on the trailing side.

Usage:
- Use simple filters at the top of a page to set the scope of an entire page via a series of dropdowns.
- Use up to 4 dropdowns.
- Use to switch among views, select a specific object to view, or change the type of content visible on the page.
- Pass `BpDropdown variant="underline"` controls as `children`.
- Provide `onReset` to reveal the Reset button; omit it to hide the button.
- The bar stretches to fill its container width. Set an explicit width on the
  parent when you need to constrain it.
- Do not mix `BpDropdown variant="field"` controls on the same bar. Use
  underline only in filter rows.

---

## BpTable

Typed data table driven by `data`, `columns`, and `getRowId`.

Default choice for resource lists. Use {@link BpTableShell} only when you need custom table markup
the column API cannot express. Agent guidelines: `docs/ai-table-guidelines.md` (MCP `guidelines-table`).
For designer handoffs that are **composed row frames** (not a Table ❇️ instance), start with
§ **Converting a designer frame to `BpTable<Row>`**. Storybook: Components/Table, Components/Table/Cells.

---

## BpDropdown

Blueprint Dropdown (Figma node `85088:11341`).

- Use when users pick from a known list in a form. Do not use for commands (`BpActionMenu`).
- `variant="field"` for standard forms; `variant="underline"` for dense layouts and filter
  rows. Pass `label` as a plain string so the trigger has an accessible name. Do not mix
  both variants on the same form without intent.
- Underline variant renders the label inline before the value (`Label: value`).
- Single select closes the menu after one choice; multi select keeps the menu open while
  toggling checkboxes. Use `actionMode` when changes should apply only on Apply.
- Multi-select defaults to `multiValueDisplay="chips"` (removable chips with `+N` overflow).
  Opt into `multiValueDisplay="summary"` for a short label or `{count} selected` on one row.
- Do not use `disabled` for read-only display. Use `readOnly` when the value must stay
  visible but not editable.
- Use `loading` when options depend on async data. Use `hasError` / `messageType="warning"`
  for validation and non-blocking guidance (do not combine error and warning).
- Add `searchable` when there are more than 10 options. Show `showSelectAll` only when
  relevant and the list has 6 or more items.
- Match dropdown width to the grid and expected content length. Keep copy in sentence case.
- Clicking outside an open single-select dropdown closes it.
- Keyboard: Space, Enter, or Arrow Up/Down on the trigger opens the menu and
  moves focus to the first item (or search field when `searchable`). Arrow Up/Down
  navigate items, Escape closes, Home/End jump to ends.
- Split trigger (clear button or chip display): the caret button is the labelled
  control for the field label and the keyboard entry to open the menu.
