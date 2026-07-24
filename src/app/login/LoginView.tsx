"use client";

import { MessageCircle, PlusCircle, Users, Swords } from "lucide-react";
import { Button } from "@mui/material";
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
    <div className="relative flex flex-1 flex-col items-center justify-center gap-10 bg-zinc-950 px-6 text-center">
      <div className="absolute right-4 top-4 w-28">
        <LocaleSwitcher />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-zinc-50">{t("login.title")}</h1>
        <p className="text-white">{t("login.subtitle")}</p>
      </div>

      <ol className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:gap-6">
        {STEPS.map(({ icon: Icon, titleKey, descriptionKey }, index) => (
          <li key={titleKey} className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:w-40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-800">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col text-left sm:text-center">
              <span className="text-sm font-medium text-zinc-100">
                {index + 1}. {t(titleKey)}
              </span>
              <span className="text-xs text-white">{t(descriptionKey)}</span>
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
    </div>
  );
}
