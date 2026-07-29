---
name: promote-to-production
description: >-
  Promotes verified changes on the `staging` branch to `main`/production for
  this project. Use this skill when the user says things like "promote staging
  to prod", "ship this to production", "merge staging into main", "release
  what's on staging", or after they've confirmed a feature works on the
  staging Vercel deployment and wants it live. Follows
  PROMOTING_TO_PRODUCTION.md at the repo root. Do NOT use this for hotfixes
  that need to go straight to `main` (those bypass staging entirely — branch
  off `main`, PR into `main`, then merge `main` back into `staging` afterward
  to keep it from drifting), and do NOT use it as a substitute for actually
  verifying the feature on the staging deployment first.
---

# Promote staging to production

Full reference: [`PROMOTING_TO_PRODUCTION.md`](../../../PROMOTING_TO_PRODUCTION.md).
This skill exists so promotion is never done ad hoc — the order of operations
below matters, especially getting schema changes onto prod *before* the code
that depends on them.

## Preconditions

Before starting, confirm with the user (or from context) that the feature(s)
on `staging` have actually been verified against the staging Vercel
deployment — this skill promotes, it doesn't test. If that hasn't happened
yet, point back to the staging test flow (Vercel env vars scoped to Preview,
staging Supabase project, staging Discord app) instead of proceeding.

## Steps

1. **Sync `staging` with any hotfixes.** If anything landed directly on
   `main` since the last promotion, catch `staging` up first so this
   promotion only carries genuinely new changes:
   ```bash
   git checkout staging
   git pull origin staging
   git merge main
   git push origin staging
   ```
   Skip if nothing has touched `main` directly.

2. **Promote pending schema changes to prod first.** Read
   [`supabase/MANIFEST.md`](../../../supabase/MANIFEST.md) and find any row
   ticked "staging applied" but not "prod applied." For each:
   - Run that exact script against **prod**'s Supabase SQL editor.
   - Tick "prod applied" in the manifest.
   - Commit the manifest update to `staging`.
   This must happen *before* step 4 — if `main`'s new code expects a
   column/table prod doesn't have yet, production breaks the instant it
   deploys.

3. **Open the promotion PR:**
   ```bash
   gh pr create --base main --head staging --title "Promote staging -> main"
   ```

4. **Review the diff** (`git diff main...staging` or the PR diff on GitHub)
   before merging — this is the last checkpoint before anything goes live.

5. **Merge with a regular merge commit — never squash.** `staging` is
   long-lived; squash-merging rewrites history into a new commit hash, so the
   *next* promotion's `git diff main...staging` won't recognize this batch as
   already merged and will show it as changes again.

6. **Let Vercel auto-deploy `main`.** No dashboard action needed — production
   env vars already point at the production Supabase project and Discord app.

7. **Smoke-test production**: verify the promoted feature, and spot-check
   core flows (Discord login, creating a pod, joining a pod) didn't regress.

8. **Keep `staging` — never delete it.** Since step 5 used a merge commit,
   `staging` and `main` are now in sync and `staging` remains the base for
   the next round of feature branches.

## If something's wrong in production

Use Vercel's **Instant Rollback** to the prior production deployment
immediately, then fix forward on `staging` — don't scramble to revert
directly on `main` under pressure.
