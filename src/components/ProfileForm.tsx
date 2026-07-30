"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { Check, LogOut, Trash2 } from "lucide-react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  updateCity,
  signOut,
  deleteAccount,
  type ProfileFormState,
} from "@/app/actions/profile";
import { CitySelector } from "@/components/CitySelector";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { Profile } from "@/types/database";

interface ProfileFormProps {
  initialProfile: Profile | null;
}

const initialState: ProfileFormState = {};

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, dispatchCityUpdate, pending] = useActionState(
    updateCity,
    initialState,
  );
  const [city, setCity] = useState<string | null>(initialProfile?.city ?? null);
  const [savedCity, setSavedCity] = useState<string | null>(
    initialProfile?.city ?? null,
  );
  const [submittedCity, setSubmittedCity] = useState(city);

  // Same "did the action state object change" derived-state idiom as
  // `ProfileHeader`'s `prevActionState` — useActionState hands back a new
  // object on every resolved dispatch, so this only fires after a real
  // save, never on mount. Records which city a resolved, error-free save
  // actually corresponds to (not necessarily the *current* selection, if
  // the user picked something else while the previous save was in flight).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (!state.error) {
      setSavedCity(submittedCity);
    }
  }

  function handleCityChange(next: string | null) {
    setCity(next);
    setSubmittedCity(next);
    const formData = new FormData();
    formData.set("city", next ?? "");
    startTransition(() => {
      dispatchCityUpdate(formData);
    });
  }

  const showSavedCheck = !pending && !state.error && savedCity === city;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleDeleteAccount() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteAccount();
      if (result?.error) {
        setDeleteError(result.error);
      }
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      {initialProfile ? (
        <div className="flex flex-col gap-6">
          {!city && (
            <Alert severity="info">{t("profilePage.cityMissingInfo")}</Alert>
          )}
          <Box className="flex items-start gap-2">
            <Box className="flex-1">
              <CitySelector value={city} onChange={handleCityChange} />
            </Box>
            <Box
              sx={{ height: 40 }}
              className="flex shrink-0 items-center justify-center"
            >
              {pending && (
                <CircularProgress
                  size={18}
                  aria-label={t("profileForm.city.saving")}
                />
              )}
              {showSavedCheck && (
                <Check
                  className="h-5 w-5"
                  aria-label={t("profileForm.city.saved")}
                  style={{ color: theme.palette.success.main }}
                />
              )}
            </Box>
          </Box>

          {state?.error && <Alert severity="error">{state.error}</Alert>}
        </div>
      ) : (
        <Alert severity="info">{t("profilePage.usernameRequiredInfo")}</Alert>
      )}

      <form action={signOut}>
        <Button
          type="submit"
          variant="outlined"
          color="error"
          fullWidth
          startIcon={<LogOut className="h-4 w-4" />}
          sx={{
            py: 1.5,
            borderColor: "rgba(239, 68, 68, 0.3)",
            bgcolor: "rgba(239, 68, 68, 0.1)",
            "&:hover": {
              bgcolor: "rgba(239, 68, 68, 0.2)",
              borderColor: "rgba(239, 68, 68, 0.3)",
            },
          }}
        >
          {t("profileForm.signOut")}
        </Button>
      </form>

      <Button
        type="button"
        onClick={() => setDeleteOpen(true)}
        variant="outlined"
        color="error"
        fullWidth
        startIcon={<Trash2 className="h-4 w-4" />}
        sx={{
          py: 1.5,
          borderColor: "rgba(239, 68, 68, 0.3)",
          color: "rgba(239, 68, 68, 0.9)",
          "&:hover": {
            bgcolor: "rgba(239, 68, 68, 0.1)",
            borderColor: "rgba(239, 68, 68, 0.3)",
          },
        }}
      >
        {t("profileForm.deleteAccount")}
      </Button>

      <DeleteAccountDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
        pending={deletePending}
        error={deleteError}
      />
    </div>
  );
}
