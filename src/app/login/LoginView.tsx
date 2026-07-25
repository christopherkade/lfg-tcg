"use client";

import { MessageCircle, PlusCircle, Users, Swords } from "lucide-react";
import { Box, Button, Link, Typography } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";

const STEPS: { icon: typeof PlusCircle; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  {
    icon: PlusCircle,
    titleKey: "login.step1.title",
    descriptionKey: "login.step1.description",
  },
  {
    icon: Users,
    titleKey: "login.step2.title",
    descriptionKey: "login.step2.description",
  },
  {
    icon: Swords,
    titleKey: "login.step3.title",
    descriptionKey: "login.step3.description",
  },
];

interface LoginViewProps {
  /** Path (e.g. a shared /pods/<id> link) to return to once login completes. */
  next?: string;
}

export function LoginView({ next }: LoginViewProps) {
  const { t } = useTranslation();
  async function handleDiscordLogin() {
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (next) {
      callbackUrl.searchParams.set("next", next);
    }
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
  }

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="relative flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center"
    >
      <div className="absolute right-4 top-4 w-28">
        <LocaleSwitcher />
      </div>
      <div className="flex flex-col gap-2">
        <Typography
          component="h1"
          sx={{ fontSize: "1.875rem", fontWeight: 700, color: "text.primary" }}
        >
          {t("login.title")}
        </Typography>
        <Typography sx={{ color: "text.secondary" }}>
          {t("login.subtitle")}
        </Typography>
      </div>

      <ol className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:gap-6">
        {STEPS.map(({ icon: Icon, titleKey, descriptionKey }, index) => (
          <li key={titleKey} className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:w-40">
            <Box
              sx={{
                bgcolor: "background.paper",
                borderColor: "divider",
                borderWidth: 1,
                borderStyle: "solid",
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            >
              <Icon className="h-5 w-5" style={{ color: "inherit" }} />
            </Box>
            <div className="flex flex-col text-left sm:text-center">
              <Typography
                component="span"
                sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.primary" }}
              >
                {index + 1}. {t(titleKey)}
              </Typography>
              <Typography
                component="span"
                sx={{ fontSize: "0.75rem", color: "text.secondary" }}
              >
                {t(descriptionKey)}
              </Typography>
            </div>
          </li>
        ))}
      </ol>

      <Button
        onClick={handleDiscordLogin}
        variant="contained"
        startIcon={<MessageCircle className="h-5 w-5" />}
        sx={{
          px: 3,
          py: 1.5,
          bgcolor: "#5865F2",
          color: "#fff",
          "&:hover": { bgcolor: "#4752C4" },
        }}
      >
        {t("login.continueWithDiscord")}
      </Button>

      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        <Link href="/terms" target="_blank" rel="noopener" sx={{ color: "inherit" }}>
          {t("legal.termsLink")}
        </Link>
        {" · "}
        <Link href="/privacy" target="_blank" rel="noopener" sx={{ color: "inherit" }}>
          {t("legal.privacyLink")}
        </Link>
      </Typography>
    </Box>
  );
}
