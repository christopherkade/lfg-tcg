"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Tailwind's `sm` breakpoint — below this, arriving via ?highlight=own
// slides the whole tab in from the side instead of it just quietly
// appearing, since a swipe reads as "you navigated somewhere" on a
// phone-sized screen in a way it wouldn't on desktop.
const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

interface PodsTabTransitionProps {
  /** True when this mount followed the LFG button's post-create redirect (?highlight=own). */
  slideIn: boolean;
  children: React.ReactNode;
}

/**
 * Wraps the whole Pods tab content (own-pod panel + match feed together, as
 * one unit) so navigating here via the create-pod redirect feels like a
 * real navigation instead of the page just quietly swapping in. Only plays
 * on that specific arrival — captured once via lazy init, read
 * synchronously rather than in an effect so the first paint already has the
 * right `initial` position — later re-renders of this same mount must not
 * replay it.
 */
export function PodsTabTransition({
  slideIn,
  children,
}: PodsTabTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const [justArrivedOnMobile] = useState(
    () =>
      slideIn &&
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  );

  return (
    <motion.div
      initial={
        justArrivedOnMobile && !prefersReducedMotion
          ? { x: -48, opacity: 0 }
          : false
      }
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
