# Blueprint layout for Proto Hub (one-shot)

Read this before building UI. Source: `@netapp/blueprint` agent `guidelines-layout`, with Proto Hub stylesheet rules applied.

# AI Layout guidelines

Blueprint layout for app pages is based on small, composable primitives instead of a monolithic `Layout.*` namespace.

Figma sources:
- Ready-to-use page layouts: [Blueprint. Components. Screen Shell (Ready layouts)](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=62106-14381) (`node 62106:14381`)
- Screen shell component set: `node 62106:14385` (Screen shell v2. Ready to use layouts ❇️)

Use this file when composing full app pages in Figma or React. Shell chrome, content regions, and which ready-to-use screen pattern to start from.

## Storybook and MCP

MCP: `guidelines-layout` · component: `components-layout` · Storybook: `Components/Layout` → **App Shell First Starter** · `Examples` → **Cards and table layout** (Figma `62106:14386`) · `Components/Header` → **Docs** (prototype), **Composed** (production) · `Components/Form` → **Scrolling form**, **Accordion-based form**

## Related guidelines

- [`ai-domain-guidelines.md`](./ai-domain-guidelines.md). ONTAP storage entity model for concept prototypes (MCP `guidelines-domain`)
- [`ai-tokens-guidelines.md`](./ai-tokens-guidelines.md). Semantic CSS tokens for custom layout and styling (MCP `guidelines-tokens`)
- [`ai-table-guidelines.md`](./ai-table-guidelines.md). Table pages inside `BpContentRegion(width="wide")`
- [`ai-card-guidelines.md`](./ai-card-guidelines.md). Dashboard card layouts and building blocks
- [`ai-chart-guidelines.md`](./ai-chart-guidelines.md). Line, bar, donut, and chart frame (MCP `guidelines-chart`)
- [`ai-form-integration.md`](./ai-form-integration.md). Field validation wiring and form library integration

## Why this approach

- Keeps fixed shell geometry in one place (top header + left nav offsets).
- Reduces hardcoded per-page breakpoints and spacing overrides.
- Keeps side panels docked beside main content via `BpSidePanelShell`.
- Improves consistency across dashboard, table, and form/wizard pages.

## Proto Hub stylesheet lock (overrides package docs)

## Core primitives

- `BpAppShell`: app chrome container with fixed header and optional left nav.
- `BpMainNav`: product-level navigation drawer opened from the header hamburger.
- `BpServiceNav`: service inner-page navigation inside `BpMainRegion`, with one optional expandable sub-level.
- `BpMainRegion`: main content scroll region under the app shell.
- `BpContentRegion`: width presets (`narrow`, `regular`, `wide`, `full`) and optional padding.
- `BpStack`: vertical flow spacing with token-based gaps.
- `BpInline`: horizontal rows/toolbars with wrapping and alignment controls.
- `BpResponsiveGrid`: card/content grid using native CSS Grid.
- `BpSidePanelShell`: docks a side panel beside main content.
- `BpSticky`: sticky rows that can use shell-aware top offset.
- `BpCenter`: centered loading or empty states.
- `BpFullPageError`: page-level failure panel with app-composed recovery actions.
- `BpPageShell`: route-level shell for pages outside the main app shell.
- `BpFormSection`: form section grouping with optional heading, description, and nested sub-sections.

## Form layout

Figma form layout ([Forms](https://www.figma.com/design/gHULaEjWAA66bkWHfWIenp/%F0%9F%92%8E-Pre-dev-components?node-id=7002-27737)) is **section → row → fields**:

- **`BpFormSection`**: top-level or nested section. Set `headingLevel="subsection"` for nested groups inside a parent section (replaces the removed Figma sub-section component).
- **Form row**: horizontal row of up to three fields. Not a separate export:

```tsx
<BpInline space="300" align="start" className="bp-form-row">
  <BpTextField label="Host" />
  <BpTextField label="Port" />
</BpInline>
```

Import `BpFormSection` to load `.bp-form-row` flex rules. Row gap is `--space-300` (24px); rows inside a section stack at `--space-450` (36px). Separate stacked sections with `<hr className="bp-form-section-divider" />`. Wrap horizontal radio groups in `BpFormSection.HighlightBand` when Figma shows a pale band.

**Shell patterns:**

- **Dialog** (`BpDialog`): one or more `BpFormSection` blocks in the dialog body.
- **Scrolling takeover**: `FormPageShell` or `BpContentRegion(width="narrow")` with `BpCard bodyLayout="form"` and stacked `BpFormSection` elements.
- **Accordion** (`BpAccordionCard`): accordion title is the section title. Do not repeat the same heading inside expanded content unless the body needs a sub-section.
- **Wizard**: `BpSticky` stepper + `BpContentRegion(width="narrow")` + `BpFormSection` per step. For full-page form takeovers, see `Components/Form` → **Scrolling form** and **Accordion-based form**.

Column-span grid (8/12-col) is not implemented in v1; use equal-width rows.

## App shell first

When an agent generates a new Blueprint app or route, start with `BpPageShell` + `BpAppShell` before adding page-specific content. The default shell includes:

- A top `BpHeader.Prototype` (hamburger opens `BpMainNav` when you pass `mainNavPanel`).
- Organization, project, and icon triggers are included by default on `BpHeader.Prototype`; production apps compose `BpHeader.Invocable` children on `BpHeader` instead (see [Production header](#production-header)).
- A `BpServiceNav` inside `BpMainRegion` for service inner-page navigation.
- A `BpContentRegion` beside `BpServiceNav` for page content composed inside `BpStack`, `BpInline`, tables, forms, panels, or cards as needed.

Do not invent app-level wrappers, custom fixed headers, or bespoke left navigation unless the product has an explicit exception. The shell owns fixed chrome offsets and responsive behavior; pages should focus on their content.

Shell breakpoints (not design tokens. `@media` cannot use CSS variables): **1024px** hides the app-shell left nav and narrows the header.

Copy-paste starter scaffold:

```tsx
import { useState, type ReactNode } from "react";
import {
  BpAppShell,
  BpContentRegion,
  BpHeader,
  BpInline,
  BpMainNav,
  BpMainRegion,
  BpPageShell,
  BpServiceNav,
  BpSkipLink,
  BpStack,
  type BpMainNavCategory,
  type BpServiceNavItemData,
} from "@netapp/blueprint";

const navCategories: BpMainNavCategory[] = [
  { id: "favorites", label: "Favorites" },
  { id: "home", label: "Home" },
  {
    id: "storage",
    label: "Storage",
    icon: "ic_object_storage",
    services: [
      { id: "systems", label: "Systems", description: "Manage storage systems." },
      { id: "volumes", label: "Volumes", description: "Review volume health and capacity." },
    ],
  },
];

const serviceNavItems: BpServiceNavItemData[] = [
  {
    id: "overview",
    label: "Overview",
    subItems: [
      { id: "dashboard", label: "Dashboard" },
      { id: "inventory", label: "Inventory" },
    ],
  },
  { id: "health", label: "Health" },
  { id: "configuration", label: "Configuration" },
];

export function BlueprintAppScaffold({ children }: { children: ReactNode }) {
  const [activeControlId, setActiveControlId] = useState<string | null>(null);

  return (
    <BpPageShell>
      <BpSkipLink />
      <BpAppShell
        header={
          <BpHeader.Prototype
            activeControlId={activeControlId}
            onActiveControlChange={setActiveControlId}
            mainNavPanel={
              <BpMainNav
                open={activeControlId === "main-nav"}
                onOpenChange={(open) => setActiveControlId(open ? "main-nav" : null)}
                categories={navCategories}
                activeCategoryId="storage"
                selectedServiceId="systems"
              />
            }
          />
        }
        content={
          <BpMainRegion>
              <BpInline wrap={false} space="0" style={{ alignItems: "stretch", width: "100%" }}>
                <BpServiceNav serviceLabel="Systems" items={serviceNavItems} selectedItemId="dashboard" />
                <BpStack grow space="0" style={{ minWidth: 0 }}>
                  <BpContentRegion id="bp-main-content" tabIndex={-1} width="full" center={false}>
                    <BpStack space="300">{children}</BpStack>
                  </BpContentRegion>
                </BpStack>
              </BpInline>
            </BpMainRegion>
        }
      />
    </BpPageShell>
  );
}
```

Keep `BpSkipLink` before `BpAppShell` so it is the page's first focusable control. Its default
target is `bp-main-content`; place that ID and `tabIndex={-1}` on the page-content container so
keyboard users bypass both the fixed header and service navigation.

Use `subItems` for one additional service-navigation level. Expansion is component-managed by
default; use `expandedItemIds` and `onExpandedItemIdsChange` when route state must control which
parents are open. Do not nest `subItems` again.

## Ready-to-use page layouts

Abstract trees for the ten variants on [Screen Shell (Ready layouts)](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=62106-14381). Pick the closest `Type=` variant in Figma (`node 62106:14385`) before inventing a page structure.

### Shared screen shell

Every ready-to-use layout uses the same app chrome. In React, start from the [app shell scaffold](#app-shell-first). **Do not repeat this tree in each example**. The per-layout schematics below show only the content slot (what Figma places inside `Content`, or the wizard frame when used).

```text
Screen shell v2
  +-- Browser + header     → BpHeader / BpHeader.Prototype
  +-- Nav+content
          +-- Left nav     → BpServiceNav
          +-- ↓ content slot ↓   (trees below start here)
```

Some patterns use a **Wizard frame** inside the content slot. Sticky stepper, scrollable body, footer actions. Figma label: `Wizard ✅`. Used for wizards, some overview pages, and accordion flows even when the body is not a linear step sequence.

```text
Wizard frame
  +-- Wizard + form bar    → BpSticky stepper / progress
  +-- ↓ body ↓             (wizard content slot. Trees may start here)
  +-- Footer               → primary + secondary actions (wizard placement)
```

### Layout picker

| Figma `Type=` | Use when | Content slot | Body (schematic root) |
| --- | --- | --- | --- |
| `table` | Resource list is the whole page | `Content (wide)` | Page title + table |
| `table+dashboard A` | KPI summary above a list | `Content (wide)` | Page title + dashboard card + table |
| `table+dashboard B` | Same as A with wayfinding | `Content (wide)` | Breadcrumbs + title + dashboard card + table |
| `overview` | Entity detail with side panel | Wizard frame | 2-column cards + tabbed list |
| `accordion A` | Stepped or committed accordion form | Wizard frame | Title block + single accordion group |
| `accordion B` | Multi-section settings on one page | `Content (narrow)` | Title block + multiple accordion groups |
| `wizard` | Linear multi-step flow | Wizard frame | Empty body slot + footer |
| `service landing page` | Pre-activation marketing for a service | `Content (full)` | Hero + benefit columns |
| `error` | Page failed to load | `Content (centered)` | `BpFullPageError` |
| `chart` | Metrics and analytics dashboard | `Content (wide)` | Metric rows + chart card pairs |

### Table (+ dashboard variants)

List-first page; add optional blocks for dashboard variants (`table+dashboard A` / `B` in picker).

```text
Content (wide)
  +-- [Breadcrumbs]                    ← dashboard B only
  +-- Page title
  +-- [Card / dashboard (KPI strip)]   ← dashboard A/B only
  +-- Table (column-based)
          +-- Table title + top controls
          +-- Columns + rows
          +-- [Pagination bar]
```

**React:** `BpContentRegion(width="wide")` → page title → `BpTable`. Dashboard A/B: add `<BpCard padding={false}>` with a `BpInline` property row (`hasRightSeparator` on cells) above the table; B adds `BpBreadcrumbs` first. Canonical example: `62106:14386`, Storybook `Examples` → **Cards and table layout**. Table cells: [`ai-table-guidelines.md`](./ai-table-guidelines.md).

### Overview

Two-column entity overview. Primary metrics and cards on the left, tabbed detail list on the right.

```text
Wizard frame
  +-- Wizard bar
  +-- Inline (2-column)
          +-- Left column (~60%)
                  +-- Card / dashboard
                  +-- Inline (2 card stacks)
                          +-- Stack → Card / info × 2
                          +-- Stack → Card / info × 2
          +-- Right column (~40%)
                  +-- Card (tabs + row list)
                          +-- Tab group
                          +-- Row × N (title + description)
  +-- Footer
```

**React:** approximate with `BpInline` + `BpCard` compositions; tabbed side panel may use `BpTabs` inside a `BpCard`. Footer actions follow wizard placement ([button guidelines](./ai-button-guidelines.md)). Card bodies: [`ai-card-guidelines.md`](./ai-card-guidelines.md).

### Service landing page

Marketing-style activation page. Not a data dashboard.

```text
Content (full)
  +-- Top (hero)
          +-- Inline
                  +-- Activation text
                          +-- Product title + slogan
                          +-- Body copy
                          +-- Primary button
                  +-- Hero illustration
  +-- Bottom (benefits row)
          +-- Benefit × 3
                  +-- Icon
                  +-- Title + text
```

**React:** compose with `BpStack`, `BpInline`, and `BpButton`; no `BpTable` or dashboard cards unless promoting live data.

### Chart

Analytics dashboard. Stacked metric bands and mixed chart cards.

```text
Content (wide, scrollable)
  +-- Page title
  +-- Stack
          +-- Card / dashboard row (compact metric blocks × 5)
          +-- Card / dashboard row (taller metric blocks × 5)
          +-- Inline row
                  +-- Bar chart card (wide)
                  +-- Horizontal graph card (narrow)
          +-- Inline row
                  +-- Horizontal graph card (narrow)
                  +-- Line chart card (wide)
```

**React:** `BpContentRegion(width="wide")` → `BpStack` of `BpCard` rows and `BpInline` chart pairs. Prefer `BpLineChart`, `BpHBarRow`, `BpStackedHorizontalChart`, and `BpDonutChart` inside cards ([`ai-chart-guidelines.md`](./ai-chart-guidelines.md)). Card shells: [`ai-card-guidelines.md`](./ai-card-guidelines.md).

Accordion and wizard-framed flows: [Form layout](#form-layout), [`ai-form-integration.md`](./ai-form-integration.md), `Components/Form` → **Scrolling form** / **Accordion-based form**. `wizard` and `error` types: see layout picker. Wizard uses [Wizard frame](#shared-screen-shell); error uses `BpContentRegion` + `BpCenter` + `BpFullPageError`.

### Slide-out side panel

`BpAppShell` -> `BpMainRegion` -> `BpSidePanelShell` with panel and main content. Put `BpSlideOutPanel` (header + scrollable body + footer chrome) in the `panel` slot; `BpSidePanelShell` owns docking beside the main region. The panel sits at the inline end (right), fills the region height, and its body scrolls while the header and footer stay fixed. Wire the panel's `onDismiss` to close the shell (`open={false}`). Footer actions follow dialog placement: solid primary matching the title verb, outline "Cancel" secondary; omit `primaryAction` to hide the footer.

**Width:** set `panelWidth` to any CSS length (default `"360px"`). For example `panelWidth="500px"`. Keep it comfortably narrower than the main region so page context stays visible; there are no column-named presets.

**Content type drives scrim and titling** (Figma [Slide-out panel guidelines](https://www.figma.com/design/gHULaEjWAA66bkWHfWIenp/%F0%9F%92%8E-Pre-dev-components?node-id=9031-291843)):

| Content | `scrim` | Title | Footer |
|---------|---------|-------|--------|
| Informational / drilldown | omit (page stays interactive; selecting another item can swap panels) | noun ("Policy 002") | optional; add `headerActions` to act on the object |
| Form or mixed | `scrim` (blocks navigation that would lose entered data) | verb phrase ("Add volume") | required primary + "Cancel" |

The `scrim` dims the main region and makes it inert, so pointer and keyboard users can't reach the content behind it. Focus moves into the panel when it opens and returns to the opener when it closes. Tab still reaches app chrome outside the shell (header, left nav); wrap the panel in a React Aria overlay if a flow needs a true focus trap.

**Dismiss:** wire `onDismiss` on the shell to the same state as the panel's own `onDismiss` so Escape and the header close control both close the panel. Clicking the scrim does not dismiss, so a form panel can't lose entered data to a stray click.

**Motion:** the panel slides in from the inline end as its column opens and back out as it closes (200 ms in, 150 ms out). Users who prefer reduced motion get the same open and closed states with no movement.

A closed panel stays mounted but inert, so leaving `BpSlideOutPanel` in the `panel` slot keeps its controls out of the tab order and the accessibility tree.

**Error handling:** show field-level errors with each input's `error` state. For a failed submit, show the API error with the standard notification pattern ([`ai-form-integration.md`](./ai-form-integration.md)) and keep the panel open so the user can retry.

## Responsiveness notes

- Prefer card grids with `auto-fit` / `minmax()` via `BpResponsiveGrid` over 12-column prop APIs.
- Keep app chrome offsets in shell-level CSS variables to avoid repeating padding/margin logic in each page.

## Theming notes


---

# Card guidelines (from agent docs)

# AI Card guidelines (`BpCard`)

Figma sources ([Blueprint. Components. Card page](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=1517-30476), `node 1517:30476`):
- Usage and types: [Cards](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97382) (`node 83788:97382`)
- Card atoms: [Card atoms](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97533) (`node 83788:97533`)
- Working with cards: [Working with cards](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97691) (`node 83788:97691`)
- Ready-to-use layouts: [Ready to use cards](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97765) (`node 83788:97765`) · component set [Card / Ready to use](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97771) (`node 83788:97771`)
- Card shell: [Card ❇️](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97391) (`node 83788:97391`)
- Card header: [Card / Header](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97581) (`node 83788:97581`)
- Card property: [Card / property](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97620) (`node 83788:97620`)
- Card split property: [Card / split property](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97668) (`node 83788:97668`)
- Card status property: [Card / status property](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97541) (`node 83788:97541`)
- Card logo: [Card / logo](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97684) (`node 83788:97684`)

Use this file when composing dashboard cards, summary tiles, or exploration prototypes. Cards group related metrics, status, or actions on overview pages. Not for primary navigation or long-form content.

## Storybook and MCP

MCP: `guidelines-card` · components: `components-card` · Storybook: `Components/Card` · `Components/Card/Layouts` (named stories mirror Figma ready-to-use types)

## Related guidelines

- [`ai-layout-guidelines.md`](./ai-layout-guidelines.md). Dashboard card grids, page shell
- [`ai-chart-guidelines.md`](./ai-chart-guidelines.md). Donut, horizontal rows, line, stacked, comparison
- [`ai-button-guidelines.md`](./ai-button-guidelines.md). Header actions, split-property CTAs
- [`ai-menu-guidelines.md`](./ai-menu-guidelines.md). Kebab / overflow actions in card headers
- [`icons.md`](./icons.md). 2-color icons for `BpCardProperty`
- [`ai-form-integration.md`](./ai-form-integration.md). `BpCard bodyLayout="form"` for scrolling takeover forms

## Body padding decision tree

The card shell applies `--space-500` (40px) horizontal inset on the body by default (`padding`, Figma **Has padding**). **Do not add `paddingX` on inner `BpStack` or `BpInline` inside a card body.**

```text
Full-bleed body (Figma Has padding=False)?
  YES → <BpCard padding={false}>. Use BpInline for horizontal metric rows
  NO  → <BpCard>. Shell owns horizontal gutter; use BpStack/BpInline for rhythm only

Column dividers between properties?
  → hasRightSeparator on BpCardProperty (omit on the last cell)
```

| Wrong | Right |
| --- | --- |
| `<BpCard><BpStack paddingX="500">…` | `<BpCard><BpStack space="300">…` |
| `<BpCard>…</BpCard>` with bare text flush to edges | `<BpCard><BpStack space="200">…` |
| `paddingX="300"` inside card body | omit. Not a card gutter token |
| Full-bleed band without opting out | `<BpCard padding={false}><BpInline …>` |
| Property row dividers on the card shell | `hasRightSeparator` on each `BpCardProperty` except the last |

Vertical sections: `BpStack space="300"`. Horizontal rows: `BpInline space="300"` with `hasRightSeparator` on property cells (omit on the last), or `BpInline space="300" wrap` without dividers. Equal columns: `style={{ flex: "1 0 0", minWidth: "149px" }}` on properties.

## Card types

| Figma | React | When |
| --- | --- | --- |
| Raised | `type="raised"` (default) | Top-level cards on page background |
| Flat | `type="flat"` | Nested cards inside another card, panel, or drawer |
| Banner | composition | Top banner image or art block + padded body below. Not a `BpCard` prop |

## Card anatomy

| Figma slot | React |
| --- | --- |
| Card ❇️ | `BpCard` |
| Card / Header | `header={<BpCardHeader … />}` |
| ↳ Content | `children` |
| Has padding | `padding` (default `true`) |
| Form takeover body | `bodyLayout="form"` |

## Building blocks

| Block | React | Notes |
| --- | --- | --- |
| Property (horizontal) | `BpCardProperty` | Large value + unit; hero metrics |
| Property (compact) | `BpCardProperty direction="compact"` | Dense rows; one variant per card |
| Property (vertical) | `BpCardProperty direction="vertical"` | Icon above value; 2-3 column bands |
| Split property | `BpCardSplitProperty` | Two related metrics + shared CTA |
| Key value stack | `BpKeyValuePairStack` + `BpKeyValuePair` | Titled key-value lists |
| Status tile | `BpCardStatus` | Tinted good/bad summary |
| Logo tile | `BpCardLogo` | Partner logo beside metrics |
| Donut chart | `BpDonutChart` | Part-to-whole beside split properties |

Property icons: 2-color set only. See [`icons.md`](./icons.md). Status mode: `statusTone` on `BpCardProperty` or `BpCardStatus` for health counts, not capacity.

Header: `size="default"` supports `logo`, `icon`, `title`, `subtitle`, `actions`. `size="compact"` is title-only. Status-in-header cards: pass a notification icon via `icon` or compose in `actions`.

## Ready-to-use catalog

Match the closest Layouts or Card story before inventing a layout. Named Layouts stories live under `Components/Card/Layouts`; component-level compositions under `Components/Card`.

### Layouts (`Components/Card/Layouts`)

| Figma type | Story | `padding` | Body root |
| --- | --- | --- | --- |
| Donut + split properties | `DonutWithSplitProperties` | default | `BpInline space="400" align="start"` + `BpDonutChart` + `BpCardSplitProperty` × 2 |
| Vertical properties | `VerticalProperties` | default | `BpInline space="300"` + `direction="vertical"` properties with `hasRightSeparator` |
| Horizontal properties | `HorizontalProperties` | default | `BpInline space="300" wrap` + properties (no separators) |
| Logo + properties | `LogoAndProperties` | default | `BpInline space="300"` + `BpCardLogo` (`borderRight`) + properties with `hasRightSeparator` |
| Compact properties + logo | `CompactPropertiesWithLogo` | default | `BpInline space="300"` + logo (`borderRight`) + `direction="compact"` properties with `hasRightSeparator` |
| Header + property stacks | `HeaderWithPropertyStacks` | default | `header` + `BpKeyValuePairStack` × 2 (card body column) |
| Compact header + status | `CompactHeaderWithStatus` | default | `header size="compact"` + `BpInline space="200"` + `BpCardStatus` × 2 |
| Blurb + link | `BlurbWithLink` | default | `BpStack space="200"` + text + `BpLink` |
| Nested flat cards | `NestedFlatCards` | default | `header` + `BpInline space="300" wrap` + `BpCard type="flat"` × 2, each with `BpInline space="300" wrap` + properties |

### Card (`Components/Card`)

| Pattern | Story | `padding` | Body root |
| --- | --- | --- | --- |
| Plain text blurb | `PlainTextContent` | default | `BpStack space="200"` + text + `BpLink` |
| Header + property row | `WithHeaderAndProperties` | default | `header` + `BpInline space="0"` + properties with `hasRightSeparator` |
| Header + actions + property stacks | `WithHeaderActionsAndPropertyStacks` | default | `header` (icon + actions) + `BpKeyValuePairStack` × 2 (card body column) |
| Compact header + status | `WithCompactHeaderAndStatus` | default | same as `CompactHeaderWithStatus` |

`Gallery` stories in both files combine the layouts above for visual comparison; prefer the named story when copying a pattern.

### Donut + split properties

```text
BpCard
  BpInline space="400" align="start"
    BpDonutChart
    BpCardSplitProperty × 2
```

### Header + side-by-side property stacks (Gallery variant)

The Layouts `Gallery` story places stacks in a row with a vertical rule between them:

```text
BpCard
  header={<BpCardHeader … />}
  BpInline space="0"
    BpKeyValuePairStack (borderRight + paddingRight)
    BpKeyValuePairStack (paddingLeft)
```

The named `HeaderWithPropertyStacks` story stacks them vertically in the card body column instead.

### Nested cards

```text
BpCard
  BpCardHeader
  BpInline space="300" wrap
    BpCard type="flat"
      BpInline space="300" wrap + properties
```

Limit nesting to one level on dashboards.

## Agent checklist

1. Pick a ready-to-use layout from a named Layouts or Card story ([Card / Ready to use](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=83788-97771), `node 83788:97771`).
2. Apply the **body padding decision tree**. Never `paddingX` inside card body.
3. Compose with `BpCard` and documented subcomponents only.
4. Use `padding={false}` only for full-bleed metric bands; use `hasRightSeparator` on properties for column dividers.
5. Use `type="flat"` for nested inner cards.
6. One property variant per card (`horizontal`, `compact`, or `vertical`).
7. Use `formatCapacityParts` / `formatThroughputParts` for metrics.


---

# Table guidelines (from agent docs)

# AI Table guidelines (`BpTable`)

Use this file when:

- **Building table screens in Figma** (row-composed frames from Blueprint library pieces).
- **Converting a designer's Figma frame into `BpTable<Row>` React code** (the usual product handoff).
- **Changing** `react/components/BpTable.tsx`, cell helpers, stories, tests, or `BpTable*.figma.ts`.

MCP: `guidelines-table` · component: `components-table` · Figma build skill: `blueprint-build-table`

## Related guidelines

- [`ai-layout-guidelines.md`](./ai-layout-guidelines.md). Page shell and `BpContentRegion(width="wide")`
- [`ai-button-guidelines.md`](./ai-button-guidelines.md). Toolbar and in-cell CTAs
- Storybook: `Components/Table` (**PaginationGuidelines**, **With Selection**, **HorizontalScroll**, column sizing stories); cells: `Components/Table/Cells`

## Blueprint library nodes (`vNPUEtCuR4Enwhz1ZeTdQE`)

| Piece | Node |
| --- | --- |
| Row set (Prolog / Columns / Epilog) | `81906:142571` |
| Row-based ready-to-use assembly | `81906:142697` |
| Column-based ready-to-use assembly | `81906:142284` |
| Table column catalog | `81906:142956` |
| Header / content / tree cells | `81906:141968`, `81906:141712`, `81906:142135` |
| Title + top controls / upper actions | `81906:142877`, `81906:142919` |
| Bulk actions / pagination / empty / scroller | `81906:142884`, `81906:142738`, `81906:142896`, `81906:142735` |
| Expand view | `81906:142712` |
| Filters / column selector | `80458:40459`, `80458:40481`, `80458:40555` |
| Tabs above table | `80655:45534`, `80655:45745` |
| Docs frames (loading, filter tags) | `81906:144589`, `81906:145600` |

Deprecated: monolithic Table ❇️ `1172:25933`. Pre-dev-only docs: cell catalog `4415:35275`, behavior WIP `4664:17858`.

---

## Building tables in Figma

Designers usually ship a **composed frame**, not an instance of `Table - column-based ❇️` or the deprecated Table set.

Typical structure:

```
{Resource} table (frame)
├── Table / Supporting components / Table title + top controls
├── Header row          ← one row instance, State=Header
├── Content
│   └── {Resource} row × N   ← mock data rows, State=Default
├── Bulk actions row    (optional)
└── Pagination bar      (optional)
```

Each **row** uses **Prolog → Columns → Epilog** (`81906:142571`):

| Row region | Figma content | Notes |
| --- | --- | --- |
| **Prolog** | Selection checkbox header/cell | Do not add as a data column |
| **Columns** | Header cells + content cells (`81906:141968` / `81906:141712`) | One cell **Type** per column, same type in every row |
| **Epilog** | Column selector, expand arrow, actions kebab, or empty | Fixed-width trailing column |

**Figma rules:**

- Use library instances (`Table / …` names), not redrawn cells.
- All body cells in a column share the same content-cell **Type**.
- Mock **7-10 rows** for layout; pagination copy reflects full dataset size (default page size **50**).
- Tabs belong **above** the table (`Tab group ❇️`), not inside it.
- For step-by-step Figma creation, use the **`blueprint-build-table`** skill (`designer-agent/skills/blueprint-build-table`).

---

## Figma ↔ code mapping

| Figma piece | Code |
| --- | --- |
| Repeating row instances + header row | `BpTable<Row>` with `data` + `columns` + `getRowId` |
| Table title + top controls | `name` + `totalCount` (+ `visibleCount`, `titleMode`, count props) + `details` + `toolbar={<BpTableUpperActions />}` |
| Table header cell | `column.header` + `sortable` / `filterable` / `isResizable` + optional `width` / `minWidth` |
| Table content cell `Type` | Return from `column.render` (`BpTableCell.*` helpers) |
| Prolog checkbox | `selection`. **not** a `columns[]` entry |
| Epilog column-selector icon | `columnSelector` |
| Epilog expand arrow | `expansion` |
| Epilog actions / kebab | `actionsColumn: true` column or `id: "actions"` |
| Bulk actions row | `bulkActions` (with `selection`) |
| Pagination bar | `pagination` (caller fetches pages) |
| Empty table message | `emptyState` or `data={[]}` |
| Horizontal scroller | `horizontalScrollbar`. `"auto"` (default) or `"always"` |
| Tab group above table | `BpTabGroup` sibling above `BpTable` |
| Horizontal fixed columns | **Not implemented**. App-level layout only |

**Column-based catalog (`81906:142956`):** designers stack `Table column` instances vertically; in code each column is one `BpTableColumn`. Same cell-type rules apply.

---

## Code → Figma (BpTable → Figma)

Load and follow the **`blueprint-build-table`** skill (`designer-agent/skills/blueprint-build-table`). Do **not** start from `Table - column-based ❇️` (`81906:142284`); reshaping that instance causes stale IDs, detach loops, and `setProperties` failures on nested cells.

Quick mapping from `BpTable` props:

| React | Row set / assembly |
| --- | --- |
| `columns` | One `Table cell` per column in the row set (`Type=Text`, `Status`, `Link`, …) |
| `selection` | Include Prolog checkbox cell; omit if prop absent |
| `columnSelector` | Include Epilog column-selector; omit if prop absent |
| `actionsColumn` / `id: "actions"` | Include Epilog action cell |
| `pagination` | Include `table pagination ❇️` instance in the assembly |
| `name` / `totalCount` | Set `Full top section` title text (e.g. `"Systems (4)"`) |

Set cell label text with `label.characters` after `loadFontAsync` on that text node. `setProperties` on cells inside a `ComponentNode` definition silently no-ops.

---

## Converting a designer frame to `BpTable<Row>`

When the handoff is a frame like [Volumes table (example)](https://www.figma.com/design/87PJ4advlGflu1MiAId6SH/Untitled?node-id=7-2535), collapse it into **one** typed `BpTable`. Do not transcribe each row as React markup.

### 1. Recognize the target

Use **`get_metadata`** on the frame to list child instance names; map each piece with **Figma ↔ code mapping** above. Use **`get_screenshot`** or inspect one body row for cell types. Ignore row count when coding. Visible rows are mock data.

### 2. Extract columns

1. **Header row**. Read visible **column title text** (not Figma layer names like `Name` or `Text`).
2. **One body row**. For each column, read the nested `Table content cell` **Type** (Link, Badge, Text, Action, …).
3. **Header chrome**. Sort/filter icons on a header → `sortable` / `filterable` on that column.
4. Define a **row type** from data semantics (`Volume`, `capacity: number`, etc.), not from Figma layer names.

Canonical code reference: `react/components/BpTable.stories.shared.tsx` (`Volume`, `volumeColumns`, `SERVER_DRIVEN_PAGINATION_SOURCE`). Layout shell: `react/examples/layout-dashboard-table/index.tsx` (Storybook **Examples → Cards and table layout**).

### 3. Assemble props

Wire props from **Figma ↔ code mapping**; copy the full assembly from `SERVER_DRIVEN_PAGINATION_SOURCE` in `react/components/BpTable.stories.shared.tsx`.

### 4. MCP anti-patterns (do not ship)

- A `VolumesRow` (or similar) component per Figma row instance.
- `BpTableShell` + hand-authored `<thead>` / `<tbody>` when `BpTable` fits.
- Checkboxes in `column.render` for row selection (use `selection`).
- Column selector as a normal data column (use `columnSelector`).
- Hardcoding mock rows from Figma as static JSX.
- Tailwind/flex layout copied from `get_design_context` row export.
- Client-side pagination inside `BpTable` when the product is server-driven.

---

## Code: usage and minimum wiring

- Use **`BpTable`** for data-driven resource lists.
- Use **`BpTableShell`** only when the column API cannot express required markup.
- Do not build parallel table abstractions or raw `<table>` + custom CSS when `BpTable` covers the scenario.

```tsx
import { BpTable, type BpTableColumn } from "@netapp/blueprint";

type Row = { id: string; name: string };

const columns: BpTableColumn<Row>[] = [
  { id: "name", header: "Name", render: (row) => row.name },
];

<BpTable<Row>
  data={rows}
  columns={columns}
  getRowId={(row) => row.id}
  name="Resources"
  totalCount={500}
  details="Optional description line."
/>
```

- Prefer **`name`** with count props (`totalCount`, `visibleCount`, `titleMode`, `filtersCount`) so the heading composes from table state. Search, filters, and row selection update the title automatically (Figma Table title modes).
- Use **`title`** only to override the composed heading entirely (custom copy or one-off demos). A static `title` blocks live updates. Do not use it on tables with `selection`, active filters, or search.
- Prefer `<BpTable<Row>>` explicitly.
- `getRowId` must return a stable string per row.
- Column `id` values should match sort/filter state keys.

**Page layout:** `BpAppShell` → `BpMainRegion` → `BpServiceNav` + `BpContentRegion(width="wide")` → table. KPI strips and page chrome stay **outside** `BpTable`.

---

## Cell content (`column.render`)

`BpTable` wraps `column.render` in `<td>`. Do not wrap every cell in bare `<BpTableCell>` unless using `BpTableShell`.

| Figma content cell `Type` | Code pattern |
| --- | --- |
| Text / Link | Plain text, `BpLink`, or `BpTableCell.CopyText` |
| Badge / Status / Tag | `BpColorBadge`, `BpNotificationIcon`, `BpTag` |
| List | `BpTableCell.List` |
| Primary / Secondary CTA | `BpTableCell.Cta` / `.SecondaryCta` (one secondary per row; not with actions kebab) |
| Checkbox in body | `BpCheckbox` only for per-row toggles. **not** row selection (`selection` handles that) |
| Radio / Toggle / Icon | `BpStandaloneRadioButton`, `BpToggle`, icon button. Usually `actionsColumn: true` |
| Action menu | `BpTableCell.Actions`. `actionsColumn: true` or `id: "actions"` |
| Tree | `BpTableCell.Tree` (`level` 1-4) |
| Empty | `BpTableCell.Empty` (`-`) |

Truncate long values; tooltip on hover for full text. Per-type snippets: Storybook `Components/Table/Cells`.

---

## Column width and resizing

| Goal | Configuration |
| --- | --- |
| Content-sized | Omit `width`, `minWidth`, `isResizable` |
| Fixed width | `width: 160` or `"160px"` on **every** data column |
| Resize floor | `minWidth` (default floor 80px when resizing) |
| User-resizable | `isResizable: true` + `width` for starting size |
| Horizontal scroll | `minWidth` on enough columns to exceed the container + `horizontalScrollbar` |

**Fixed layout is all-or-nothing.** The table uses `table-layout: fixed` only when every data column
declares a `width` (or after a resize commits pixel widths). Give a partial set of columns a `width`
and the table stays in auto layout: those `width` values act as soft hints and the unsized columns
size to content. So either width every column (for a strict grid) or none (for content sizing) -
don't width just one. `minWidth` alone never triggers fixed layout; use it for content-sized columns
that need a floor, including horizontal-scroll tables.

No `maxWidth` on columns; no percentage widths with resize; no sticky columns in the library.

---

## Sort, filter, selection, pagination, states

**Sort / filter:** controlled `sort` + `onSortChange`, `filters` + `onFiltersChange`. Header click cycles sort. Filter popover is app-owned; tag filters use `BpTableFilterTagsColumn`. Reset page to `1` when sort/filter/search changes.

**Selection / bulk:** `selection` injects the checkbox column; pair with `bulkActions`. Use `name` + `titleMode` + count props (`visibleCount`, `totalCount`, `filtersCount`). Not a static `title`. So the heading shows segments like `Selected rows (N)` when rows are selected.

**Pagination:** `BpTable` does not fetch. Caller owns page state; pass one page as `data`. `start` / `end` are 1-based indices into the **full** dataset. Omit `pagination` when `total ≤ 50`. See **PaginationGuidelines** story.

**Empty / loading:** `"no-data"` / `"no-results"` / `"error"` / custom `emptyState` node; `isLoading` for fetch.

**Other props:** `rowHeight`, `surface="inner"`, `stickyHeader` + `maxHeight`, `columnSelector`, `columnOrder`, `visibleColumnIds`, `columnWidths`, `expansion`, `onRowClick`.

---

## Column preferences persistence

`BpTable` does not write to `localStorage`. Column order, visibility, sort, filter, and resize state are controlled props. Persist them in the app keyed per table (for example `"console.volumes"`).

Use `parseBpTablePreferences` and `reconcileBpTablePreferences` from `@netapp/blueprint` to load JSON safely and merge saved ids with the current `columns` definition (new columns append, removed ids drop, required columns stay visible).

**Reference:** Storybook **ColumnPreferencesPersistence** (Components/Table) shows the full controlled-props + `localStorage` pattern. API details: JSDoc on `parseBpTablePreferences` and `reconcileBpTablePreferences` in `BpTablePreferences.ts`.

**Filter values** in the blob are app-defined. Use JSON-serializable shapes only; validate semantics after restore.

**Out of scope for preferences:** pagination, row selection, expansion.

---

## What not to build

- Horizontal fixed columns (library gap. App layout only).
- Server pagination with client-side slicing inside `BpTable`.
- Multiple secondary CTAs or secondary CTA + actions kebab in one row.
- Raw hex colors or hard-coded pixel spacing. Use semantic tokens.
- Per-row React components mirroring Figma row instances.

**Library maintenance only:** sub-components have `BpTable*.figma.ts`; full table is a composition recipe in `BpTable.figma.ts`. After `.figma.ts` edits run `npx figma connect parse --dry-run`.

**Tokens / a11y:** production apps load `css`; exploration prototypes load `prototype`; use `tokens.css` only for token-only or incremental setups. Library strings use `blueprintT`. RAC popovers (`BpTableCell.Actions`, `.List`). Query with `screen.*` in tests.


---

# Domain guidelines. ONTAP / Console (from agent docs)

# AI Domain guidelines (ONTAP storage)

Use this file when building **exploration prototypes** for NetApp ONTAP storage administration-clusters, storage VMs, volumes, network interfaces, LUNs-in NetApp Console or ONTAP System Manager.

MCP: `guidelines-domain` · layout: `guidelines-layout` · tables: `guidelines-table`

## When to load

Load this doc (MCP `guidelines-domain`) before generating UI when the prototype involves storage, ONTAP, Console, System Manager, or domain terms such as cluster, SVM, storage VM, volume, LIF, or LUN.

## Workflow

1. **Resolve the term**. Grep the entity catalog below for the user's term (aliases include storage VM, SVM, vserver).
2. **Read matching entity blocks only**. Do not load unrelated entities.
3. **Walk relationships**. For detail pages, include child entities as tables using each child's list columns.
4. **Derive sections**. Use key attributes for overview; use detail sections and children for the rest.
5. **List the plan**. Sections, tables, and sample row values **before** generating UI.

For approved terminology, grep `netapp-write` `terms.md` on demand (never load the whole file).

## External references

- [NetApp agent personality](https://github.com/NetApp/agent-personality/blob/main/docs/netapp-personality.md)
- [ONTAP documentation](https://docs.netapp.com/ontap/)

## Entity catalog (embedded)

# ONTAP storage entities

Prototype-oriented object model for NetApp ONTAP storage administration in
NetApp Console and ONTAP System Manager. Use when building concept prototypes,
mockups, or briefs that involve clusters, storage VMs, volumes, or SAN resources.

## How to load

1. Resolve the user's term to an entity id by grepping **Names / aliases** or
   `^## ` headers in this file.
2. Read only the matching entity block(s) and related parent/child blocks.
3. Do not load the entire file into context if you only need one entity.

For approved product terminology, grep `skills/netapp-write/references/terms.md`
(on demand. Never load the whole file).

---

## cluster

| Field | Value |
| --- | --- |
| **Names / aliases** | cluster, ONTAP cluster, storage system, system |
| **Definition** | A set of nodes running ONTAP as a single management and failover unit. Top-level scope for System Manager; inventoried under Console Storage → Management. |
| **Parent** |. (top-level in System Manager; under organization/project in Console) |
| **Children** | `audit log`, `broadcast domain`, `consistency group`, `disk shelf`, `event`, `export policy`, `feature`, `IPspace`, `job`, `license`, `network interface`, `node`, `port`, `replica`, `replication policy`, `role`, `schedule`, `SnapMirror relationship`, `snapshot`, `snapshot policy`, `storage availability zone`, `storage VM`, `subnet`, `system alert`, `user`, `volume` |
| **Key attributes** | name, UUID, name servers, cluster peer, tags, management interfaces, version, personality, date and time |
| **Other attributes** | DNS domains, NTP servers, location, settings card properties |
| **Detail sections** | Overview (health, version, nodes), capacity summary, nodes table, storage VMs table, local tiers summary |
| **List columns** | Name, state, ONTAP version, node count, used/total capacity |
| **Console path** | Storage → Management → Systems (or Fleets, depending on product surface) |
| **System Manager path** | Dashboard (cluster scope) |
| **Typical actions** | add cluster (Console), setup, update, upgrade ONTAP, view alerts, add/remove node, rename, edit, add peer cluster |
| **Other actions** | enable/disable AutoSupport, enable/disable automatic updates, add subnet, add/edit/delete NVMe subsystems |

---

## node

| Field | Value |
| --- | --- |
| **Names / aliases** | node, controller, HA pair member |
| **Definition** | A combination of a controller, its storage, network connectivity, and the instance of ONTAP running on the controller, which is part of a high-availability (HA) pair within a cluster. |
| **Parent** | `cluster` |
| **Children** | `local tier`, `network interface`, `port` |
| **Key attributes** | name, serial number, management IP address, uptime, system ID, service processor subnet mask, service processor (manual / DHCP), utilization, SnapLock compliance clock, service processor IP address |
| **Detail sections** | Overview, HA status, local tiers on node, capacity, hardware summary |
| **List columns** | name, state, type, HA partner, used/total capacity |
| **Console path** | Storage → Management → [System] → Nodes |
| **System Manager path** | Hardware → Nodes |
| **Typical actions** | take over/giveback (HA), view hardware inventory, edit service processor, rename |

---

## storage VM

| Field | Value |
| --- | --- |
| **Names / aliases** | storage VM, SVM (shorthand), vserver (CLI and REST legacy name) |
| **Definition** | A virtual machine running within ONTAP that provides storage and data services to clients. A logical storage object in ONTAP software. |
| **Parent** | `cluster` |
| **Children** | `bucket`, `consistency group`, `export policy`, `initiator group`, `LUN`, `namespace`, `network interface`, `replication policy`, `role`, `SMB share`, `SnapMirror relationship`, `snapshot`, `snapshot policy`, `subsystem`, `user`, `volume` |
| **Key attributes** | name, state, IPspace, enabled protocols (NFS, SMB, iSCSI, FC, NVMe), capacity used/available |
| **Detail sections** | Overview (state, cluster, protocols), capacity summary, network interfaces table, volumes table, LUNs table (if SAN) |
| **List columns** | name, state, cluster, protocols, used/total capacity |
| **Console path** | Storage → Management → [System] → Storage VMs |
| **System Manager path** | Storage → Storage VMs |
| **Typical actions** | start, stop, create, edit, delete, configure NFS protocol, configure SMB, configure iSCSI, configure FC, configure NVMe |
| **Other actions** | add, change login banner message, configure S3, add/remove NIS setting, add/remove DNS, add/remove export policies, add/delete/renew local certificate authorities, edit snapshot policies, add/edit/delete users, enable/disable activity tracking for new volumes, add/remove LDAP servers, create/delete UNIX users and groups, enable/disable efficiency policies, enable/disable anti-ransomware for new volumes, add/remove/edit replication policies, edit name service switch, add/remove name mappings, enable/edit/disable multi-admin approval, add/remove/edit QoS policies, add/edit/delete roles, add/edit/delete NVMe subsystems, enable/disable analytics for new volumes, add/remove Kerberos realms, create/delete Windows users and groups, add/delete/renew client/server certificates, add/remove snapshot policies, change anti-ransomware event severity, add/remove/renew trusted certificate authorities, generate CSR |

---

## local tier

| Field | Value |
| --- | --- |
| **Names / aliases** | local tier, aggregate (legacy), aggr (CLI legacy) |
| **Definition** | Pool of disks on a node that provides physical storage for SVM volumes. Preferred product term; replaces "aggregate" in UI. |
| **Parent** | `node` |
| **Children** | `disk`, `volume` |
| **Key attributes** | name, status, type, IOPS, throughput, latency, used in cloud, data reduction, flash pool, capacity available |
| **Other attributes** | used %, encryption status, capacity used, logical used, RAID, SnapLock, total capacity, mirror, fabric pool, capacity committed |
| **Detail sections** | Overview, capacity, disks, RAID groups, volumes summary |
| **List columns** | name, state, type, node, used/total capacity |
| **Console path** | Storage → Management → [System] → Local tiers |
| **System Manager path** | Storage → Local tiers |
| **Typical actions** | offline, online, create, add disks, delete, add capacity, enable/disable mirror, rename |
| **Other actions** | edit RAID config, edit RAID type, edit RAID group size, add |

---

## volume

| Field | Value |
| --- | --- |
| **Names / aliases** | volume, FlexVol, FlexGroup, file system (informal) |
| **Definition** | A logical storage container in ONTAP that offers flexibility in managing data, allowing for expansion, contraction, movement, and efficient copying. FlexGroup volumes are scale-out NAS containers in ONTAP designed for nearly infinite capacity and predictable, low-latency performance for metadata-heavy workloads. |
| **Parent** | `cluster`, `local tier`, `storage availability zone`, `storage VM` |
| **Children** | `LUN`, `Qtree`, `SMB share`, `SnapMirror relationship`, `snapshot` |
| **Key attributes** | name, mount path, status, type, capacity, IOPS, throughput, latency, NFS access IP addresses, quota |
| **Other attributes** | backup to cloud, creation time, storage efficiency policy, available capacity %, maximum files, space reservation, local protection, snapshot used, autocommit files, tags, file system monitoring, activity status, SMB access IP addresses, storage efficiency, SnapLock expiration date, Autonomous Ransomware Protection status, snapshot directory visible to clients, data retention periods (minimum, maximum, default), analytics status, SnapLock type, encryption, remote protection, fractional reserve %, available capacity, used files, FlexGroup balance status, number of directories, is audit volume, number of files |
| **Detail sections** | Overview, capacity, export/share (NFS/SMB), snapshots summary, LUNs (if SAN), protection/replication status |
| **List columns** | name, state, SVM, size, used, style |
| **Console path** | Storage → Management → [System] → Volumes (or via SVM detail) |
| **System Manager path** | Storage → Volumes |
| **Typical actions** | create, resize, clone, delete, edit, rename, protect, snapshot, move, take offline/online |
| **Other actions** | edit export policy, enable/disable performance limits, enable/disable analytics, change UNIX permissions, enable/disable anti-ransomware, change security type, enable/disable background deduplication, enable/disable inline compression, change snapshot reserve, enable/disable snapshot schedule, change snapshot policy, enable/disable activity tracking, manage tags, enable/disable quota, enable/disable auto-delete snapshot, enable/disable snapshot locking, enable/disable show snapshot directory to client |

---

## LUN

| Field | Value |
| --- | --- |
| **Names / aliases** | LUN, logical unit |
| **Definition** | A storage target device within a SAN environment, typically accessed through the SCSI protocol or its derivatives, used to identify a logical unit such as a logical disk. |
| **Parent** | `consistency group`, `local tier`, `storage availability zone`, `storage VM`, `volume` |
| **Children** | `SnapMirror relationship`, `snapshot` |
| **Key attributes** | name, description, serial number, path, status, size, IOPS, throughput, latency, used size |
| **Other attributes** | SnapMirror status, backup to cloud status, QoS policy group, snapshot status, capacity available %, mapped to initiators, space reservation, snapshot policy, LUN format |
| **Detail sections** | Overview, size, maps to igroups, containing volume and SVM |
| **List columns** | name, size, state, SVM, volume, mapped |
| **Console path** | Storage → Management → [System] → LUNs (or via SVM detail) |
| **System Manager path** | Storage → LUNs |
| **Typical actions** | create, add, delete, edit, rename, resize, clone, protect, map/unmap initiator groups, take offline/online |
| **Other actions** | map, unmap, change capacity, enable/disable space allocation, add related LUNs, enable/disable thin provisioning, move, change description |

---

## namespace

| Field | Value |
| --- | --- |
| **Names / aliases** | namespace, NVMe namespace |
| **Definition** | A quantity of non-volatile memory formatted into logical blocks and presented to hosts over NVMe. An NVMe namespace is analogous to a LUN for FC and iSCSI protocols. |
| **Parent** | `storage VM`, `subsystem` |
| **Children** |. |
| **Key attributes** | name, path, status, storage VM, IOPS, throughput, latency, host OS, subsystem, available capacity |
| **Other attributes** | namespace ID, snapshots enabled/disabled, available capacity %, total capacity, performance service level |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | clone, add related namespace, delete, change subsystem, change capacity |

---

## bucket

| Field | Value |
| --- | --- |
| **Names / aliases** | bucket, S3 bucket |
| **Definition** | A container of objects in an S3 server. Each bucket defines an object namespace; clients specify objects using a bucket name and object name pair. |
| **Parent** | `SMB share`, `storage VM` |
| **Children** | `SnapMirror relationship`, `snapshot` |
| **Key attributes** | name, path, size, capacity, number of lifecycle rules, backup to cloud status, object locking, snapshot status, versioning state, capacity used |
| **Other attributes** | QoS policy group, SnapMirror status, access type, permissions |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | add, delete, edit, protect, edit capacity, manage lifecycle rules, add snapshot, enable/disable versioning |
| **Other actions** | enable/disable local protection, enable/disable performance limits and QoS policy, add/delete snapshots, change snapshot policy, add/edit/remove permissions |

---

## Qtree

| Field | Value |
| --- | --- |
| **Names / aliases** | Qtree |
| **Definition** | A subdivision of a flexible volume in ONTAP that allows more granular management of storage resources, including quotas, security settings, and SMB oplocks. |
| **Parent** | `volume` |
| **Children** | `SnapMirror relationship` |
| **Key attributes** | name, mount path, type, IOPS, throughput, security style, space usage, user group, file usage, user |
| **Other attributes** | space usage limit, file usage limit |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | delete, edit user, edit name, edit export policy, edit user group, edit security style, edit, add |

---

## network interface

| Field | Value |
| --- | --- |
| **Names / aliases** | network interface, interface, LIF, logical interface, data LIF, management LIF |
| **Definition** | IP address endpoint on an SVM or node for client or management traffic. Roles include data, management, intercluster, and node management. |
| **Parent** | `cluster`, `IPspace`, `node`, `port`, `subnet`, `storage VM` |
| **Children** |. |
| **Key attributes** | address, at home, interface type, subnet mask, protocols, service policy, throughput, status, name |
| **Detail sections** | Overview, IP address configuration, failover policy, routing (if applicable) |
| **List columns** | name, IP address, state, role, home node, SVM |
| **Console path** | Via SVM or system network inventory |
| **System Manager path** | Network → Network interfaces (or SVM → Network interfaces) |
| **Typical actions** | create, delete, edit, migrate, up/down, enable/disable, change name, change IP address, change service policy, add |
| **Other actions** | change subnet mask |

---

## port

| Field | Value |
| --- | --- |
| **Names / aliases** | port, network port |
| **Definition** | A physical or virtual Ethernet network device. Physical ports can be combined into link aggregation groups or divided into VLANs. |
| **Parent** | `broadcast domain`, `cluster`, `node` |
| **Children** | `network interface` |
| **Key attributes** | name, type, protocol, enabled/disabled, throughput, MTU, speed, WWPN, data link rate, topology |
| **Other attributes** | port address |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | add to broadcast domain, create network interfaces on it, enable/disable |

---

## subnet

| Field | Value |
| --- | --- |
| **Names / aliases** | Subnet |
| **Definition** | A segment of a network that allows you to allocate specific blocks, or pools, of IP addresses for your ONTAP network configuration, making the management of IP addresses easier and the creation of Logical Interfaces (LIFs) simpler by specifying a subnet name instead of individual IP address and subnet mask values. |
| **Parent** | `cluster` |
| **Children** | `network interface` |
| **Key attributes** | gateway, IP address usage, subnet, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | change subnet mask, change gateway, change IP addresses, delete, change name, change subnet IP address |

---

## IPspace

| Field | Value |
| --- | --- |
| **Names / aliases** | IPspace |
| **Definition** | A distinct IP address space in which storage virtual machines (SVMs) reside, allowing a single ONTAP cluster to be accessed by clients from multiple administratively separate network domains with overlapping IP address subnets, while maintaining separate routing tables for each SVM within an IPspace to ensure privacy and security. |
| **Parent** | `cluster` |
| **Children** | `network interface` |
| **Key attributes** | type, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | add/remove broadcast domain, delete, rename |

---

## broadcast domain

| Field | Value |
| --- | --- |
| **Names / aliases** | broadcast domain |
| **Definition** | A set of network ports in the same IPspace that have layer 2 reachability to one another, typically including ports from multiple nodes in the cluster. |
| **Parent** | `cluster` |
| **Children** | `port` |
| **Key attributes** | MTU, type, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | change IPspace, delete, add/remove ports, change name, change MTU |

---

## initiator group

| Field | Value |
| --- | --- |
| **Names / aliases** | initiator group, igroup |
| **Definition** | A table of FC host World Wide Port Names (WWPNs) or iSCSI host node names that defines which initiators can access specific LUNs on the storage system. |
| **Parent** | `storage VM` |
| **Children** |. |
| **Key attributes** | connection status, protocol, SVM, mapped LUNs count, parent igroup, portset, type, description, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | add, delete, edit, change name, change description, add/remove initiator, map existing LUNs, replicate, configure host proximity |
| **Other actions** | change host OS, add new LUNs, add to another initiator group |

---

## host

| Field | Value |
| --- | --- |
| **Names / aliases** | host |
| **Definition** | A client computer that accesses storage over SAN or NVMe protocols. Host inventory groups initiators, host OS, proximity settings, and mapped storage units for a single client. |
| **Parent** | `initiator group`, `subsystem` |
| **Children** |. |
| **Key attributes** |. |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | change description, change host proximity, map existing storage units, replicate configuration, add new storage units, add initiators (iSCSI and FC), delete, change OS, change name |

---

## subsystem

| Field | Value |
| --- | --- |
| **Names / aliases** | subsystem, NVMe subsystem |
| **Definition** | An NVMe subsystem maintains configuration state and namespace access control for a set of NVMe-connected hosts. It is analogous to an initiator group for FC and iSCSI protocols. |
| **Parent** | `storage VM` |
| **Children** | `namespace` |
| **Key attributes** | host NQN count, capacity % available, target subsystem NQN, host OS, total capacity, namespace, SVM, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | add/edit/delete host NQNs |

---

## export policy

| Field | Value |
| --- | --- |
| **Names / aliases** | export policy |
| **Definition** | A set of export rules that control NFS client access to volumes and qtrees. Export rules match client requests against configured parameters to grant or deny access. |
| **Parent** | `cluster`, `storage VM` |
| **Children** |. |
| **Key attributes** | number of rules, ID, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | edit a rule, change rule sequence, add/remove rules |

---

## SMB share

| Field | Value |
| --- | --- |
| **Names / aliases** | SMB share, CIFS share (legacy) |
| **Definition** | A named access point in a volume that lets SMB clients access data on a CIFS server. |
| **Parent** | `storage VM`, `volume` |
| **Children** | `bucket` |
| **Key attributes** | name, path, description, SVM, volume, encryption, symbolic links, continuously available, access based enumeration, allow clients to access snapshot directory |
| **Other attributes** | home directory, SMB access IP addresses, enable change notify, oplock status, share access control, access permission |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | delete, edit, change description, assign S3 protocol access, enable/disable encrypt data while accessing share, add/remove access permission for a user or group |
| **Other actions** | change symbolic links type, enable/disable oplock, enable/disable allow client access to snapshot directory, enable/disable access based enumeration, enable/disable continuous availability, enable/disable change notifications |

---

## snapshot

| Field | Value |
| --- | --- |
| **Names / aliases** | snapshot |
| **Definition** | A read-only, point-in-time image of a volume. |
| **Parent** | `bucket`, `cluster`, `local tier`, `LUN`, `storage VM`, `volume` |
| **Children** |. |
| **Key attributes** | name, label / SnapMirror label, owners, snapshot restore size, busy, snapshot creation time |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | clone volume, restore, delete, calculate reclaimable state |

---

## snapshot policy

| Field | Value |
| --- | --- |
| **Names / aliases** | snapshot policy |
| **Definition** | A policy that defines how the system creates snapshots, including when to create them, how many copies to retain, and how to name them. |
| **Parent** | `cluster`, `storage VM` |
| **Children** |. |
| **Key attributes** | scope, snapshots (maximum retained), status, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | delete schedule, enable/disable, add schedule, apply to storage object (volume, bucket, or consistency group) |

---

## schedule

| Field | Value |
| --- | --- |
| **Names / aliases** | schedule |
| **Definition** | A time-based definition for running background tasks such as snapshots or replication. Cron schedules run at specific times; interval schedules run at regular intervals. |
| **Parent** | `cluster` |
| **Children** |. |
| **Key attributes** | schedule definition, scope, type, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | delete, change interval schedule (in case of interval type), change cron schedule (in case of cron type) |

---

## replica

| Field | Value |
| --- | --- |
| **Names / aliases** | replica |
| **Definition** | A SnapMirror destination that holds a replicated copy of protected storage. Replica inventory shows relationship health, lag, and transfer status between source and destination. |
| **Parent** | `cluster`, `local tier` |
| **Children** |. |
| **Key attributes** | source, lag, relationship health, destination, state, transfer status, policy type |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | delete, break, pause, update, test failover, restore, override / change transfer schedule, edit replication policy |

---

## SnapMirror relationship

| Field | Value |
| --- | --- |
| **Names / aliases** | SnapMirror relationship, SnapMirror |
| **Definition** | The connection established between source and destination systems to replicate data, either asynchronously or synchronously, for data protection and recovery purposes. |
| **Parent** | `bucket`, `cluster`, `LUN`, `Qtree`, `storage VM`, `volume` |
| **Children** |. |
| **Key attributes** | replication policy, state, relationship health, lag, destination, source |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | failover, test failover, restore, change replication policy, pause, break, resume, override transfer schedule, update, delete |

---

## SnapVault relationship

| Field | Value |
| --- | --- |
| **Names / aliases** | SnapVault relationship, SnapVault |
| **Definition** | A disk-to-disk snapshot replication relationship used for archiving. A SnapVault destination typically retains point-in-time snapshots over a longer period than a SnapMirror disaster recovery destination. |
| **Parent** |. |
| **Children** |. |
| **Key attributes** |. |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** |. |

---

## replication policy

| Field | Value |
| --- | --- |
| **Names / aliases** | replication policy |
| **Definition** | A SnapMirror policy that controls replication relationship behavior and specifies configuration attributes such as policy type, transfer rules, and snapshot retention on the destination. |
| **Parent** | `cluster`, `storage VM` |
| **Children** |. |
| **Key attributes** | policy type, backup to the cloud, network compression enabled / disabled, copy all source snapshots, scope, identity preserve setting, policy options, description, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | add/remove transfer rules, change identity preserve sub-settings, enable/disable network compression, add/remove destination snapshot rules, delete, enable/disable identity preserve, change transfer schedule, change description |

---

## consistency group

| Field | Value |
| --- | --- |
| **Names / aliases** | consistency group, CG |
| **Definition** | A collection of volumes that are managed together to ensure write-order consistency across multiple storage objects, typically used in replication scenarios to maintain data integrity and crash consistency when volumes need to be synchronized as a single unit. |
| **Parent** | `cluster`, `storage VM` |
| **Children** | `LUN` |
| **Key attributes** | name, IOPS, throughput, latency, capacity total, remote protection status, capacity available, capacity used, capacity logical used, local protection status |
| **Other attributes** | application / component type |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | expand, promote to parent consistency group, snapshot, clone, move under another consistency group, protect, delete, enable/disable snapshots (local protection), change application type |

---

## storage availability zone

| Field | Value |
| --- | --- |
| **Names / aliases** | Storage availability zone, SAZ |
| **Definition** | A logical pool of shared storage accessible by all nodes in an AFX or ASA r2 cluster. All disks and storage shelves attached to the cluster belong to a single storage availability zone. |
| **Parent** | `cluster` |
| **Children** | `LUN`, `volume` |
| **Key attributes** | capacity used, snapshot used, data reduction, critical threshold, capacity used %, warning threshold, nodes, capacity total, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | move storage units, change critical threshold, change warning threshold |

---

## disk

| Field | Value |
| --- | --- |
| **Names / aliases** | disk |
| **Definition** | A physical drive in a disk shelf that provides storage capacity for local tiers. Drives are assigned to nodes and organized into RAID groups. |
| **Parent** | `disk shelf`, `local tier` |
| **Children** |. |
| **Key attributes** | name, state, type, size, serial number, shelf name, firmware version, vendor, container type, bay |
| **Other attributes** | owner, encryption status, model |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** |. |

---

## disk shelf

| Field | Value |
| --- | --- |
| **Names / aliases** | disk shelf, shelf |
| **Definition** | A hardware enclosure that houses disk drives and provides connectivity and management for the drives, enabling them to be used as part of a storage system. |
| **Parent** | `cluster` |
| **Children** | `disk` |
| **Key attributes** | status, serial number, ID, firmware version, part number, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** |. |

---

## role

| Field | Value |
| --- | --- |
| **Names / aliases** | role |
| **Definition** | An access-control role that grants or denies access to ONTAP REST API paths or CLI command directories. Roles define what management actions an administrator can perform. |
| **Parent** | `cluster`, `storage VM` |
| **Children** |. |
| **Key attributes** | secondary path, access, REST API path, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | add/remove role attributes, delete, change secondary path, change REST API path, change access, add, change role name |

---

## user

| Field | Value |
| --- | --- |
| **Names / aliases** | user, local user |
| **Definition** | An administrator login account that authenticates to the cluster or a storage VM. Each account is assigned a role that controls permitted management actions. |
| **Parent** | `cluster`, `storage VM` |
| **Children** |. |
| **Key attributes** | MFA for HTTP, target product, name, account locked, password, authentication, application |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | change role, change password, change authentication method, lock / unlock, change application, enable/disable MFA for HTTP, add application, delete, edit, add |

---

## license

| Field | Value |
| --- | --- |
| **Names / aliases** | license |
| **Definition** | An installed license key or NetApp license file entry that entitles the cluster or a node to use a specific ONTAP feature package. |
| **Parent** | `cluster` |
| **Children** |. |
| **Key attributes** | host ID, licensed capacity, owner, expiration date, serial number, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** |. |

---

## feature

| Field | Value |
| --- | --- |
| **Names / aliases** | feature |
| **Definition** | A licensable ONTAP software package, such as NFS or SnapMirror, whose installed licenses and entitlement status determine whether the cluster can use that functionality. |
| **Parent** | `cluster` |
| **Children** |. |
| **Key attributes** | owner, installed license, host ID, license serial number, expiration date, licensed capacity, state, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** | delete legacy keys |

---

## event

| Field | Value |
| --- | --- |
| **Names / aliases** | event |
| **Definition** | A message logged by the Event Management System (EMS) that records cluster activity, errors, or status changes. |
| **Parent** | `cluster` |
| **Children** |. |
| **Key attributes** | severity, description, event name, source, action, sequence, node, time |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** |. |

---

## system alert

| Field | Value |
| --- | --- |
| **Names / aliases** | system alert |
| **Definition** | A notification generated by the system health monitor or alerts system to inform users about critical issues, potential risks, or events within the system, which provides details such as severity, probable cause, and recommended corrective actions to help monitor and troubleshoot the system effectively. |
| **Parent** | `cluster` |
| **Children** |. |
| **Key attributes** | node, suppress status, resource, monitor, acknowledge status, time, name |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** |. |

---

## job

| Field | Value |
| --- | --- |
| **Names / aliases** | job |
| **Definition** | A background management task that ONTAP queues and runs when cluster resources are available. |
| **Parent** | `cluster` |
| **Children** |. |
| **Key attributes** | message, end time, start time, state, description |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** |. |

---

## audit log

| Field | Value |
| --- | --- |
| **Names / aliases** | audit log |
| **Definition** | A collection of events recorded in chronological order that provides a detailed account of activities, such as management actions, file changes, or system operations, for monitoring and analysis purposes, and is often secured and periodically verified for integrity. |
| **Parent** | `cluster` |
| **Children** |. |
| **Key attributes** | user, session ID, message, scope, state, storage VM, command ID, application, time |
| **Detail sections** |. |
| **List columns** |. |
| **Console path** |. |
| **System Manager path** |. |
| **Typical actions** |. |

---

## Deprecated entity ids

| Don't use (entity id) | Use instead |
| --- | --- |
| `lif` | `network interface` |
| `aggregate` | `local tier` |
| `igroup` | `initiator group` |

## Deriving prototype pages

When asked for a **detail page** for entity X:

1. Show **key attributes** in an overview card or property list.
2. Add **detail sections** listed for X.

When asked for a **list page**, use the entity's **list columns** in a table.

List derived sections and sample row values before generating UI.

## Deep references

- [ONTAP documentation](https://docs.netapp.com/ontap/)
- Console field definitions: [NCL TOI](https://netapp.atlassian.net/wiki/spaces/UMF/pages/632409651/TOI+-+NCL+MVP+GA)

---

# Chart guidelines (from agent docs)

# AI Chart guidelines

Figma source: [Charts](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=6737-82289) (`vNPUEtCuR4Enwhz1ZeTdQE` / `6737:82289`).

Use this file when composing dashboard metrics, analytics cards, or exploration prototypes that include charts.

## Storybook and MCP

MCP: `guidelines-chart` · components: `components-chart-line`, `components-chart-scatter-plot`, `components-chart-donut`, `components-chart-horizontal-bar`, `components-chart-stacked-horizontal`, `components-chart-comparison`, `components-chart-frame`, `components-chart-legend` · Storybook: `Components/Chart` (gallery) and `Components/Chart/*`

## Related guidelines

- [`ai-layout-guidelines.md`](./ai-layout-guidelines.md). `chart` layout type, wide content
- [`ai-card-guidelines.md`](./ai-card-guidelines.md). Donut + split properties, card shells
- [`ai-tokens-guidelines.md`](./ai-tokens-guidelines.md). `--chart-*` tokens

## Decision tree

```text
Part-to-whole in a card?
  → BpDonutChart (size large 184px | medium 144px | small 80px; small has no center content)

Horizontal metric rows in a card?
  → BpHBarRow density="compact" | "full" (stack in BpStack)

Segmented whole with legend?
  → BpStackedHorizontalChart

Counts or sizes across ~5 or more labeled categories (optionally stacked)?
  → BpBarChart with categories + series

~2-3 values, shared units, no axes?
  → BpComparisonChart

A value over time (x axis is time), up to ~10 series?
  → BpLineChart with series of timestamped {x, y} points  (never Figma Trend enums)

Individual samples at irregular x positions, where each point matters?
  → BpScatterChart with xLabels + series of {x, y} points

Need zoom, brush, or a custom plot library?
  → BpChartFrame + app-owned children (visx/recharts/custom SVG)
```

## Use when (from Figma)

When the decision tree leaves a choice open, match the data to these selection
criteria. Source: [Chart types](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=84795-53808) (`84795:53808`).

| React | Use when |
| --- | --- |
| `BpHBarRow` (horizontal) | Comparing many categories; category names are long; ranking items highest to lowest. |
| `BpStackedHorizontalChart` | Showing % composition of a total when vertical space is limited; ~3-6 categories; the total equals 100%. |
| `BpDonutChart` | Showing % composition of a total; ~3-6 categories; the total equals 100%. |
| `BpLineChart` | Displaying trends over time; showing growth, decline, seasonality, or patterns; comparing multiple metrics over the same time period. |
| `BpBarChart` / `BpComparisonChart` | Comparing quantities across categories; discrete values rather than continuous trends; category labels are short. |
| `BpBarChart` (stacked, 2+ series) | Comparing % composition of a total across multiple categories; discrete values rather than continuous trends; category labels are short. |
| `BpScatterChart` | Showing the relationship between two variables; identifying correlations, clusters, or outliers; large datasets where individual points matter; comparing distributions across two dimensions. |

## Color rules (from Figma)

- There is no fixed order when color carries deliberate meaning. Choose the
  `--chart-*` tokens that fit the data; `--chart-2`, `--chart-4`, `--chart-3`,
  and `--chart-9` are the most common choices.
- When color has no deliberate meaning, assign series and segments in this
  preferred fallback order: `--chart-9`, `--chart-2`, `--chart-4`,
  `--chart-7`, `--chart-3`, `--chart-brand-13`, `--chart-6`, `--chart-1`,
  `--chart-brand-12`, `--chart-brand-16`. Cycle back to `--chart-9` only if a
  chart needs more than 10 series.
- `BpLineChart`, `BpScatterChart`, `BpBarChart`, `BpStackedHorizontalChart`, and
  `BpComparisonChart` apply that order when `color` is omitted. Omit `color`
  instead of recreating the sequence in generated code.
- `BpDonutChart`, `BpChartLegend`, `BpChartFrame`, and app-owned plots require
  explicit colors. Agents must assign their items in the preferred fallback
  order unless the data calls for intentional colors.
- Don't sort tokens numerically or start an undecided palette at `--chart-1`.
- Use **chart** colors in dashboard cards (including status-like meaning).
- Use **notification** colors in tables for the same status concepts.
- Same status/severity across a page → same color; different data points at the same severity → different icons.

Source: [Figma chart color guidance](https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE/%F0%9F%92%8E-Blueprint---components?node-id=84795-53296) (`84795:53296`).

## Axis and labels (from the Figma chart background)

- The y axis starts at 0. If a unit matters, include it in surrounding copy (title/legend/metric label); tick labels are compact numbers (e.g. `0`, `200 K`).
- Prefer round y-axis numbers (`200`, not `211`) and as few labels as needed to read the chart. Auto y domains on line, scatter, and bar charts use `niceChartTicks` (1/2/2.5/5×10^n steps with headroom above the largest value).
- Bar x-axis labels describe each bar; a line chart's x axis is **time**. Label it with the date and time conventions.
- `BpLineChart` takes timestamps, not labels; it draws only as many x-axis labels as fit, on calendar boundaries, at a format scaled to the range.
- Show a legend whenever a chart plots more than one series. `BpLineChart` and `BpBarChart` add one automatically past a single series; pass `legendItems` to `BpChartFrame` for app-owned plots.

## `BpLineChart` contract (library-owned)

Line charts show a value over time. The x axis is time. Keep to ~10 series or fewer for legibility.

Figma “Chart line” Trend variants are **decorative mocks**. Agents and apps bind data. Every
series is a list of timestamped samples, the shape real data already arrives in:

```tsx
<BpLineChart
  series={[
    {
      id: "read",
      label: "Read",
      points: [
        { x: Date.parse("2026-05-15T04:48:00Z"), y: 4.2 },
        { x: Date.parse("2026-05-15T06:12:00Z"), y: 5.1 },
      ],
    },
  ]}
/>
```

| Prop | Role |
| --- | --- |
| `series[].id` | Stable key |
| `series[].label` | Legend + a11y |
| `series[].points` | `{ x, y }` samples; `x` is epoch milliseconds, in any order |
| `series[].color` | Optional; defaults to the preferred fallback order above |
| `yDomain` | Optional fixed `[min, max]`; auto uses round ticks with headroom above the largest value |
| `xDomain` | Optional fixed `[min, max]`; auto spans the sample times |
| `projectedFromX` | First sample time styled as projected (inclusive) |
| `legend` / `showPoints` / `showArea` / `height` | Presentation |

Samples sit at their own times, so irregular sampling and gaps stay honest instead of
being flattened to even steps. Ticks land on calendar boundaries (the hour, midnight, or
the first day of the month) rather than round millisecond counts, and Blueprint owns the
label format. Time of day within a single day (`4:00 AM`), then `May 15` and `May` while
the range stays under a year, then `May 2026` and `2026` once it passes one. Exact midday
and day-boundary ticks use `noon` and `midnight`, not `12:00 PM` and `12:00 AM`. Past a
single day the axis steps by whole days or coarser, because a repeated clock time can't
tell one day from the next. A narrow chart still gets at least two ticks: rather than show
one lonely boundary, the axis steps finer until two land inside the range. The hover
readout uses the full month, date, year, and time.

Don't pre-format times into label strings and space them evenly; pass the timestamps.

Non-goals: zoom, brush, log scales, dual axes, Trend enums. Escalate those to `BpChartFrame` + an app plot.

## `BpScatterChart` contract (library-owned)

Scatter plots put each sample on two continuous axes. Use one when a line would imply continuity the data doesn't have, or when x isn't time. A metric sampled over time, where the trend is the story, stays `BpLineChart`. It also places samples by their real spacing.

```tsx
<BpScatterChart
  xLabels={["May 15", "May 16", "May 17", "May 18"]}
  xDomain={[0, 3]}
  series={[
    {
      id: "requests",
      label: "Requests",
      points: [
        { x: 0.2, y: 57_000, label: "May 15, 2026 4:48:00 AM" },
        { x: 1.8, y: 352_000, label: "May 16, 2026 7:12:00 PM" },
      ],
    },
  ]}
/>
```

| Prop | Role |
| --- | --- |
| `xLabels` | X tick labels, spaced evenly across the x domain; also the vertical grid lines |
| `series[].points` | `{ x, y }` samples; `label` is the hover readout (defaults to the series label) |
| `series[].color` | Optional; defaults to the preferred fallback order above |
| `xDomain` / `yDomain` | Optional fixed `[min, max]`; y reaches 0 when all values are non-negative and uses round ticks with headroom |
| `legend` / `height` | Presentation |

`xLabels` are evenly spaced, so pin `xDomain` to the range they describe (8 daily labels → `xDomain={[0, 7]}` with x in days). Non-finite coordinates are skipped rather than plotted at the origin.

## `BpBarChart` contract (library-owned)

`categories` + `series` of `values`, one value per category. One series draws plain bars; two or more stack within each bar (Figma stacks all bars if any one stacks).

```tsx
<BpBarChart
  categories={["0-1 MiB", "1-5 MiB", "5-50 MiB"]}
  series={[
    { id: "hot", label: "Hot", values: [400, 200, 130] },
    { id: "cold", label: "Cold", values: [100, 60, 35] },
  ]}
/>
```

Bars always start at zero, so there is no `yDomain`; pass `yMax` to pin the scale across several charts. Other props: `legend` (defaults on when stacked), `height`.

Reach for `BpBarChart` when ~5 or more categories make the comparison worthwhile; for ~2-3 values without axes, use `BpComparisonChart` instead.

## `BpHBarRow` usage

- Choose `density="full"` vs `"compact"` by the space available and how much each row must say; use **5 or fewer** full rows per card.
- Every row in one compact series uses the **same** chart color. The rows compare against each other, not across categories.
- Full rows keep the leading icon at 24px inside its circular container.

## Hover and keyboard tooltips

`BpLineChart`, `BpBarChart`, `BpScatterChart`, `BpComparisonChart`, `BpStackedHorizontalChart`, and `BpDonutChart` share the Figma chart tooltip for the active category or segment. Each chart carries a summarizing label on a `role="group"` root. `role="img"` would make the subtree presentational and hide both the keyboard help and the live region. But the whole plot is no longer one tab stop: Tab lands on a short `role="application"` keyboard-help string that appears at the top of the chart and explains the navigation. From there, use the left and right arrow keys (and Home/End) to move through points; Escape clears the active point. Linear charts clamp at the ends; **`BpDonutChart` wraps** so arrows keep moving around the ring. A polite live region announces the same readout the tooltip shows, and the help string is read on focus so a screen reader hears the chart summary and the navigation hint together. The help string and the tooltip both sit at the top of the chart, so only one shows at a time: the string collapses as soon as a point is active. Keeping its focus ring on the chart's own edge. And returns on Escape. The tooltip itself stays out of the accessibility tree (`aria-hidden`). Keep values legible in the chart itself rather than hiding them only in the tooltip.

On a **multi-series `BpLineChart`**, the up and down arrow keys pick a series: focus starts on the all-series readout, Down steps into each series in turn (snapping left/right to that series' own samples and dimming the rest), and Up steps back out toward all series. Single-series charts treat up/down like left/right.

| Chart | Readout |
| --- | --- |
| Line, single series | Sample's full date and time + value |
| Line, multiple series | Date and time as the title + one row per series; hovering a line highlights it and shows only that series |
| `BpBarChart`, single series | Category + value |
| `BpBarChart`, stacked | Category title + one row per series |
| `BpScatterChart`, single series | Nearest sample's label + value |
| `BpScatterChart`, multiple series | Sample label as the title + one row for its series |
| `BpComparisonChart` | Active bar's label + value |
| `BpStackedHorizontalChart` | Active segment's label + `valueLabel`, or its share of the total (no category axis to title) |
| `BpDonutChart` | Active segment's label + share of its ring |

## Figma → code

| Figma | React |
| --- | --- |
| Horizontal chart / Full | `BpHBarRow density="full"` |
| Horizontal chart / compact | `BpHBarRow density="compact"` |
| Stacked horizontal chart | `BpStackedHorizontalChart` |
| Bar chart ❇️ (Type=Single) | `BpBarChart` with one series |
| Bar chart ❇️ (Type=Stacked) | `BpBarChart` with two or more series |
| Comparison chart ❇️ | `BpComparisonChart` |
| Donut chart ❇️ | `BpDonutChart` |
| Chart legend ❇️ | `BpChartLegend` |
| Chart (background chrome) | `BpChartFrame` |
| Chart line (Trend=…) | `BpLineChart` with sample/real `series` of timestamped points |
| Chart - ready to use ❇️ (Chart=Scatter plot) | `BpScatterChart` with `xLabels` + `series` of `{x, y}` points |

## Code → Figma

When building a Figma screen from React source, use `Chart - ready to use ❇️` from the Blueprint library and treat it as a **labeled mock**. Do not attempt to bind real data series.

| React prop / pattern | Figma approach |
| --- | --- |
| `<BpLineChart height={N} />` | `height` is the **plot area only**. The Figma ready-to-use frame includes legend + axis chrome; a 220 px `height` prop corresponds to ~304 px total Figma height. Use the component at its natural size. |
| `series` data | Override legend label text and axis tick text. Leave Trend geometry as-is. Never set Trend enum variants from React series. |
| `<BpBarChart>` / `<BpScatterChart>` | Same rule. Natural Figma size, override labels only. |
| Tooltip copy | Override the tooltip text node if the chart shows an example readout. |

Nested chart text IDs become stale after any instance mutation. Re-resolve from the card instance before each label write.

## Composition recipes

**Compact horizontal stack in a card**

```tsx
<BpCard header={<BpCardHeader title="Size distribution" />}>
  <BpStack space="200">
    <BpHBarRow density="compact" label="0-1 GiB" value={20} valueText="20" unit="%" color="var(--chart-2)" />
    <BpHBarRow density="compact" label="1-10 GiB" value={45} valueText="45" unit="%" color="var(--chart-2)" />
  </BpStack>
</BpCard>
```

**Line chart in wide content**. `BpContentRegion(width="wide")` → `BpCard` → `BpLineChart`.

**Donut + split properties**. See [`ai-card-guidelines.md`](./ai-card-guidelines.md) `DonutWithSplitProperties`.

## Anti-patterns

- Do not invent `trend="Growth"` (or other Figma Trend enums) on React charts.
- Do not put axes or legends on `BpComparisonChart`.
- Do not mix notification token colors into chart series in cards.
- Do not add visx/recharts to `@netapp/blueprint`; keep advanced plots app-owned inside `BpChartFrame`.
- Prefer `BpLineChart` over raw SVG for ordinary agent prototypes.


---

# Proto Hub page recipes (filters / inventory)

## Simple filters (Figma `86422:42107`)

Horizontal bar: Filters label → up to 4 `BpDropdown variant="underline"` → optional Reset.

**Gotcha:** `BpDropdown` CSS sets `width: 100%`. Inside `BpSimpleFilters` that stacks every control on its own row. Keep Proto Hub `index.css` override, or set each filter dropdown to `style={{ width: "auto", minWidth: 160, maxWidth: 280 }}`. Never wrap filter dropdowns in `BpStack`.

## Inventory / systems list (table+dashboard)

1. Title row: `BpInline justify="between"`. Page title + description | primary + outline actions  
2. Optional `BpNotification` warning/success  
3. KPI band: `<BpCard padding={false}><BpInline space="300" wrap>` of `BpCardProperty` (`hasRightSeparator` except last, `style={{ flex: "1 0 0", minWidth: "149px" }}`)  
4. `BpSimpleFilters` as above  
5. `BpTable` with search in `BpTableUpperActions` / `BpSearch`

Prefer local component JSDoc under `node_modules/@netapp/blueprint/dist/react/components/` and Storybook over the legacy Cloud Style Guide for React composition.
