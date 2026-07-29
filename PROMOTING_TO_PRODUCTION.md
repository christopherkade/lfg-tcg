# Promoting `staging` to `main`

Once a feature has been verified on the `staging` Vercel deployment, follow these
steps to bring it to production. See the [Environments](./README.md#environments)
section of the README for how `staging` and `main` map to their respective
Supabase projects and Discord OAuth apps.

## 1. Catch `staging` up on any hotfixes

If anything was hotfixed directly onto `main` since the last promotion, merge it
into `staging` first so this promotion only contains genuinely new changes:

```bash
git checkout staging
git pull origin staging
git merge main
git push origin staging
```

Skip this if nothing has touched `main` directly since the last promotion.

## 2. Promote any pending schema changes to prod first

Check [`supabase/MANIFEST.md`](./supabase/MANIFEST.md) for rows ticked
"staging applied" but not "prod applied." For each one:

1. Run that exact script against **prod**'s Supabase SQL editor.
2. Tick "prod applied" in the manifest.
3. Commit the manifest update to `staging`.

Do this **before** the code merge in step 4 — if the new code on `main` expects
a column/table prod doesn't have yet, production will error the instant it
deploys.

## 3. Open the promotion PR

```bash
gh pr create --base main --head staging --title "Promote staging -> main"
```

## 4. Review the diff

`git diff main...staging` (or read the PR diff on GitHub). This is the last
checkpoint before anything goes live.

## 5. Merge with a regular merge commit — not squash

This matters specifically because `staging` is long-lived: squash-merging
rewrites the commits into a new hash, so the *next* promotion's
`git diff main...staging` won't recognize this batch as already merged and
will show it as changes again. A plain merge commit keeps history aligned so
future diffs stay incremental.

## 6. Production deploys automatically

Vercel auto-deploys `main` on merge. No dashboard action needed — production
env vars already point at the production Supabase project and Discord app,
untouched by this process.

## 7. Smoke-test production

Visit the production URL and verify:

- The promoted feature works as expected.
- Core flows haven't regressed: Discord login, creating a pod, joining a pod.

## 8. Keep `staging` — don't delete it

Since step 5 used a merge commit, `staging` and `main` are now in sync and
`staging` remains the base for the next round of feature branches.

## If something's wrong in production

Use Vercel's **Instant Rollback** to the prior production deployment
immediately, then fix forward on `staging` rather than scrambling to revert
directly on `main` under pressure.
