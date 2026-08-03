"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useAnimate,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "framer-motion";
import { Box, Button, Link, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useThemeMode } from "@/lib/theme/ThemeModeContext";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import {
  CARD_SHOWCASE,
  type ShowcaseGame,
} from "@/constants/loginCardShowcase";

const MotionButton = motion.create(Button);

// One column per supported game, alternating scroll direction, at a slow and
// slightly-varied pace so the four columns don't stay visually in sync.
const SHOWCASE_COLUMNS: {
  game: ShowcaseGame;
  direction: "up" | "down";
  duration: number;
}[] = [
  { game: "mtg", direction: "down", duration: 50 },
  { game: "pokemon", direction: "up", duration: 65 },
  { game: "lorcana", direction: "down", duration: 55 },
  { game: "onepiece", direction: "up", duration: 70 },
];

function CardColumn({
  game,
  direction,
  duration,
  shouldAnimate,
}: {
  game: ShowcaseGame;
  direction: "up" | "down";
  duration: number;
  shouldAnimate: boolean;
}) {
  // Rendered twice back-to-back and animated by exactly half its own scroll
  // height — the standard seamless-marquee trick, so the loop point is
  // invisible regardless of how many cards the list holds.
  const cards = [...CARD_SHOWCASE[game], ...CARD_SHOWCASE[game]];
  const [scope, animate] = useAnimate();
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    if (!scope.current) return;

    if (!shouldAnimate) {
      controlsRef.current?.stop();
      animate(scope.current, { y: "0%" }, { duration: 0 });
      return;
    }

    controlsRef.current = animate(
      scope.current,
      { y: direction === "down" ? ["-50%", "0%"] : ["0%", "-50%"] },
      { duration, repeat: Infinity, ease: "linear" },
    );
    return () => controlsRef.current?.stop();
  }, [shouldAnimate, direction, duration, animate, scope]);

  return (
    <div
      data-card-column
      className="relative h-full min-h-0 flex-1 overflow-hidden"
      // Imperative playback controls (rather than toggling the `animate`
      // target) so hovering freezes the column exactly where it is and
      // hovering out resumes from there — switching targets instead would
      // tween back to a fixed value and look like a jump/snap.
      onMouseEnter={() => controlsRef.current?.pause()}
      onMouseLeave={() => controlsRef.current?.play()}
    >
      <div ref={scope} className="flex flex-col gap-3">
        {cards.map((card, index) => (
          <div
            key={`${card.src}-${index}`}
            className="aspect-[5/7] w-full shrink-0 overflow-hidden rounded-lg shadow-md"
          >
            <Image
              src={card.src}
              alt=""
              width={160}
              height={223}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

const leftContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const leftItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const illustrationVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, delay: 0.25, ease: "easeOut" as const },
  },
};

// Tailwind's `sm` breakpoint — the ambient/floating animations below are
// paused under it, since the continuous transform/opacity repaint cost
// matters most on phone-class hardware and the motion adds the least there.
const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

// Tailwind's `lg` breakpoint — below it the card showcase renders as a
// full-width background layer behind the login card instead of the desktop
// side panel. Only one of the two should ever be animating at once.
const DESKTOP_SHOWCASE_MEDIA_QUERY = "(min-width: 1024px)";

// Reactive (unlike a one-time check) because phones commonly rotate
// mid-session and the animations should pause/resume with it. Always starts
// `false` (rather than reading `matchMedia` synchronously) so the client's
// first render matches the server-rendered markup exactly — some consumers
// feed this into MUI `sx` values, whose generated class name would otherwise
// mismatch during hydration. The real value lands a tick later via effect.
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);
    const handleChange = (event: MediaQueryListEvent) =>
      setMatches(event.matches);
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
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
  const isMobileViewport = useMediaQuery(MOBILE_MEDIA_QUERY);
  const isDesktopShowcase = useMediaQuery(DESKTOP_SHOWCASE_MEDIA_QUERY);
  const shouldAnimate = !prefersReducedMotion && !isMobileViewport;
  // Unlike `shouldAnimate` (which pauses ambient/floating animations on
  // phones for perf), the card showcase scroll now runs on every viewport —
  // it's shown either as the desktop side panel or the mobile background
  // layer below, so only reduced-motion should stop it.
  const shouldAnimateCards = !prefersReducedMotion;

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
      className="relative flex flex-1 items-stretch justify-center overflow-hidden p-8 sm:p-10 lg:h-dvh lg:flex-none lg:p-6"
    >
      {/* Mobile/tablet background showcase — the desktop side panel below
          takes over at `lg`, so this is the `lg:hidden` counterpart. Sits
          behind the login card purely by DOM order (neither this nor the
          card `Box` sets an explicit z-index). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 flex gap-3 overflow-hidden px-3 lg:hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
        }}
      >
        {SHOWCASE_COLUMNS.map((column) => (
          <CardColumn
            key={column.game}
            game={column.game}
            direction={column.direction}
            duration={column.duration}
            shouldAnimate={shouldAnimateCards && !isDesktopShowcase}
          />
        ))}
      </div>

      <div className="fixed right-6 top-6 z-30 hidden flex-col items-end gap-4 lg:flex">
        <div className="w-28">
          <LocaleSwitcher />
        </div>
        <ThemeToggle />
      </div>

      <Box
        sx={{
          bgcolor: (theme) =>
            isDesktopShowcase
              ? theme.palette.background.paper
              : alpha(theme.palette.background.paper, 0.82),
          backdropFilter: isDesktopShowcase ? "none" : "blur(16px)",
          WebkitBackdropFilter: isDesktopShowcase ? "none" : "blur(16px)",
          borderColor: "divider",
        }}
        className="relative flex w-full max-w-6xl min-h-0 overflow-hidden rounded-3xl border shadow-xl"
      >
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <div className="w-28">
            <LocaleSwitcher />
          </div>
        </div>

        {/* Left column */}
        <div className="flex w-full flex-col justify-center gap-10 px-6 py-16 sm:px-12 lg:w-1/2 lg:px-16">
          <motion.div
            variants={leftContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-8"
          >
            <motion.div
              variants={leftItemVariants}
              className="flex items-center gap-2"
            >
              <Image
                src="/mascot.svg"
                alt=""
                width={28}
                height={39}
                aria-hidden
              />
              <Typography
                component="span"
                sx={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "text.primary",
                }}
              >
                {t("login.title")}
              </Typography>
            </motion.div>

            <motion.div
              variants={leftItemVariants}
              className="flex flex-col gap-4"
            >
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: "1.5rem", sm: "2.75rem" },
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: "text.primary",
                }}
              >
                {t("login.tagline")}
              </Typography>
              <Typography
                sx={{
                  fontSize: "1rem",
                  color: "text.secondary",
                  maxWidth: 420,
                }}
              >
                {t("login.taglineSubtitle")}
              </Typography>
            </motion.div>

            <motion.div
              variants={leftItemVariants}
              className="relative inline-block w-fit"
            >
              {/* Static box-shadow + animated opacity instead of animating
                  box-shadow directly — box-shadow isn't GPU-composited, so
                  looping it forces a full repaint every frame. Opacity is. */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 22px 8px rgba(88, 101, 242, 0.35)" }}
                animate={
                  shouldAnimate ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.6 }
                }
                transition={
                  shouldAnimate
                    ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0 }
                }
              />
              <MotionButton
                onClick={handleDiscordLogin}
                variant="contained"
                startIcon={<DiscordIcon className="h-5 w-5" />}
                whileHover={{ y: -2 }}
                whileTap={{
                  y: 0,
                  boxShadow: "0 0 12px 4px rgba(88, 101, 242, 0.4)",
                }}
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
          </motion.div>

          <motion.div
            variants={leftItemVariants}
            initial="hidden"
            animate="visible"
            className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-6 lg:static lg:inset-auto lg:z-auto lg:justify-start lg:px-0"
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              <Link
                href="/terms"
                target="_blank"
                rel="noopener"
                sx={{ color: "inherit" }}
              >
                {t("legal.termsLink")}
              </Link>
              {" · "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener"
                sx={{ color: "inherit" }}
              >
                {t("legal.privacyLink")}
              </Link>
            </Typography>
          </motion.div>
        </div>

        {/* Right column — TCG card showcase panel, hidden below `lg`. The
            outer page container is pinned to `lg:h-dvh` (a real, definite
            height) and every flex level down to here adds `min-h-0` —
            without that, flex items default to `min-height: auto`, which
            lets a child's content (the endlessly-tall duplicated card list)
            force this box, and every ancestor up to the page, to grow to
            fit it instead of being clipped by `overflow-hidden`. */}
        <div className="hidden min-h-0 px-4 lg:flex lg:h-full lg:w-1/2 lg:items-stretch">
          <motion.div
            variants={illustrationVariants}
            initial="hidden"
            animate="visible"
            aria-hidden
            className="relative flex h-full min-h-0 w-full gap-3 overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
            }}
          >
            <div
              className="pointer-events-none absolute h-64 w-64 rounded-full blur-3xl"
              style={{
                background: "var(--color-ember)",
                opacity: isDark ? 0.12 : 0.15,
                top: "8%",
                left: "5%",
              }}
            />
            <div
              className="pointer-events-none absolute h-72 w-72 rounded-full blur-3xl"
              style={{
                background: "var(--color-ember-dark)",
                opacity: isDark ? 0.15 : 0.1,
                bottom: "5%",
                right: "8%",
              }}
            />
            {SHOWCASE_COLUMNS.map((column) => (
              <CardColumn
                key={column.game}
                game={column.game}
                direction={column.direction}
                duration={column.duration}
                shouldAnimate={shouldAnimateCards && isDesktopShowcase}
              />
            ))}
          </motion.div>
        </div>
      </Box>
    </Box>
  );
}
