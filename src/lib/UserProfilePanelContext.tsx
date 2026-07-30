"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { fetchPublicProfile, type PublicProfileData } from "@/lib/profile/fetchPublicProfile";
import { UserProfilePanel } from "@/components/UserProfilePanel";

interface UserProfilePanelContextValue {
  openUserProfile: (username: string) => void;
}

const UserProfilePanelContext = createContext<UserProfilePanelContextValue | null>(null);

function usernameFromProfilePath(pathname: string): string | null {
  const match = /^\/profile\/([^/]+)$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Renders the public profile side panel as a global overlay, mounted once
 * in (app)/layout.tsx, so any component anywhere in the tree can open it
 * without routing to a new page (a real router.push would replace whatever
 * page is behind the panel — see UserProfilePanel's docstring). The URL is
 * kept in sync via the raw History API instead of next/navigation's
 * router, specifically so {children} underneath never re-renders: popstate
 * is the one path that ever closes the panel, so backdrop/X clicks just
 * call history.back() rather than clearing state directly, keeping the URL
 * and panel state as a single source of truth (and making the browser Back
 * button close the panel correctly, for free).
 */
export function UserProfilePanelProvider({ children }: { children: React.ReactNode }) {
  const [openUsername, setOpenUsername] = useState<string | null>(null);
  const [data, setData] = useState<PublicProfileData | null>(null);
  const openUsernameRef = useRef(openUsername);
  useEffect(() => {
    openUsernameRef.current = openUsername;
  }, [openUsername]);

  const openUserProfile = useCallback((username: string) => {
    setOpenUsername((current) => {
      if (current !== username) setData(null);
      return username;
    });
    const targetPath = `/profile/${encodeURIComponent(username)}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  }, []);

  useEffect(() => {
    function handlePopState() {
      const username = usernameFromProfilePath(window.location.pathname);
      if (username) {
        setOpenUsername(username);
      } else if (openUsernameRef.current) {
        setOpenUsername(null);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!openUsername) return;
    let cancelled = false;
    fetchPublicProfile(createClient(), openUsername).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [openUsername]);

  const handleClose = useCallback(() => {
    window.history.back();
  }, []);

  const value = useMemo<UserProfilePanelContextValue>(
    () => ({ openUserProfile }),
    [openUserProfile],
  );

  return (
    <UserProfilePanelContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {openUsername && (
          <UserProfilePanel key={openUsername} data={data} onClose={handleClose} />
        )}
      </AnimatePresence>
    </UserProfilePanelContext.Provider>
  );
}

export function useUserProfilePanel() {
  const context = useContext(UserProfilePanelContext);
  if (!context) {
    throw new Error("useUserProfilePanel must be used within a UserProfilePanelProvider");
  }
  return context;
}
