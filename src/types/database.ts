export type GameKey = "MTG" | "ONE_PIECE" | "POKEMON" | "LORCANA";
export type PlaystyleKey = "casual" | "competitive";
export type MatchType = "IRL" | "ONLINE";
export type PodStatus = "ACTIVE" | "MATCHED" | "EXPIRED";
export type JoinStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type NotificationType =
  | "JOIN_REQUEST"
  | "JOIN_ACCEPTED"
  | "JOIN_REJECTED"
  | "MEMBER_LEFT"
  | "REMOVED_FROM_POD"
  | "POD_UPDATED"
  | "POD_UPDATED_PENDING"
  | "POD_DESTROYED"
  | "POD_EXPIRED_INACTIVITY";

export interface Profile {
  id: string;
  updated_at: string;
  username: string;
  discord_handle: string;
  avatar_url: string | null;
  city: string | null; // key into CITIES_CONFIG (constants/citiesConfig.ts), or null if unset
  preferred_game: GameKey;
  preferred_format: string;
  preferred_playstyle: PlaystyleKey;
  preferred_brackets: number[] | null;
  preferred_match_type: MatchType;
  preferred_location_name: string | null;
  preferred_max_players: number;
}

export interface Pod {
  id: string;
  user_id: string;
  game_key: GameKey;
  format_key: string;
  playstyle_key: PlaystyleKey;
  power_tiers: number[] | null;
  type: MatchType;
  location_name: string | null;
  city: string | null; // snapshot of the host's profiles.city at creation/edit time
  scheduled_at: string | null;
  max_players: number;
  notes: string | null;
  status: PodStatus;
  created_at: string;
  expires_at: string;
  matched_at: string | null; // set when status transitions to MATCHED; drives the retention sweep (SPECS.md Section 3)
  recurring_table_id: string | null; // set on pods spawned by an organiser's RecurringTable; null for ad hoc peer-hosted pods
  auto_accept: boolean; // denormalized from RecurringTable.auto_accept at spawn time; requestJoin checks this directly
  store_name: string | null; // denormalized store name for organiser-hosted pods; null for ad hoc peer-hosted pods
}

export interface PodJoin {
  id: string;
  pod_id: string;
  user_id: string;
  status: JoinStatus;
  joined_at: string;
  matched_notified_at: string | null; // set once the joiner has been shown MatchedDialog for this pod
}

export interface PodJoinWithProfile extends PodJoin {
  profiles: Profile;
}

export interface PodWithRelations extends Pod {
  profiles: Profile;
  pod_joins: PodJoinWithProfile[];
}

export interface PodHistoryMember {
  id: string;
  username: string;
  discord_handle: string;
  avatar_url: string | null;
}

export interface PodHistoryEntry {
  id: string;
  pod_id: string;
  host_id: string;
  game_key: GameKey;
  format_key: string;
  playstyle_key: PlaystyleKey;
  power_tiers: number[] | null;
  type: MatchType;
  location_name: string | null;
  city: string | null;
  scheduled_at: string | null;
  pod_created_at: string;
  matched_at: string; // for recurring-table entries, this holds the occurrence's scheduled_at (repurposed, see snapshot_recurring_pod_history)
  members: PodHistoryMember[];
  created_at: string;
  recurring_table_id: string | null; // set for organiser table-history entries; null for ad hoc "Past Pods" entries
  store_name: string | null;
}

export interface OrganizerProfile {
  id: string;
  store_name: string;
  city: string;
  description: string | null;
  verification_url: string; // Google Maps link, store website, or similar proof of a real, physical store
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringTable {
  id: string;
  organizer_id: string;
  store_name: string;
  game_key: GameKey;
  format_key: string;
  playstyle_key: PlaystyleKey;
  power_tiers: number[] | null;
  type: MatchType;
  location_name: string;
  city: string;
  day_of_week: number; // 0 (Sunday) .. 6 (Saturday) — matches JS Date#getDay()
  start_time: string; // "HH:MM:SS" as returned by Postgres `time`
  end_time: string; // "HH:MM:SS"; <= start_time means the event spans midnight
  max_players: number;
  notes: string | null;
  auto_accept: boolean;
  lead_time_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  pod_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationWithRelations extends Notification {
  actor: Pick<Profile, "id" | "username" | "avatar_url"> | null;
  pod: Pick<
    Pod,
    "id" | "game_key" | "format_key" | "store_name" | "recurring_table_id"
  > | null;
}
