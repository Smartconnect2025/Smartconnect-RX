---
name: SmartConnect RX deploy & GitHub push workflow
description: How code reaches the live site (Render via GitHub), and why raw agent git pushes get blocked.
---

# Deploy & push workflow

The live app (app.smartconnects.com) is hosted on **Render**, which auto-deploys
from the **GitHub `main`** branch of `Smartconnect2025/Smartconnect-RX`. So
"make it live" == get the commit onto GitHub `main`; Render does the rest.

## Why agent pushes fail / are blocked
- **Git write ops (push, fetch, rm of `.git` lockfiles, history rewrite) are
  guard-blocked for the main agent.** They only run inside a **background
  Project Task** (task agent), which has the elevated git permissions.
- The local `master` branch lineage diverged from remote `main` historically;
  force-with-lease pinned to the known remote SHA is how a task agent reconciles
  it without losing the user's Replit-synced commits.
- **GitHub secret-scanning push protection** blocks the whole lineage because a
  GitHub PAT is committed in history at `aimrx-reference/.replit` (commit
  `0ac3dd7`, May 29 2026). Until that token is purged from history, pushes need
  the user to click GitHub's "Allow secret" unblock URL once. The user has done
  this at least once; the token should be rotated and the file scrubbed from
  history (a real fix, requires history rewrite via a background task).

## Practical path to ship a change
1. Make the edit on main (visible in preview immediately).
2. To go live: the user's normal **Replit Git/Version Control sync** pushes to
   GitHub, OR create a **background Project Task** to do the push.
3. Verify with `git ls-remote github main` (read-only, allowed) — when remote
   `main` == local `master` tip, the code is on GitHub and Render will deploy.

**Why this matters:** users repeatedly ask "just push it" and get frustrated;
the blocker is environmental (guard + GitHub secret scanning), not a refusal.
Lead with the one-click unblock or the background-task route, not raw `git push`.
