"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { CalendarClock, ChevronDown, Sparkles, Swords, X } from "lucide-react";
import {
  Alert,
  Button,
  IconButton,
  Link,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { GameSelector } from "@/components/GameSelector";
import { PlaystyleToggle } from "@/components/PlaystyleToggle";
import { PowerBracketPicker } from "@/components/PowerBracketPicker";
import { cancelPod, createPod, updatePod } from "@/app/actions/pods";
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

// Only restore/persist the last-used search settings outside of production,
// so local testing doesn't require refilling the form every time — real
// users always start from a blank dialog.
// const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_PRODUCTION = true;

/**
 * Search-settings inputs persist across dialog opens (and page reloads) via
 * localStorage in development, keyed per-profile, so a fresh "Search" dialog
 * starts from whatever the player last used instead of a blank form. Only
 * used for brand new searches — the `editPod` flow still seeds fields from
 * the pod being edited.
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

function DialogSection({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <section className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 pb-1.5 text-[11px] font-semibold tracking-wide uppercase"
        style={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.secondary,
        }}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 sm:gap-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function LfgDialog({
  open,
  onClose,
  onSuccess,
  profile,
  editPod,
}: LfgDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedGame, setSelectedGame] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [selectedPlaystyle, setSelectedPlaystyle] = useState<PlaystyleKey | "">(
    "",
  );
  const [selectedBrackets, setSelectedBrackets] = useState<number[]>([]);
  const [selectedMatchType, setSelectedMatchType] = useState<MatchType | "">(
    "IRL",
  );
  const [locationName, setLocationName] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // MUI's date/time pickers report `null` for a field that's still
  // mid-entry (e.g. only the hour typed, minutes left as "mm") — the input
  // visually looks filled, so without this the Search button just goes
  // quietly disabled with no clue why. These track that "invalid, not just
  // empty" state so we can explain it inline instead.
  const [dateIncomplete, setDateIncomplete] = useState(false);
  const [timeIncomplete, setTimeIncomplete] = useState(false);

  // The dialog opens as a simple wizard: only "Game" starts expanded, and
  // picking a game or filling in a date + time auto-advances the next
  // section, while the user can still freely expand/collapse any of them.
  const [gameSectionOpen, setGameSectionOpen] = useState(true);
  const [whenWhereSectionOpen, setWhenWhereSectionOpen] = useState(false);
  const [preferencesSectionOpen, setPreferencesSectionOpen] = useState(false);

  // Focused once a date is picked, so the user can immediately continue
  // into the time field without an extra click.
  const timeFieldRef = useRef<HTMLInputElement>(null);

  // The error Alert renders at the bottom of the scrollable content area, so
  // if the user has a tall form scrolled to the top (or on a small viewport)
  // a submission error can appear entirely off-screen. Scroll it into view
  // whenever a new error comes in.
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      contentRef.current?.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [error]);

  // Cancel/close stays clickable while a submission is in flight (only the
  // Search/Save button disables). If the user closes the dialog during that
  // window, this tells handleSearch to drop the result instead of firing
  // onSuccess (and its navigation) once the request resolves.
  const cancelledRef = useRef(false);

  function handleCancel() {
    if (pending) {
      cancelledRef.current = true;
    }
    onClose();
  }

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
        // Editing an existing pod means every field already has a value
        // worth reviewing, so show all three sections right away.
        setGameSectionOpen(true);
        setWhenWhereSectionOpen(true);
        setPreferencesSectionOpen(true);
      } else {
        const stored = IS_PRODUCTION ? null : loadStoredSearchInput(profile.id);
        setSelectedGame(stored?.gameKey ?? "");
        setSelectedFormat(stored?.formatKey ?? "");
        setSelectedPlaystyle(stored?.playstyleKey ?? "");
        setSelectedBrackets(stored?.brackets ?? []);
        setSelectedMatchType(stored?.matchType ?? "IRL");
        setLocationName(stored?.locationName ?? "");
        setScheduledDate(
          stored?.scheduledDate ? new Date(stored.scheduledDate) : null,
        );
        setScheduledTime(
          stored?.scheduledTime ? new Date(stored.scheduledTime) : null,
        );
        setMaxPlayers(stored?.maxPlayers ?? 0);
        setNotes(stored?.notes ?? "");
        // A brand new search starts with only "Game" expanded; the other
        // two only auto-open once restored (dev-only) values fill them in.
        setGameSectionOpen(true);
        setWhenWhereSectionOpen(Boolean(stored?.gameKey));
        setPreferencesSectionOpen(
          stored?.matchType === "ONLINE" ||
            Boolean(stored?.scheduledDate && stored?.scheduledTime),
        );
      }
      setError(null);
      setDateIncomplete(false);
      setTimeIncomplete(false);
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
    setWhenWhereSectionOpen(true);
  }

  function handleScheduledDateChange(next: Date | null) {
    setScheduledDate(next);
    if (next && scheduledTime) {
      setPreferencesSectionOpen(true);
    }
    if (next) {
      // Deferred: picking a date from the calendar popup closes it, and
      // MUI restores focus to the date field's own button once that
      // popup's exit transition finishes — which happens after this
      // handler runs. Queuing the focus call past that transition lets it
      // win instead of being immediately overridden.
      setTimeout(() => timeFieldRef.current?.focus(), 300);
    }
  }

  function handleScheduledTimeChange(next: Date | null) {
    setScheduledTime(next);
    if (scheduledDate && next) {
      setPreferencesSectionOpen(true);
    }
  }

  const missingCity = selectedMatchType === "IRL" && !profile.city;

  const canSubmit =
    selectedGame !== "" &&
    selectedFormat !== "" &&
    selectedPlaystyle !== "" &&
    selectedMatchType !== "" &&
    maxPlayers > 0 &&
    (!hasPowerTiers || selectedBrackets.length > 0) &&
    (selectedMatchType !== "IRL" ||
      (!missingCity &&
        locationName.trim().length > 0 &&
        scheduledDate !== null &&
        scheduledTime !== null));

  async function handleSearch() {
    if (!canSubmit) return;

    cancelledRef.current = false;
    setPending(true);
    setError(null);

    const input = {
      gameKey: selectedGame,
      formatKey: selectedFormat,
      // canSubmit already guarantees both are non-empty by this point.
      playstyleKey: selectedPlaystyle as PlaystyleKey,
      brackets: selectedBrackets,
      matchType: selectedMatchType as MatchType,
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
    if (cancelledRef.current) {
      // The search itself already went through (a pod now exists/was
      // updated), but the user backed out before we could navigate them
      // there — so a brand new pod shouldn't linger ACTIVE in the
      // background as a search they never saw confirmed. Editing an
      // existing pod has no such dangling side effect (it was already
      // ACTIVE, and its dialog never navigates), so only cancel here for
      // the create flow.
      if (!editPod && result.podId) {
        void cancelPod(result.podId);
      }
      return;
    }
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
          onClick={handleCancel}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl sm:max-w-xl"
            style={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <div
              className="flex shrink-0 items-start justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4"
              style={{ borderBottom: `1px solid ${theme.palette.divider}` }}
            >
              <div className="flex flex-col gap-0.5">
                <Typography
                  component="h2"
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "text.primary",
                  }}
                >
                  {editPod
                    ? t("lfgDialog.title.edit")
                    : t("lfgDialog.title.create")}
                </Typography>
                <Typography
                  component="p"
                  sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                >
                  {editPod
                    ? t("lfgDialog.subtitle.edit")
                    : t("lfgDialog.subtitle.create")}
                </Typography>
              </div>
              <IconButton
                aria-label={t("lfgDialog.close")}
                size="small"
                onClick={handleCancel}
                sx={{ color: "text.secondary", mt: "-4px", mr: "-8px" }}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div
              ref={contentRef}
              className="flex flex-col gap-3 overflow-y-auto px-4 py-3 sm:gap-4 sm:px-6 sm:py-4"
            >
              <DialogSection
                icon={<Swords className="h-3.5 w-3.5" />}
                title={t("lfgDialog.section.game")}
                open={gameSectionOpen}
                onToggle={() => setGameSectionOpen((prev) => !prev)}
              >
                <GameSelector
                  value={selectedGame}
                  onChange={handleGameChange}
                />

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
              </DialogSection>

              <DialogSection
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                title={t("lfgDialog.section.whenWhere")}
                open={whenWhereSectionOpen}
                onToggle={() => setWhenWhereSectionOpen((prev) => !prev)}
              >
                <ToggleButtonGroup
                  value={selectedMatchType}
                  exclusive
                  fullWidth
                  size="small"
                  onChange={(_event, next: MatchType | null) => {
                    if (next !== null) {
                      setSelectedMatchType(next);
                      if (next === "ONLINE") {
                        setPreferencesSectionOpen(true);
                      }
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

                {missingCity && (
                  <Alert severity="warning">
                    {t("lfgDialog.cityRequiredError.pre")}
                    <Link href="/profile" sx={{ color: "inherit", fontWeight: 600 }}>
                      {t("lfgDialog.cityRequiredError.link")}
                    </Link>
                    {t("lfgDialog.cityRequiredError.post")}
                  </Alert>
                )}

                {selectedMatchType === "IRL" && (
                  <div className="flex flex-col gap-2.5 sm:gap-3">
                    <TextField
                      id="dialog_location_name"
                      label={t("lfgDialog.locationLabel")}
                      value={locationName}
                      onChange={(event) => setLocationName(event.target.value)}
                      placeholder={t("lfgDialog.locationPlaceholder")}
                      fullWidth
                      size="small"
                    />
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                      <DatePicker
                        label={t("lfgDialog.dateLabel")}
                        value={scheduledDate}
                        onChange={handleScheduledDateChange}
                        onError={(reason) => {
                          console.log("[LfgDialog] date onError", reason);
                          setDateIncomplete(reason !== null);
                        }}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: "small",
                            helperText: dateIncomplete
                              ? t("lfgDialog.dateIncomplete")
                              : undefined,
                          },
                        }}
                      />
                      <TimePicker
                        label={t("lfgDialog.timeLabel")}
                        value={scheduledTime}
                        onChange={handleScheduledTimeChange}
                        onError={(reason) => {
                          console.log("[LfgDialog] time onError", reason);
                          setTimeIncomplete(reason !== null);
                        }}
                        ampm={false}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: "small",
                            inputRef: timeFieldRef,
                            helperText: timeIncomplete
                              ? t("lfgDialog.timeIncomplete")
                              : undefined,
                          },
                          // MUI X's PickersLayout grid reserves a column
                          // for a (hidden, since we don't render one)
                          // landscape toolbar, which otherwise shows up
                          // as dead space to the left of the hour list.
                          layout: {
                            sx: {
                              "& .MuiPickersLayout-contentWrapper": {
                                gridColumn: "1 / -1",
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                )}
              </DialogSection>

              <DialogSection
                icon={<Sparkles className="h-3.5 w-3.5" />}
                title={t("lfgDialog.section.preferences")}
                open={preferencesSectionOpen}
                onToggle={() => setPreferencesSectionOpen((prev) => !prev)}
              >
                <div className="flex flex-col gap-1.5">
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "text.secondary",
                    }}
                  >
                    {t("lfgDialog.playstyleLabel")}
                  </Typography>
                  <PlaystyleToggle
                    value={selectedPlaystyle}
                    onChange={setSelectedPlaystyle}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "text.secondary",
                    }}
                  >
                    {t("lfgDialog.playersLabel")}
                  </Typography>
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
                        sx={(theme) => ({
                          fontSize: "0.75rem",
                          px: 0,
                          borderRadius: "8px !important",
                          border: `1px solid ${theme.palette.divider} !important`,
                          marginLeft: "0px !important",
                          bgcolor: theme.palette.background.paper,
                        })}
                      >
                        {count}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
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
                  sx={{ mt: 1 }}
                />
              </DialogSection>

              {error && <Alert severity="error">{error}</Alert>}
            </div>

            <div
              className="flex shrink-0 gap-3 px-4 py-3 sm:px-6 sm:py-4"
              style={{ borderTop: `1px solid ${theme.palette.divider}` }}
            >
              <Button
                type="button"
                onClick={handleCancel}
                variant="outlined"
                fullWidth
                sx={{ py: 1 }}
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
