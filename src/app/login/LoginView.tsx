"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PlusCircle, Users, Swords, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Box, Button, Link, Typography } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useThemeMode } from "@/lib/theme/ThemeModeContext";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import { GAMES_CONFIG } from "@/constants/gamesConfig";

const MotionButton = motion.create(Button);

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

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

// Tailwind's `sm` breakpoint — the ambient blob/logo/glow animations below
// are paused under it, since the continuous transform/opacity repaint cost
// matters most on phone-class hardware and the motion adds the least there.
const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

// Reactive (unlike the one-time check in PodsTabTransition) because phones
// commonly rotate mid-session and the animations should pause/resume with it.
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}

interface LoginViewProps {
  /** Path (e.g. a shared /pods/<id> link) to return to once login completes. */
  next?: string;
}

export function LoginView({ next }: LoginViewProps) {
  const { t } = useTranslation();
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const prefersReducedMotion = useReducedMotion();
  const isMobileViewport = useIsMobileViewport();
  const shouldAnimate = !prefersReducedMotion && !isMobileViewport;
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
          animate={shouldAnimate ? { x: [0, 24, 0], y: [0, 18, 0] } : { x: 0, y: 0 }}
          transition={
            shouldAnimate
              ? { duration: blob.duration, delay: blob.delay, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
        />
      ))}

      {Object.values(GAMES_CONFIG).map((game, index) => {
        const slot = LOGO_SLOTS[index];
        return (
          <motion.div
            key={game.name}
            aria-hidden
            className={`pointer-events-none absolute hidden opacity-90 sm:block ${slot.className}`}
            animate={shouldAnimate ? { y: [0, -12, 0], rotate: [0, 3, 0] } : { y: 0, rotate: 0 }}
            transition={
              shouldAnimate
                ? { duration: slot.duration, delay: slot.delay, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0 }
            }
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
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
            <Image src="/mascot.svg" alt="" width={36} height={50} aria-hidden />
            <Typography
              component="h1"
              sx={{ fontSize: "1.875rem", fontWeight: 700, color: "text.primary" }}
            >
              {t("login.title")}
            </Typography>
          </Box>
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

        <motion.div variants={itemVariants} className="relative inline-block">
          {/* Static box-shadow + animated opacity instead of animating
              box-shadow directly — box-shadow isn't GPU-composited, so
              looping it forces a full repaint every frame. Opacity is. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: "0 0 22px 8px rgba(88, 101, 242, 0.35)" }}
            animate={shouldAnimate ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.6 }}
            transition={shouldAnimate ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
          />
          <MotionButton
            onClick={handleDiscordLogin}
            variant="contained"
            startIcon={<DiscordIcon className="h-5 w-5" />}
            whileHover={{ y: -2 }}
            whileTap={{ y: 0, boxShadow: "0 0 12px 4px rgba(88, 101, 242, 0.4)" }}
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
