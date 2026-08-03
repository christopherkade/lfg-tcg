"use client";

import { useState } from "react";
import { Alert, Button, TextField, Typography } from "@mui/material";
import { CitySelector } from "@/components/CitySelector";
import { updateOrganizerProfile } from "@/app/actions/organizer";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { OrganizerProfile } from "@/types/database";

interface OrganizerStoreSettingsFormProps {
  organizer: OrganizerProfile;
}

export function OrganizerStoreSettingsForm({
  organizer,
}: OrganizerStoreSettingsFormProps) {
  const { t } = useTranslation();
  const [storeName, setStoreName] = useState(organizer.store_name);
  const [city, setCity] = useState<string | null>(organizer.city);
  const [description, setDescription] = useState(organizer.description ?? "");
  const [verificationUrl, setVerificationUrl] = useState(
    organizer.verification_url,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canSubmit =
    storeName.trim().length > 0 &&
    city != null &&
    verificationUrl.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updateOrganizerProfile({
      storeName,
      city: city ?? "",
      description,
      verificationUrl,
    });

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    setSaved(true);
    setPending(false);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Typography
        component="h1"
        sx={{ fontSize: "1.25rem", fontWeight: 700, color: "text.primary" }}
      >
        {t("organizer.settings.title")}
      </Typography>

      <TextField
        label={t("organizer.apply.storeName")}
        value={storeName}
        onChange={(event) => {
          setStoreName(event.target.value);
          setSaved(false);
        }}
        slotProps={{ htmlInput: { maxLength: 80 } }}
        fullWidth
        size="small"
      />
      <CitySelector
        value={city}
        onChange={(next) => {
          setCity(next);
          setSaved(false);
        }}
        helperText={t("organizer.apply.cityHelperText")}
      />
      <TextField
        label={t("organizer.apply.verificationUrl")}
        value={verificationUrl}
        onChange={(event) => {
          setVerificationUrl(event.target.value);
          setSaved(false);
        }}
        placeholder={t("organizer.apply.verificationUrlPlaceholder")}
        helperText={t("organizer.apply.verificationUrlHint")}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        fullWidth
        size="small"
      />
      <TextField
        label={t("organizer.apply.description")}
        value={description}
        onChange={(event) => {
          setDescription(event.target.value);
          setSaved(false);
        }}
        placeholder={t("organizer.apply.descriptionPlaceholder")}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        multiline
        rows={3}
        fullWidth
        size="small"
        helperText={`${description.length}/500`}
      />

      {error && <Alert severity="error">{error}</Alert>}
      {saved && !error && (
        <Alert severity="success">{t("organizer.settings.saved")}</Alert>
      )}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || pending}
        variant="contained"
        fullWidth
        sx={{ py: 1.5, bgcolor: "#F59E0B", "&:hover": { bgcolor: "#D97706" } }}
      >
        {pending ? t("organizer.settings.saving") : t("organizer.settings.save")}
      </Button>
    </div>
  );
}
