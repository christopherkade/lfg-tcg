<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Keep the specs current

`SPECS.md` is an index, not the spec content itself — the actual PRD/technical spec lives split by section under `docs/specs/` (`01-architecture.md` through `09-agent-implementation-steps.md`), so an agent only has to open the file(s) relevant to its change instead of a single huge document. Whenever you implement, change, or remove a feature (schema/RLS/triggers, `GAMES_CONFIG`, server actions, routes, screens, or UI flows), use the `update-specs` skill (`.github/skills/update-specs/SKILL.md`) to update the relevant `docs/specs/*.md` file(s) in the same pass — consult `SPECS.md`'s index table (or the skill's routing table) to find which file(s) apply before opening anything. Skip it for pure refactors, styling, or bug fixes with no behavioral change.
