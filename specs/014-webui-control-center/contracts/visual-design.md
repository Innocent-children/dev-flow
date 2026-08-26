# Visual Design Contract

## Design direction

Dev Flow WebUI is a premium desktop control center: modern, expressive, precise and unmistakably operational. It applies
the hierarchy, consistency, clarity and accessibility principles associated with Google Material Design and Apple Human
Interface Guidelines while using an original Dev Flow visual identity.

The interface may use bold color, gradients, layered translucent surfaces, depth, data visualization and expressive motion.
Visual richness must strengthen information hierarchy, workflow comprehension and action feedback.

## Visual foundations

### Typography

- Use the system UI font stack for interface text and the system monospace stack for IDs, revisions, digests and code.
- Define semantic roles for display, page title, section title, body, label, caption and code.
- Default body text is at least 14 CSS pixels with readable line height; dense metadata may use a smaller role only when it
  remains legible at default zoom.
- Weight, size and color jointly express hierarchy; headings do not depend on color alone.

### Color and material

- Define semantic tokens for canvas, elevated surfaces, text tiers, borders, accent, focus and lifecycle states.
- Provide complete light and dark token sets selected from system appearance.
- Status meanings remain stable across the application. `BLOCKED`, destructive, warning, success and neutral states each
  combine semantic color with text, icon, shape or line treatment.
- Normal text meets WCAG AA contrast of 4.5:1; large text and essential graphical controls meet at least 3:1.
- Gradients, translucency, blur, glow and shadow may create depth and identity while preserving text contrast and clear
  interactive boundaries.

### Spacing, shape and density

- Use one base spacing scale for shell, sections, cards, tables, forms and dialogs.
- Align page titles, filters, primary content and action regions to a stable desktop grid.
- Corner shapes, borders and elevation levels use a limited semantic set so rich visuals remain coherent.
- Information-dense views group related facts through proximity and progressive disclosure rather than shrinking critical
  text or controls.

### Motion

- Motion may express navigation, panel changes, graph emphasis, state transitions, success and destructive confirmation.
- Motion maintains continuity and does not delay completion of a user action.
- Loading uses contextual skeletons or progress indicators; stale and unavailable states do not masquerade as loading.
- `prefers-reduced-motion` removes spatial and decorative motion while retaining immediate state feedback.

## Application shell

- A persistent desktop shell provides product identity, primary navigation, runtime readiness and access to global Task
  creation.
- Content width adapts from 1024 CSS pixels upward. Navigation and secondary panels may collapse when space is constrained;
  primary content and current actions remain available.
- Page-level horizontal overflow is forbidden. Wide tables and process graphs may scroll or pan inside their own labeled
  region.

## Components required by current pages

- Navigation, page header, command/search field and filter controls.
- Metric cards, Task table/list rows, status badges and metadata groups.
- Detail sections, timeline events and repository Scope presentation.
- Interactive process graph with actual/current/future path legend.
- Action schema fields, Evidence inputs, transition choices and validation summaries.
- Inline notice, toast/banner, loading skeleton, empty state and unavailable state.
- Confirmation dialog and destructive cancel/purge presentation.
- Buttons, links, pagination and disclosure controls only where the page-specific hierarchy below uses them.

Each implemented interactive component defines the states that apply to its current use. The Feature does not require an
unused menu, tab, disclosure or other generic component family. Destructive controls are visually distinct before
confirmation.

## Page-specific hierarchy

### Dashboard and Task list

- Current work and blockers receive the strongest hierarchy.
- Metrics support scanning and link to corresponding filtered Task sets.
- Filters remain discoverable without dominating the content.

### Task detail

- Current node, revision, Action, Blocker and Outcome are visible before secondary records.
- Timeline, graph and Action areas remain visually distinct but share the same Task identity context.
- Long identifiers are copyable and use controlled wrapping or truncation with an accessible full-value affordance.

### Graph

- Actual path, current node, current legal edges and future reachability use distinct line/shape treatments plus a visible
  legend.
- Selection and keyboard focus are distinguishable. Zoom/pan controls do not cover graph facts.
- Dense graphs retain readable labels and provide an alternate textual transition list.

### Forms and destructive actions

- Primary, secondary and destructive actions have stable placement and hierarchy.
- Field errors appear near the field and in a summary when multiple errors exist.
- Purge confirmation presents target, permanence and required typed confirmation in one focused dialog. A reset-required
  WebUI state presents the exact Core CLI reset command; reset planning and confirmation do not run in the browser.

## Accessibility and input

- All operations are reachable with keyboard and have visible focus.
- Semantic headings, landmarks, labels, descriptions and live feedback expose the same structure available visually.
- Focus moves predictably after navigation, dialog open/close, validation failure and successful mutation.
- Icon-only controls have accessible names; hover-only information is also available through focus or persistent text.
- Browser zoom and text scaling do not hide primary operations.

## Product-owner UI acceptance

The following surfaces are presented to the product owner as the delivered UI:

1. dashboard with mixed lifecycle metrics and recent activity;
2. filtered Task list with active, blocked, done, cancelled and archived examples;
3. Task detail with repositories, Evidence, Blocker and Outcome;
4. repeated-path graph with current legal and future reachable edges;
5. Action form with validation and Guard error states;
6. loading, empty, stale, read-only, incompatible and unavailable states;
7. cancel and purge confirmation plus reset-required CLI guidance;
8. responsive shell with a constrained secondary panel.

The product owner decides final UI acceptance using these surfaces and the design direction above. Automated UI tests,
screenshot matrices, pixel snapshots and Agent-performed visual review are outside the Feature verification budget. The
implementation team still builds and type-checks the frontend and fixes defects reported by product-owner acceptance.

## References

- [Google Material Design](https://m3.material.io/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
