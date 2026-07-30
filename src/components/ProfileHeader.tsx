"use client";

import { useActionState, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AtSign, Check, Pencil, X } from "lucide-react";
import { Avatar, Box, IconButton, TextField, Typography } from "@mui/material";
import { updateUsername, type ProfileFormState } from "@/app/actions/profile";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { useProfileLock } from "@/lib/ProfileLockContext";

const MotionBox = motion.create(Box);

interface ProfileHeaderProps {
  username: string | null;
  discordHandle: string;
  avatarUrl: string | null | undefined;
}

const initialState: ProfileFormState = {};

export function ProfileHeader({
  username,
  discordHandle,
  avatarUrl,
}: ProfileHeaderProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const { blocked, clearBlock } = useProfileLock();
  const [state, formAction, pending] = useActionState(
    updateUsername,
    initialState,
  );
  const [isEditing, setIsEditing] = useState(!username);

  // Auto-close the field once a submission resolves without an error —
  // computed during render (React's "adjust state when a value changes"
  // pattern) rather than in an effect, so this doesn't cost an extra
  // render pass. `prevActionState` starts equal to `state`, so this never
  // fires on mount, only after a real dispatch (useActionState hands back
  // a new object each time, even across repeated saves).
  const [prevActionState, setPrevActionState] = useState(state);
  if (state !== prevActionState) {
    setPrevActionState(state);
    if (!state.error) {
      setIsEditing(false);
    }
  }

  // A blocked tab-navigation attempt should always surface the field and
  // its error, even if the user had closed it without saving — derived
  // rather than synced via effect.
  const showEditor = isEditing || blocked;

  const displayName = username ?? discordHandle;
  const errorText = state.error ?? (blocked ? t("errors.usernameRequired") : undefined);

  return (
    <MotionBox
      initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
      className="flex w-full max-w-md items-center gap-4 p-5"
    >
      <Avatar src={avatarUrl ?? undefined} sx={{ width: 64, height: 64, fontSize: "1.5rem" }}>
        {displayName[0]?.toUpperCase()}
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {showEditor ? (
          <form action={formAction} className="flex items-center gap-1">
            <TextField
              name="username"
              defaultValue={username ?? ""}
              placeholder={t("profileForm.username")}
              onChange={() => {
                if (blocked) clearBlock();
              }}
              error={Boolean(errorText)}
              helperText={errorText}
              autoFocus
              required
              size="small"
              fullWidth
            />
            <IconButton
              type="submit"
              disabled={pending}
              size="small"
              aria-label={t("profileHeader.saveUsername")}
              sx={{ color: "primary.main" }}
            >
              <Check className="h-4 w-4" />
            </IconButton>
            {username && (
              <IconButton
                type="button"
                size="small"
                aria-label={t("common.cancel")}
                onClick={() => setIsEditing(false)}
                sx={{ color: "text.secondary" }}
              >
                <X className="h-4 w-4" />
              </IconButton>
            )}
          </form>
        ) : (
          <div className="flex items-center gap-1">
            <Typography
              component="h2"
              className="truncate"
              sx={{ fontSize: "1.25rem", fontWeight: 700, color: "text.primary" }}
            >
              {displayName}
            </Typography>
            <IconButton
              size="small"
              aria-label={t("profileHeader.editUsername")}
              onClick={() => setIsEditing(true)}
              sx={{ color: "text.secondary" }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        )}

        <Box
          sx={{ color: "text.secondary" }}
          className="flex min-w-0 items-center gap-1"
          title={t("profileHeader.discordSynced")}
        >
          <AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <Typography className="truncate" sx={{ fontSize: "0.875rem", color: "inherit" }}>
            <span className="sr-only">{t("profileHeader.discordSynced")}: </span>
            {discordHandle}
          </Typography>
        </Box>
      </div>
    </MotionBox>
  );
}
