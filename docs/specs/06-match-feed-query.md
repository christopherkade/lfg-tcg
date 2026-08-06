# 6. Match Feed Query Layout (`/components/MatchFeed.tsx`)

A component updating dynamically via real-time channel infrastructure. It takes the viewer's `profile` and their user id as props, plus owns its own **`PodFiltersValue`** state (`/components/PodFilters.tsx`, rendered as the wrapping chip-and-popover bar described in Section 5) driving the filter bar described in Section 5. That state's *initial* value only seeds `gameKey` from the viewer's profile (`profile.preferred_game`) so first load still browses meaningfully instead of showing every game at once — every other field, including `powerBrackets`, starts unset/unrestricted (see Section 5's Power Bracket note on why it deliberately does **not** seed from `profiles.preferred_brackets`); from there the user can broaden or narrow any field (including Game, down to "All Games") independently of `profiles`.

**Any pod the viewer has a live `pod_joins` row on (`PENDING` or `ACCEPTED`) is always included in the results, unconditionally** — fetched via a separate, unfiltered query (against `pod_joins` with `pods!inner(...)` embedded) run every time alongside the filtered query below, then merged in (de-duplicated by id) ahead of the filtered rows. This exists so a pod the viewer is actively part of can never disappear from their own feed just because they later change a browsing filter, or because it fails the always-on city scoping described next — they still need to see it to track status, coordinate, or leave. That still-live join is itself scoped to `pods.status = 'ACTIVE'` and not yet expired (a `MATCHED` pod is deliberately excluded here too, same as everywhere else — it has its own dedicated `MatchedDialog` flow instead, see Section 5's Join Request Flow step 6).

The separate filtered query always excludes the viewer's own pod and expired rows, and always applies **city scoping** (city isn't part of `PodFiltersValue` — it's an always-on constraint, not a user-adjustable filter): Online pods (`type = 'ONLINE'`) always pass regardless of city; IRL pods only pass if their snapshotted `city` equals the viewer's own `profiles.city`. `playstyle_key` is not filtered on at all — a pod's playstyle has no corresponding `PodFilters` control, so the feed shows every playstyle regardless of the viewer's own `profiles.preferred_playstyle`. If the viewer has no city on file, IRL pods are excluded from this filtered query outright (it's skipped entirely when `filters.matchType === "IRL"`, since there's nothing to compare against) while Online pods still show — the always-included joined pods above are unaffected by this and still show regardless. The query joins each pod's `pod_joins` so accepted members can be rendered on the card, and conditionally applies each remaining filter field (game/format as plain equality checks once set to something other than "All", power brackets as an array **overlap** check `&&` once at least one is selected). The **Date** filter isn't a plain column filter — since ONLINE pods have no `scheduled_at` — so it's applied client-side after the fetch, comparing each row's effective date (`scheduled_at ?? created_at`) against the selected day:

```typescript
// filters is PodFiltersValue — local component state seeded from the
// viewer's profile, not a fixed reflection of it.
const fetchActivePods = async (
  profile: Profile,
  currentUserId: string,
  filters: PodFiltersValue,
) => {
  // Always-included, unfiltered: pods the viewer has a live join on.
  const { data: joinedData } = await supabase
    .from("pod_joins")
    .select("pods!inner(*, profiles(*), pod_joins(*, profiles(*)))")
    .eq("user_id", currentUserId)
    .in("status", ["PENDING", "ACCEPTED"])
    .eq("pods.status", "ACTIVE")
    .gt("pods.expires_at", new Date().toISOString());
  const joinedPods = (joinedData ?? []).map((row) => row.pods);

  // City scoping short-circuit: an IRL-only view is impossible to satisfy
  // for a viewer with no city on file — joinedPods above are unaffected.
  let filteredRows = [];
  if (!(filters.matchType === "IRL" && !profile.city)) {
    let query = supabase
      .from("pods")
      .select("*, profiles(*), pod_joins(*, profiles(*))")
      .eq("status", "ACTIVE")
      .gt("expires_at", new Date().toISOString())
      .neq("user_id", currentUserId);

    // City scoping: Online pods always show; IRL pods are always
    // restricted to the viewer's own city, regardless of the Match Type
    // filter below.
    if (filters.matchType === "ONLINE") {
      query = query.eq("type", "ONLINE");
    } else if (filters.matchType === "IRL") {
      query = query.eq("type", "IRL").eq("city", profile.city);
    } else if (profile.city) {
      query = query.or(`type.eq.ONLINE,and(type.eq.IRL,city.eq.${profile.city})`);
    } else {
      query = query.eq("type", "ONLINE");
    }

    if (filters.gameKey !== "ALL") query = query.eq("game_key", filters.gameKey);
    if (filters.formatKey !== "ALL") query = query.eq("format_key", filters.formatKey);
    // Overlap match: any shared bracket between the selected brackets and
    // the pod's snapshotted power_tiers counts as a match.
    if (filters.powerBrackets.length) {
      query = query.overlaps("power_tiers", filters.powerBrackets);
    }

    const { data } = await query;
    filteredRows = data ?? [];
    if (filters.date) {
      filteredRows = filteredRows.filter((pod) =>
        isSameDay(new Date(pod.scheduled_at ?? pod.created_at), filters.date),
      );
    }
  }

  // Merge, joined pods first, de-duplicated against the filtered rows.
  const joinedIds = new Set(joinedPods.map((b) => b.id));
  setPods([...joinedPods, ...filteredRows.filter((b) => !joinedIds.has(b.id))]);
};
```

Only `pod_joins` rows with `status = 'ACCEPTED'` should be rendered as visible group members on each card; `PENDING`/`REJECTED` rows belonging to other users are not shown to searchers (RLS also restricts this — a searcher can only ever see their own join rows).
