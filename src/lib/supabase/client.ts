import { createBrowserClient } from "@supabase/ssr";

// Memoized as a singleton: every client component in this app calls
// createClient() independently (MatchFeed, OwnBeaconPanel,
// MatchedBeaconWatcher, NotificationBell, LfgButton, ...), each opening its
// own Realtime channels. Without memoizing, each call previously spun up a
// brand new supabase-js instance (and its own separate Realtime WebSocket
// connection + auth-token sync), which made postgres_changes delivery
// unreliable — e.g. new beacons not showing up in the Match Feed without
// a manual reload. Reusing one client means all channels multiplex over
// a single, consistently-authenticated Realtime connection per tab.
function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Routed through a named, non-generic function (rather than typing the
// memo var directly off `ReturnType<typeof createBrowserClient>`) so TS
// resolves one concrete overload instead of the generic function type's
// last overload — the latter widens the postgres_changes payload types
// used by `.channel(...).on(...)` call sites to `any`.
let browserClient: ReturnType<typeof createBrowserSupabaseClient> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient();
  }
  return browserClient;
}
