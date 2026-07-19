"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { GameSelector } from "@/components/GameSelector";
import { PlaystyleToggle } from "@/components/PlaystyleToggle";
import { PowerBracketPicker } from "@/components/PowerBracketPicker";
import { createBeacon } from "@/app/actions/beacons";
import type { Profile, PlaystyleKey, MatchType } from "@/types/database";

interface LfgDialogProps {
  open: boolean;
  onClose: () => void;
  onSearchStarted: () => void;
  profile: Profile;
}

const MATCH_TYPES: MatchType[] = ["IRL", "ONLINE"];
const PLAYER_COUNTS = [2, 3, 4, 5, 6];

export function LfgDialog({
  open,
  onClose,
  onSearchStarted,
  profile,
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
  const [selectedBrackets, setSelectedBrackets] = useState<number[]>(
    profile.preferred_brackets ?? [],
  );
  const [selectedMatchType, setSelectedMatchType] = useState<MatchType>(
    profile.preferred_match_type,
  );
  const [locationName, setLocationName] = useState(
    profile.preferred_location_name ?? "",
  );
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
      setSelectedGame(profile.preferred_game);
      setSelectedFormat(profile.preferred_format);
      setSelectedPlaystyle(profile.preferred_playstyle);
      setSelectedBrackets(profile.preferred_brackets ?? []);
      setSelectedMatchType(profile.preferred_match_type);
      setLocationName(profile.preferred_location_name ?? "");
      setMaxPlayers(profile.preferred_max_players);
      setNotes("");
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
    (selectedMatchType !== "IRL" || locationName.trim().length > 0);

  async function handleSearch() {
    setPending(true);
    setError(null);

    const result = await createBeacon({
      gameKey: selectedGame,
      formatKey: selectedFormat,
      playstyleKey: selectedPlaystyle,
      brackets: selectedBrackets,
      matchType: selectedMatchType,
      locationName,
      maxPlayers,
      notes,
    });

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    setPending(false);
    onSearchStarted();
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
            className="flex h-full w-full flex-col gap-6 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:h-auto sm:max-w-2xl sm:overflow-visible sm:p-8"
          >
            <h2 className="text-lg font-semibold text-zinc-50">
              Search Settings
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
                  <div className="flex flex-wrap gap-2">
                    {game.formats.map((format) => (
                      <button
                        key={format.key}
                        type="button"
                        onClick={() => setSelectedFormat(format.key)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                          selectedFormat === format.key
                            ? "border-zinc-50 bg-zinc-50 text-zinc-950"
                            : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        {format.label}
                      </button>
                    ))}
                  </div>
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
                <div className="flex rounded-full border border-zinc-800 bg-zinc-900 p-1">
                  {MATCH_TYPES.map((matchType) => (
                    <button
                      key={matchType}
                      type="button"
                      onClick={() => setSelectedMatchType(matchType)}
                      className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        selectedMatchType === matchType
                          ? "bg-zinc-50 text-zinc-950"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {matchType}
                    </button>
                  ))}
                </div>
              </div>

              {selectedMatchType === "IRL" && (
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label
                    htmlFor="dialog_location_name"
                    className="text-sm font-medium text-zinc-400"
                  >
                    Location
                  </label>
                  <input
                    id="dialog_location_name"
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                    placeholder="Local Game Store name"
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-50 outline-none focus:border-zinc-600"
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
                  Players Needed
                </span>
                <div className="flex gap-2">
                  {PLAYER_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setMaxPlayers(count)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                        maxPlayers === count
                          ? "border-zinc-50 bg-zinc-50 text-zinc-950"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
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
                <label
                  htmlFor="dialog_notes"
                  className="text-sm font-medium text-zinc-400"
                >
                  Notes{" "}
                  <span className="font-normal text-zinc-600">(optional)</span>
                </label>
                <textarea
                  id="dialog_notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Anything else players should know? e.g. deck theme, house rules..."
                  maxLength={300}
                  rows={3}
                  className="resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-50 outline-none focus:border-zinc-600"
                />
                <span className="self-end text-xs text-zinc-600">
                  {notes.length}/300
                </span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="mt-auto flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-zinc-800 px-6 py-3 font-medium text-zinc-400 transition-colors hover:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSearch}
                disabled={!canSubmit || pending}
                className="flex-1 rounded-full bg-zinc-50 px-6 py-3 font-medium text-zinc-950 transition-opacity disabled:opacity-40"
              >
                {pending ? "Starting..." : "Search"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
