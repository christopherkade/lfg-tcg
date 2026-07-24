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
}

export interface PodJoin {
  id: string;
  pod_id: string;
  user_id: string;
  status: JoinStatus;
  joined_at: string;
}

export interface PodJoinWithProfile extends PodJoin {
  profiles: Profile;
}

export interface PodWithRelations extends Pod {
  profiles: Profile;
  pod_joins: PodJoinWithProfile[];
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
  pod: Pick<Pod, "id" | "game_key" | "format_key"> | null;
}
