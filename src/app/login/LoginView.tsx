"use client";

import Image from "next/image";
import { MessageCircle, PlusCircle, Users, Swords, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Box, Button, Link, Typography } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useThemeMode } from "@/lib/theme/ThemeModeContext";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import { GAMES_CONFIG } from "@/constants/gamesConfig";

const MotionButton = motion.create(Button);

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

// Ambient background blobs, one per brand tone — slow independent drift so
// the trio never lines up into a repeating pattern.
const BLOBS = [
  { color: "var(--color-ember)", className: "-left-24 -top-24 h-72 w-72", duration: 12, delay: 0 },
  { color: "var(--color-ember-light)", className: "-right-16 top-1/3 h-80 w-80", duration: 15, delay: 1.5 },
  { color: "var(--color-ember-dark)", className: "bottom-[-6rem] left-1/4 h-72 w-72", duration: 13, delay: 0.8 },
];

// Fixed screen-edge slots for the floating game logos, kept clear of the
// centered content column. Hidden below `sm` where there isn't room.
const LOGO_SLOTS = [
  { className: "left-[5%] top-[8%]", size: 134, duration: 9, delay: 0 },
  { className: "right-[6%] top-[14%]", size: 120, duration: 11, delay: 1.1 },
  { className: "left-[7%] bottom-[12%]", size: 125, duration: 10, delay: 0.6 },
  { className: "right-[5%] bottom-[7%]", size: 149, duration: 12, delay: 1.7 },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

interface LoginViewProps {
  /** Path (e.g. a shared /pods/<id> link) to return to once login completes. */
  next?: string;
}

export function LoginView({ next }: LoginViewProps) {
  const { t } = useTranslation();
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
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
      className="relative flex flex-1 flex-col items-center justify-center gap-10 overflow-hidden px-6 text-center"
    >
      {BLOBS.map((blob, index) => (
        <motion.div
          key={index}
          aria-hidden
          className={`pointer-events-none absolute rounded-full blur-3xl ${blob.className}`}
          style={{
            background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
            opacity: 0.22,
          }}
          animate={{ x: [0, 24, 0], y: [0, 18, 0] }}
          transition={{ duration: blob.duration, delay: blob.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {Object.values(GAMES_CONFIG).map((game, index) => {
        const slot = LOGO_SLOTS[index];
        return (
          <motion.div
            key={game.name}
            aria-hidden
            className={`pointer-events-none absolute hidden opacity-90 sm:block ${slot.className}`}
            animate={{ y: [0, -12, 0], rotate: [0, 3, 0] }}
            transition={{ duration: slot.duration, delay: slot.delay, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: slot.size, height: slot.size }}
          >
            {/* Dark-lined logo art (e.g. MTG, One Piece) is invisible against
                the near-black dark background, so give it a light backdrop
                there; the light background already has enough contrast on
                its own. */}
            <div
              className={`flex h-full w-full items-center justify-center rounded-2xl p-2.5 ${
                isDark ? "bg-white/85 shadow-[0_0_20px_6px_rgba(110,231,183,0.35)] ring-1 ring-white/60" : ""
              }`}
            >
              <Image
                src={game.logo}
                alt=""
                width={slot.size}
                height={slot.size}
                className="h-full w-full object-contain"
              />
            </div>
          </motion.div>
        );
      })}

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <ThemeToggle />
        <div className="w-28">
          <LocaleSwitcher />
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mt-16 flex flex-col items-center gap-10 sm:mt-0"
      >
        <motion.div variants={itemVariants} className="flex flex-col gap-2">
          <Typography
            component="h1"
            sx={{ fontSize: "1.875rem", fontWeight: 700, color: "text.primary" }}
          >
            {t("login.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {t("login.subtitle")}
          </Typography>
        </motion.div>

        <motion.ol
          variants={itemVariants}
          className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:gap-2"
        >
          {STEPS.map(({ icon: Icon, titleKey, descriptionKey }, index) => (
            <div key={titleKey} className="flex items-center gap-4 sm:items-start">
              <li className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:w-36">
                <Box
                  sx={{
                    bgcolor: "background.paper",
                    borderColor: "var(--color-ember)",
                    borderWidth: 1.5,
                    borderStyle: "solid",
                    color: "var(--color-ember)",
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
              {index < STEPS.length - 1 && (
                <ChevronRight
                  className="hidden h-4 w-4 shrink-0 sm:mt-3 sm:block"
                  style={{ color: "var(--color-ember)" }}
                />
              )}
            </div>
          ))}
        </motion.ol>

        <motion.div variants={itemVariants}>
          <MotionButton
            onClick={handleDiscordLogin}
            variant="contained"
            startIcon={<MessageCircle className="h-5 w-5" />}
            whileHover={{ y: -2 }}
            whileTap={{ y: 0, boxShadow: "0 0 12px 4px rgba(88, 101, 242, 0.4)" }}
            animate={{
              boxShadow: [
                "0 0 10px 2px rgba(88, 101, 242, 0.35)",
                "0 0 22px 8px rgba(88, 101, 242, 0.35)",
                "0 0 10px 2px rgba(88, 101, 242, 0.35)",
              ],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            sx={{
              px: 3,
              py: 1.5,
              bgcolor: "#5865F2",
              color: "#fff",
              boxShadow: "none",
              "&:hover": { bgcolor: "#4752C4", boxShadow: "none" },
            }}
          >
            {t("login.continueWithDiscord")}
          </MotionButton>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            <Link href="/terms" target="_blank" rel="noopener" sx={{ color: "inherit" }}>
              {t("legal.termsLink")}
            </Link>
            {" · "}
            <Link href="/privacy" target="_blank" rel="noopener" sx={{ color: "inherit" }}>
              {t("legal.privacyLink")}
            </Link>
          </Typography>
        </motion.div>
      </motion.div>
    </Box>
  );
}
