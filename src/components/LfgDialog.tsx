"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { CalendarClock, Sparkles, Swords, X } from "lucide-react";
import {
  Alert,
  Button,
  IconButton,
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
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
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
  const { t } = useTranslation();
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
            className="flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 sm:max-w-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-900 px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold text-zinc-50">
                  {editPod ? t("lfgDialog.title.edit") : t("lfgDialog.title.create")}
                </h2>
                <p className="text-xs text-zinc-400">
                  {editPod
                    ? t("lfgDialog.subtitle.edit")
                    : t("lfgDialog.subtitle.create")}
                </p>
              </div>
              <IconButton
                aria-label={t("lfgDialog.close")}
                size="small"
                onClick={onClose}
                sx={{ color: "#a1a1aa", mt: "-4px", mr: "-8px" }}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
              <section className="flex flex-col gap-2 rounded-xl border border-zinc-900 bg-zinc-900/40 p-3 sm:gap-2.5 sm:p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                  <Swords className="h-3.5 w-3.5" />
                  {t("lfgDialog.section.game")}
                </div>
                <GameSelector value={selectedGame} onChange={handleGameChange} />

                {game && game.formats.length > 1 && (
                  <ToggleButtonGroup
                    value={selectedFormat}
                    exclusive
                    fullWidth
                    size="small"
                    onChange={(_event, next) => {
                      if (next !== null) {
                        setSelectedFormat(next);
                      }
                    }}
                    sx={{
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
                        {t(`format.${formatOption.key}` as TranslationKey)}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                )}
              </section>

              <section className="flex flex-col gap-2.5 rounded-xl border border-zinc-900 bg-zinc-900/40 p-3 sm:gap-3 sm:p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t("lfgDialog.section.whenWhere")}
                </div>

                <ToggleButtonGroup
                  value={selectedMatchType}
                  exclusive
                  fullWidth
                  size="small"
                  onChange={(_event, next: MatchType | null) => {
                    if (next !== null) {
                      setSelectedMatchType(next);
                    }
                  }}
                >
                  {MATCH_TYPES.map((matchType) => (
                    <ToggleButton key={matchType} value={matchType}>
                      {matchType === "IRL"
                        ? t("podFilters.matchTypeIrl")
                        : t("podFilters.matchTypeOnline")}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                {selectedMatchType === "IRL" && (
                  <div className="flex flex-col gap-2.5 sm:gap-3">
                    <TextField
                      id="dialog_location_name"
                      label={t("lfgDialog.locationLabel")}
                      value={locationName}
                      onChange={(event) =>
                        setLocationName(event.target.value)
                      }
                      placeholder={t("lfgDialog.locationPlaceholder")}
                      fullWidth
                      size="small"
                    />
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                      <DatePicker
                        label={t("lfgDialog.dateLabel")}
                        value={scheduledDate}
                        onChange={(next) => setScheduledDate(next)}
                        slotProps={{
                          textField: { fullWidth: true, size: "small" },
                        }}
                      />
                      <TimePicker
                        label={t("lfgDialog.timeLabel")}
                        value={scheduledTime}
                        onChange={(next) => setScheduledTime(next)}
                        ampm={false}
                        slotProps={{
                          textField: { fullWidth: true, size: "small" },
                        }}
                      />
                    </div>
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-2.5 rounded-xl border border-zinc-900 bg-zinc-900/40 p-3 sm:gap-3 sm:p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("lfgDialog.section.preferences")}
                </div>

                <div className="flex flex-col gap-2.5 sm:gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-zinc-300">
                      {t("lfgDialog.playstyleLabel")}
                    </span>
                    <PlaystyleToggle
                      value={selectedPlaystyle}
                      onChange={setSelectedPlaystyle}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-zinc-300">
                      {t("lfgDialog.playersLabel")}
                    </span>
                    <ToggleButtonGroup
                      value={maxPlayers}
                      exclusive
                      fullWidth
                      size="small"
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
                            fontSize: "0.75rem",
                            px: 0,
                            borderRadius: "8px !important",
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
                </div>

                <PowerBracketPicker
                  visible={hasPowerTiers}
                  value={selectedBrackets}
                  onChange={setSelectedBrackets}
                  maxTier={game?.maxTier}
                  label={game?.tierLabel ? t("tier.powerBracket") : undefined}
                />

                <TextField
                  id="dialog_notes"
                  label={t("lfgDialog.notesLabel")}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t("lfgDialog.notesPlaceholder")}
                  slotProps={{ htmlInput: { maxLength: 300 } }}
                  multiline
                  rows={2}
                  fullWidth
                  size="small"
                  helperText={`${notes.length}/300`}
                />
              </section>

              {error && <Alert severity="error">{error}</Alert>}
            </div>

            <div className="flex shrink-0 gap-3 border-t border-zinc-900 px-4 py-3 sm:px-6 sm:py-4">
              <Button
                type="button"
                onClick={onClose}
                variant="outlined"
                fullWidth
                sx={{ py: 1, borderColor: "#3f3f46", color: "#e4e4e7" }}
              >
                {t("lfgDialog.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSearch}
                disabled={!canSubmit || pending}
                variant="contained"
                fullWidth
                sx={{ py: 1 }}
              >
                {editPod
                  ? pending
                    ? t("lfgDialog.save.pending")
                    : t("lfgDialog.save.idle")
                  : pending
                    ? t("lfgDialog.search.pending")
                    : t("lfgDialog.search.idle")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
