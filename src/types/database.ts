export type GameKey = "MTG" | "ONE_PIECE" | "POKEMON" | "LORCANA";
export type PlaystyleKey = "casual" | "competitive";
export type MatchType = "IRL" | "ONLINE";
export type BeaconStatus = "ACTIVE" | "MATCHED" | "EXPIRED";
export type JoinStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type NotificationType =
  | "JOIN_REQUEST"
  | "JOIN_ACCEPTED"
  | "JOIN_REJECTED"
  | "MEMBER_LEFT"
  | "BEACON_UPDATED";

export interface Profile {
  id: string;
  updated_at: string;
  username: string;
  discord_handle: string;
  avatar_url: string | null;
  preferred_game: GameKey;
  preferred_format: string;
  preferred_playstyle: PlaystyleKey;
  preferred_brackets: number[] | null;
  preferred_match_type: MatchType;
  preferred_location_name: string | null;
  preferred_max_players: number;
}

export interface Beacon {
  id: string;
  user_id: string;
  game_key: GameKey;
  format_key: string;
  playstyle_key: PlaystyleKey;
  power_tiers: number[] | null;
  type: MatchType;
  location_name: string | null;
  scheduled_at: string | null;
  max_players: number;
  notes: string | null;
  status: BeaconStatus;
  created_at: string;
  expires_at: string;
}

export interface BeaconJoin {
  id: string;
  beacon_id: string;
  user_id: string;
  status: JoinStatus;
  joined_at: string;
}

export interface BeaconJoinWithProfile extends BeaconJoin {
  profiles: Profile;
}

export interface BeaconWithRelations extends Beacon {
  profiles: Profile;
  beacon_joins: BeaconJoinWithProfile[];
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  beacon_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationWithRelations extends Notification {
  actor: Pick<Profile, "id" | "username" | "avatar_url"> | null;
  beacon: Pick<Beacon, "id" | "game_key" | "format_key"> | null;
}
