"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ProfileLockContextValue {
  usernameMissing: boolean;
  blocked: boolean;
  requestBlock: () => void;
  clearBlock: () => void;
}

const ProfileLockContext = createContext<ProfileLockContextValue | null>(null);

export function ProfileLockProvider({
  usernameMissing,
  children,
}: {
  usernameMissing: boolean;
  children: React.ReactNode;
}) {
  const [blocked, setBlocked] = useState(false);

  const requestBlock = useCallback(() => setBlocked(true), []);
  const clearBlock = useCallback(() => setBlocked(false), []);

  const value = useMemo<ProfileLockContextValue>(
    () => ({ usernameMissing, blocked, requestBlock, clearBlock }),
    [usernameMissing, blocked, requestBlock, clearBlock],
  );

  return (
    <ProfileLockContext.Provider value={value}>
      {children}
    </ProfileLockContext.Provider>
  );
}

export function useProfileLock() {
  const context = useContext(ProfileLockContext);
  if (!context) {
    throw new Error("useProfileLock must be used within a ProfileLockProvider");
  }
  return context;
}
