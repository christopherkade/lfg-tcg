<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Keep SPECS.md current

Whenever you implement, change, or remove a feature (schema/RLS/triggers, `GAMES_CONFIG`, server actions, routes, screens, or UI flows), use the `update-specs` skill (`.github/skills/update-specs/SKILL.md`) to update SPECS.md in the same pass. Skip it for pure refactors, styling, or bug fixes with no behavioral change.
