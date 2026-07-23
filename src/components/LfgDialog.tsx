"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import {
  Alert,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { GameSelector } from "@/components/GameSelector";
import { PlaystyleToggle } from "@/components/PlaystyleToggle";
import { PowerBracketPicker } from "@/components/PowerBracketPicker";
import { createPod, updatePod } from "@/app/actions/pods";
import type { Pod, Profile, PlaystyleKey, MatchType } from "@/types/database";

interface LfgDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  profile: Profile;
  /**
   * When provided, the dialog edits this existing (still ACTIVE) pod in
   * place via updatePod instead of starting a brand new search via
   * createPod — used by MyPodPanel's "Edit" action. All fields reset
   * from the pod's own values (not the profile's `preferred_*`) each
   * time the dialog opens.
   */
  editPod?: Pod | null;
}

const MATCH_TYPES: MatchType[] = ["IRL", "ONLINE"];
const PLAYER_COUNTS = [2, 3, 4, 5, 6];

/**
 * Search-settings inputs persist across dialog opens (and page reloads) via
 * localStorage, keyed per-profile, so a fresh "Search" dialog starts from
 * whatever the player last used instead of always resetting to the
 * `preferred_*` profile defaults. Only used for brand new searches — the
 * `editPod` flow still seeds fields from the pod being edited.
 */
interface StoredSearchInput {
  gameKey: string;
  formatKey: string;
  playstyleKey: PlaystyleKey;
  brackets: number[];
  matchType: MatchType;
  locationName: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  maxPlayers: number;
  notes: string;
}

function storageKey(profileId: string) {
  return `lfg-tcg:last-search:${profileId}`;
}

function loadStoredSearchInput(profileId: string): StoredSearchInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    return raw ? (JSON.parse(raw) as StoredSearchInput) : null;
  } catch {
    return null;
  }
}

function saveStoredSearchInput(profileId: string, input: StoredSearchInput) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(profileId), JSON.stringify(input));
  } catch {
    // Ignore quota/serialization errors — persistence is a convenience,
    // not a requirement.
  }
}

export function LfgDialog({
  open,
  onClose,
  onSuccess,
  profile,
  editPod,
}: LfgDialogProps) {
  const [selectedGame, setSelectedGame] = useState<string>(
    profile.preferred_game,
  );
  const [selectedFormat, setSelectedFormat] = useState(
    profile.preferred_format,
  );
  const [selectedPlaystyle, setSelectedPlaystyle] = useState<PlaystyleKey>(
    profile.preferred_playstyle,
  );
  const [selectedBrackets, setSelectedBrackets] = useState<number[]>([]);
  const [selectedMatchType, setSelectedMatchType] = useState<MatchType>(
    profile.preferred_match_type,
  );
  const [locationName, setLocationName] = useState(
    profile.preferred_location_name ?? "",
  );
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(profile.preferred_max_players);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the form with the latest saved settings every time the dialog
  // transitions from closed to open. Adjusted during render (not in an
  // effect) per React's "adjusting state when a prop changes" pattern.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      if (editPod) {
        const scheduled = editPod.scheduled_at
          ? new Date(editPod.scheduled_at)
          : null;
        setSelectedGame(editPod.game_key);
        setSelectedFormat(editPod.format_key);
        setSelectedPlaystyle(editPod.playstyle_key);
        setSelectedBrackets(editPod.power_tiers ?? []);
        setSelectedMatchType(editPod.type);
        setLocationName(editPod.location_name ?? "");
        setScheduledDate(scheduled);
        setScheduledTime(scheduled);
        setMaxPlayers(editPod.max_players);
        setNotes(editPod.notes ?? "");
      } else {
        const stored = loadStoredSearchInput(profile.id);
        setSelectedGame(stored?.gameKey ?? profile.preferred_game);
        setSelectedFormat(stored?.formatKey ?? profile.preferred_format);
        setSelectedPlaystyle(
          stored?.playstyleKey ?? profile.preferred_playstyle,
        );
        setSelectedBrackets(stored?.brackets ?? []);
        setSelectedMatchType(stored?.matchType ?? profile.preferred_match_type);
        setLocationName(
          stored?.locationName ?? profile.preferred_location_name ?? "",
        );
        setScheduledDate(
          stored?.scheduledDate ? new Date(stored.scheduledDate) : null,
        );
        setScheduledTime(
          stored?.scheduledTime ? new Date(stored.scheduledTime) : null,
        );
        setMaxPlayers(stored?.maxPlayers ?? profile.preferred_max_players);
        setNotes(stored?.notes ?? "");
      }
      setError(null);
    }
  }

  const game = GAMES_CONFIG[selectedGame];
  const hasPowerTiers = game?.hasPowerTiers ?? false;

  function handleGameChange(gameKey: string) {
    setSelectedGame(gameKey);
    setSelectedFormat(GAMES_CONFIG[gameKey]?.formats[0]?.key ?? "");
    if (!GAMES_CONFIG[gameKey]?.hasPowerTiers) {
      setSelectedBrackets([]);
    }
  }

  const canSubmit =
    (!hasPowerTiers || selectedBrackets.length > 0) &&
    (selectedMatchType !== "IRL" ||
      (locationName.trim().length > 0 &&
        scheduledDate !== null &&
        scheduledTime !== null));

  async function handleSearch() {
    setPending(true);
    setError(null);

    const input = {
      gameKey: selectedGame,
      formatKey: selectedFormat,
      playstyleKey: selectedPlaystyle,
      brackets: selectedBrackets,
      matchType: selectedMatchType,
      locationName,
      scheduledDate: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : "",
      scheduledTime: scheduledTime ? format(scheduledTime, "HH:mm") : "",
      maxPlayers,
      notes,
    };

    const result = editPod
      ? await updatePod(editPod.id, input)
      : await createPod(input);

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    if (!editPod) {
      saveStoredSearchInput(profile.id, {
        gameKey: input.gameKey,
        formatKey: input.formatKey,
        playstyleKey: input.playstyleKey,
        brackets: input.brackets,
        matchType: input.matchType,
        locationName: input.locationName,
        scheduledDate: scheduledDate ? scheduledDate.toISOString() : null,
        scheduledTime: scheduledTime ? scheduledTime.toISOString() : null,
        maxPlayers: input.maxPlayers,
        notes: input.notes,
      });
    }

    setPending(false);
    onSuccess();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4 sm:p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="flex h-full w-full flex-col gap-6 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:max-w-2xl sm:p-8"
          >
            <h2 className="text-lg font-semibold text-zinc-50">
              {editPod ? "Edit Pod" : "Search Settings"}
            </h2>

            <div className="flex flex-col gap-6 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-6">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-zinc-400">Game</span>
                <GameSelector
                  value={selectedGame}
                  onChange={handleGameChange}
                />
              </div>

              {game && game.formats.length > 1 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-400">
                    Format
                  </span>
                  <ToggleButtonGroup
                    value={selectedFormat}
                    exclusive
                    onChange={(_event, next) => {
                      if (next !== null) {
                        setSelectedFormat(next);
                      }
                    }}
                    sx={{
                      flexWrap: "wrap",
                      bgcolor: "transparent",
                      border: 0,
                      p: 0,
                      gap: 1,
                    }}
                  >
                    {game.formats.map((formatOption) => (
                      <ToggleButton
                        key={formatOption.key}
                        value={formatOption.key}
                      >
                        {formatOption.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </div>
              )}

              <div
                className={`flex flex-col gap-2 ${
                  game && game.formats.length > 1 ? "" : "sm:col-span-2"
                }`}
              >
                <span className="text-sm font-medium text-zinc-400">
                  Match Type
                </span>
                <ToggleButtonGroup
                  value={selectedMatchType}
                  exclusive
                  fullWidth
                  onChange={(_event, next: MatchType | null) => {
                    if (next !== null) {
                      setSelectedMatchType(next);
                    }
                  }}
                >
                  {MATCH_TYPES.map((matchType) => (
                    <ToggleButton key={matchType} value={matchType}>
                      {matchType}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </div>

              {selectedMatchType === "IRL" && (
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <TextField
                    id="dialog_location_name"
                    label="Location"
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                    placeholder="Where will you be playing?"
                    fullWidth
                    size="small"
                  />
                </div>
              )}

              {selectedMatchType === "IRL" && (
                <div className="flex flex-col gap-2">
                  <DatePicker
                    label="Date"
                    value={scheduledDate}
                    onChange={(next) => setScheduledDate(next)}
                    slotProps={{
                      textField: { fullWidth: true, size: "small" },
                    }}
                  />
                </div>
              )}

              {selectedMatchType === "IRL" && (
                <div className="flex flex-col gap-2">
                  <TimePicker
                    label="Time"
                    value={scheduledTime}
                    onChange={(next) => setScheduledTime(next)}
                    ampm={false}
                    slotProps={{
                      textField: { fullWidth: true, size: "small" },
                    }}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-400">
                  Playstyle
                </span>
                <PlaystyleToggle
                  value={selectedPlaystyle}
                  onChange={setSelectedPlaystyle}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-400">
                  Total players Needed
                </span>
                <ToggleButtonGroup
                  value={maxPlayers}
                  exclusive
                  onChange={(_event, next: number | null) => {
                    if (next !== null) {
                      setMaxPlayers(next);
                    }
                  }}
                  sx={{ bgcolor: "transparent", border: 0, p: 0, gap: 1 }}
                >
                  {PLAYER_COUNTS.map((count) => (
                    <ToggleButton
                      key={count}
                      value={count}
                      sx={{
                        height: 40,
                        width: 40,
                        borderRadius: "9999px !important",
                        border: "1px solid #27272a !important",
                        marginLeft: "0px !important",
                        bgcolor: "#18181b",
                      }}
                    >
                      {count}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </div>

              <div className="sm:col-span-2">
                <PowerBracketPicker
                  visible={hasPowerTiers}
                  value={selectedBrackets}
                  onChange={setSelectedBrackets}
                  maxTier={game?.maxTier}
                  label={game?.tierLabel}
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <TextField
                  id="dialog_notes"
                  label="Notes (optional)"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Anything else players should know? e.g. deck theme, house rules..."
                  slotProps={{ htmlInput: { maxLength: 300 } }}
                  multiline
                  rows={3}
                  fullWidth
                  helperText={`${notes.length}/300`}
                />
              </div>
            </div>

            {error && <Alert severity="error">{error}</Alert>}

            <div className="mt-auto flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outlined"
                fullWidth
                sx={{ py: 1.5, borderColor: "#27272a", color: "#a1a1aa" }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSearch}
                disabled={!canSubmit || pending}
                variant="contained"
                fullWidth
                sx={{ py: 1.5 }}
              >
                {editPod
                  ? pending
                    ? "Saving..."
                    : "Save Changes"
                  : pending
                    ? "Starting..."
                    : "Search"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
