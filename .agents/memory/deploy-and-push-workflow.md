---
name: SmartConnect RX deploy & GitHub push workflow
description: How code reaches the live site (Render via GitHub), and why raw agent git pushes get blocked.
---

# Deploy & push workflow

The live app (app.smartconnects.com) is hosted on **Render**, which auto-deploys
from the **GitHub `main`** branch of `Smartconnect2025/Smartconnect-RX`. So
"make it live" == get the commit onto GitHub `main`; Render does the rest.

## Push behavior (observed)
- **A plain fast-forward `git push github master:main` CAN succeed from the main
  agent** when remote `main`'s tip is already an ancestor of local `master` (no
  force needed). Confirmed working in the past via a direct fast-forward push.
- After a successful push you may see `cannot lock ref
  'refs/remotes/github/main'` / a stale `.git/refs/remotes/github/main.lock`.
  **This is a LOCAL tracking-ref error only — the remote was already updated.**
  Verify the real outcome with `git ls-remote github main` (read-only, allowed).
- **Destructive git ops ARE still guard-blocked** for the main agent: anything
  that rewrites refs or history (`git update-ref`, `rm` of `.git` lockfiles,
  force-with-lease, rebase, history scrub). Those must go through a **background
  Project Task**. So you can fast-forward push, but you cannot clean up the local
  lock/tracking ref yourself — it's harmless and can be left.
- If lineage ever genuinely diverges (remote `main` has commits not in local
  `master`), a plain push will be rejected and you need a task agent to reconcile
  with force-with-lease pinned to the known remote SHA.
- **GitHub secret-scanning push protection** can block the lineage because a
  GitHub PAT is committed in history at `aimrx-reference/.replit`. It did NOT
  block the latest push (user previously
  clicked "Allow secret"). If it ever re-blocks, the user clicks the unblock URL
  once; real fix is rotating the token + scrubbing history via a background task.

## Commit vs push (critical sequencing)
- **The main agent CANNOT `git commit`** (sandbox: "Destructive git operations
  are not allowed in the main agent"). `git add` works, but `commit` is blocked.
- The **only committer is the auto-checkpoint**, which fires at *loop end* (full
  stop / control returned to user), NOT between tool batches.
- Consequence: **a fresh edit and its push cannot happen in the same turn.** You
  must finish the turn so the checkpoint commits the edit to local `master`, then
  push (`git push github master:main`) on a *subsequent* turn. This is why every
  successful push has been of an already-committed checkpoint from a prior turn.

## Practical path to ship a change
1. Make the edit on main (visible in preview immediately).
2. To go live: the user's normal **Replit Git/Version Control sync** pushes to
   GitHub, OR create a **background Project Task** to do the push.
3. Verify with `git ls-remote github main` (read-only, allowed) — when remote
   `main` == local `master` tip, the code is on GitHub and Render will deploy.

**Why this matters:** users repeatedly ask "just push it" and get frustrated;
the blocker is environmental (guard + GitHub secret scanning), not a refusal.
Lead with the one-click unblock or the background-task route, not raw `git push`.
