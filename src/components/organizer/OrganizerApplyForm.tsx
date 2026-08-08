"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, TextField, Typography } from "@mui/material";
import { CitySelector } from "@/components/CitySelector";
import { applyAsOrganizer } from "@/app/actions/organizer";
import { useTranslation } from "@/lib/i18n/LocaleContext";

export function OrganizerApplyForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    storeName.trim().length > 0 &&
    city != null &&
    verificationUrl.trim().length > 0 &&
    email.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    const result = await applyAsOrganizer({
      storeName,
      city: city ?? "",
      description,
      verificationUrl,
      email,
    });

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    router.push("/organizer");
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Typography
          component="h1"
          sx={{ fontSize: "1.5rem", fontWeight: 700, color: "text.primary" }}
        >
          {t("organizer.apply.title")}
        </Typography>
        <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
          {t("organizer.apply.subtitle")}
        </Typography>
      </div>

      <TextField
        label={t("organizer.apply.storeName")}
        value={storeName}
        onChange={(event) => setStoreName(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 80 } }}
        fullWidth
        size="small"
      />
      <CitySelector
        value={city}
        onChange={setCity}
        helperText={t("organizer.apply.cityHelperText")}
      />
      <TextField
        label={t("organizer.apply.email")}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={t("organizer.apply.emailPlaceholder")}
        helperText={t("organizer.apply.emailHint")}
        slotProps={{ htmlInput: { maxLength: 320 } }}
        fullWidth
        size="small"
      />
      <TextField
        label={t("organizer.apply.verificationUrl")}
        value={verificationUrl}
        onChange={(event) => setVerificationUrl(event.target.value)}
        placeholder={t("organizer.apply.verificationUrlPlaceholder")}
        helperText={t("organizer.apply.verificationUrlHint")}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        fullWidth
        size="small"
      />
      <TextField
        label={t("organizer.apply.description")}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={t("organizer.apply.descriptionPlaceholder")}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        multiline
        rows={3}
        fullWidth
        size="small"
        helperText={`${description.length}/500`}
      />

      {error && <Alert severity="error">{error}</Alert>}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || pending}
        variant="contained"
        fullWidth
        sx={{ py: 1.5, bgcolor: "#F59E0B", "&:hover": { bgcolor: "#D97706" } }}
      >
        {pending ? t("organizer.apply.submitting") : t("organizer.apply.submit")}
      </Button>
    </div>
  );
}
