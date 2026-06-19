---
name: Repo app copies (aimrx vs aimrx-new)
description: Two diverged copies of the same source tree live in this repo; which one is live and why pasted "reference" code often won't match.
---

# Two diverged copies of the same app

The repo contains `aimrx/` (legacy) and `aimrx-new/` (the LIVE SmartConnect RX app
deployed via Render from GitHub `main`). They share a common ancestor and many
identically-named files (e.g. `features/admin-dashboard/components/ProvidersManagement.tsx`,
`BaseTableManagement.tsx`) but have **drifted apart** — same path, different code.

**Why it matters / how to apply:**
- Always make edits in `aimrx-new/`. `aimrx/` is not the live app.
- When a user pastes "here's our code" reference snippets, they may have come from the
  legacy `aimrx/` copy (or an even older version) and will not match `aimrx-new/`.
  Verify against the live `aimrx-new/` files before acting — don't trust the paste.
- Concrete example of drift seen: legacy ProvidersManagement used the shared
  `BaseTableManagement` wrapper with 8 columns; the live `aimrx-new` version hand-rolls
  its own `<Table>` with 7 columns, a Tabs row, and a pharmacy filter.
