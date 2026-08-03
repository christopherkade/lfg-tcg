"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { X } from "lucide-react";
import {
  Alert,
  Button,
  IconButton,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { GameSelector } from "@/components/GameSelector";
import { PowerBracketPicker } from "@/components/PowerBracketPicker";
import {
  createRecurringTable,
  updateRecurringTable,
} from "@/app/actions/organizer";
import { dayOfWeekLabel } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import type { RecurringTable } from "@/types/database";

interface OrganizerRecurringTableFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When provided, edits this existing table via updateRecurringTable instead of creating a new one. */
  editTable?: RecurringTable | null;
}

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];

function parseTimeString(value: string): Date {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function OrganizerRecurringTableFormDialog({
  open,
  onClose,
  onSuccess,
  editTable,
}: OrganizerRecurringTableFormDialogProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();

  const [selectedGame, setSelectedGame] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [selectedBrackets, setSelectedBrackets] = useState<number[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [notes, setNotes] = useState("");
  const [autoAccept, setAutoAccept] = useState(false);
  const [leadTimeHours, setLeadTimeHours] = useState(72);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the form whenever the dialog transitions from closed to open —
  // adjusted during render (not in an effect) per React's "adjusting state
  // when a prop changes" pattern, same as LfgDialog.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      if (editTable) {
        setSelectedGame(editTable.game_key);
        setSelectedFormat(editTable.format_key);
        setSelectedBrackets(editTable.power_tiers ?? []);
        setDayOfWeek(editTable.day_of_week);
        setStartTime(parseTimeString(editTable.start_time));
        setEndTime(parseTimeString(editTable.end_time));
        setMaxPlayers(editTable.max_players);
        setNotes(editTable.notes ?? "");
        setAutoAccept(editTable.auto_accept);
        setLeadTimeHours(editTable.lead_time_hours);
      } else {
        setSelectedGame("");
        setSelectedFormat("");
        setSelectedBrackets([]);
        setDayOfWeek(null);
        setStartTime(null);
        setEndTime(null);
        setMaxPlayers(0);
        setNotes("");
        setAutoAccept(false);
        setLeadTimeHours(72);
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

  // Power Bracket is optional here (unlike the ad hoc LFG dialog): a
  // store's recurring table is a standing public event, not a peer-matched
  // pod, so it doesn't need a specific power level to be meaningful — an
  // empty selection just means "all power levels welcome".
  const canSubmit =
    selectedGame !== "" &&
    selectedFormat !== "" &&
    dayOfWeek != null &&
    startTime != null &&
    endTime != null &&
    maxPlayers > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    const input = {
      gameKey: selectedGame,
      formatKey: selectedFormat,
      // MVP: no organiser-facing playstyle picker, every recurring table is
      // "casual" by default (the column still exists for future use).
      playstyleKey: "casual" as const,
      brackets: selectedBrackets,
      dayOfWeek: dayOfWeek ?? 0,
      startTime: format(startTime as Date, "HH:mm"),
      endTime: format(endTime as Date, "HH:mm"),
      maxPlayers,
      notes,
      autoAccept,
      leadTimeHours,
    };

    const result = editTable
      ? await updateRecurringTable(editTable.id, input)
      : await createRecurringTable(input);

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
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
            className="flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl sm:max-w-lg"
            style={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <div
              className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4"
              style={{ borderBottom: `1px solid ${theme.palette.divider}` }}
            >
              <Typography
                sx={{ fontSize: "1rem", fontWeight: 600, color: "text.primary" }}
              >
                {editTable
                  ? t("organizer.form.title.edit")
                  : t("organizer.form.title.create")}
              </Typography>
              <IconButton
                size="small"
                onClick={onClose}
                aria-label={t("lfgDialog.close")}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
              <GameSelector value={selectedGame} onChange={handleGameChange} />

              {game && game.formats.length > 1 && (
                <ToggleButtonGroup
                  value={selectedFormat}
                  exclusive
                  fullWidth
                  size="small"
                  onChange={(_event, next) => {
                    if (next !== null) setSelectedFormat(next);
                  }}
                >
                  {game.formats.map((formatOption) => (
                    <ToggleButton key={formatOption.key} value={formatOption.key}>
                      {t(`format.${formatOption.key}` as TranslationKey)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}

              <div className="flex flex-col gap-1.5">
                <Typography
                  sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" }}
                >
                  {t("organizer.form.dayOfWeek")}
                </Typography>
                <ToggleButtonGroup
                  value={dayOfWeek}
                  exclusive
                  size="small"
                  onChange={(_event, next: number | null) => {
                    if (next !== null) setDayOfWeek(next);
                  }}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    gap: 0.5,
                    width: "100%",
                    bgcolor: "transparent",
                    border: 0,
                    p: 0,
                    "& .MuiToggleButtonGroup-grouped": {
                      marginLeft: "0 !important",
                      borderRadius: "8px !important",
                    },
                  }}
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <ToggleButton
                      key={day}
                      value={day}
                      sx={(muiTheme) => ({
                        textTransform: "capitalize",
                        fontSize: "0.7rem",
                        px: 0,
                        borderRadius: "8px !important",
                        border: `1px solid ${muiTheme.palette.divider} !important`,
                        marginLeft: "0px !important",
                        bgcolor: muiTheme.palette.background.paper,
                      })}
                    >
                      {dayOfWeekLabel(day, locale).slice(0, 3)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <TimePicker
                  label={t("organizer.form.startTime")}
                  value={startTime}
                  onChange={setStartTime}
                  ampm={false}
                  slotProps={{ textField: { fullWidth: true, size: "small" } }}
                />
                <TimePicker
                  label={t("organizer.form.endTime")}
                  value={endTime}
                  onChange={setEndTime}
                  ampm={false}
                  slotProps={{ textField: { fullWidth: true, size: "small" } }}
                />
              </div>

              <TextField
                label={t("organizer.form.maxPlayers")}
                type="number"
                value={maxPlayers || ""}
                onChange={(event) => setMaxPlayers(Number(event.target.value))}
                slotProps={{ htmlInput: { min: 2, max: 200 } }}
                fullWidth
                size="small"
              />

              <PowerBracketPicker
                visible={hasPowerTiers}
                value={selectedBrackets}
                onChange={setSelectedBrackets}
                maxTier={game?.maxTier}
                label={game?.tierLabel ? t("tier.powerBracket") : undefined}
              />

              <TextField
                label={t("organizer.form.notes")}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 300 } }}
                multiline
                rows={2}
                fullWidth
                size="small"
                helperText={`${notes.length}/300`}
              />

              <TextField
                label={t("organizer.form.leadTimeHours")}
                type="number"
                value={leadTimeHours}
                onChange={(event) => setLeadTimeHours(Number(event.target.value))}
                helperText={t("organizer.form.leadTimeHoursHint")}
                slotProps={{ htmlInput: { min: 1, max: 336 } }}
                fullWidth
                size="small"
              />

              <div
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                style={{ backgroundColor: theme.palette.action.hover }}
              >
                <div className="flex flex-col">
                  <Typography
                    sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "text.primary" }}
                  >
                    {t("organizer.table.autoAccept")}
                  </Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
                    {t("organizer.table.autoAcceptHint")}
                  </Typography>
                </div>
                <Switch
                  checked={autoAccept}
                  onChange={(event) => setAutoAccept(event.target.checked)}
                />
              </div>

              {error && <Alert severity="error">{error}</Alert>}
            </div>

            <div
              className="flex shrink-0 gap-3 px-4 py-3 sm:px-6 sm:py-4"
              style={{ borderTop: `1px solid ${theme.palette.divider}` }}
            >
              <Button
                type="button"
                onClick={onClose}
                variant="outlined"
                fullWidth
                sx={{ py: 1 }}
              >
                {t("organizer.form.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || pending}
                variant="contained"
                fullWidth
                sx={{ py: 1, bgcolor: "#F59E0B", "&:hover": { bgcolor: "#D97706" } }}
              >
                {pending
                  ? t("organizer.form.saving")
                  : editTable
                    ? t("organizer.form.save")
                    : t("organizer.form.create")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
