"use client";

import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { signOut as nextAuthSignOut } from "next-auth/react";

type SessionState = {
  loggedIn: boolean;
  userEmail: string | null;
  userName: string | null;
  userImage: string | null;
  isAdminUser: boolean;
  setLoggedIn: (value: boolean) => void;
  setUserEmail: (value: string | null) => void;
  setUserName: (value: string | null) => void;
  setUserImage: (value: string | null) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

type SessionProviderProps = {
  initialLoggedIn: boolean;
  initialUserEmail: string | null;
  initialUserName: string | null;
  initialUserImage: string | null;
  onSignOut?: () => void;
  children: React.ReactNode;
};

export function SessionProvider({
  initialLoggedIn,
  initialUserEmail,
  initialUserName,
  initialUserImage,
  onSignOut,
  children,
}: SessionProviderProps) {
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);
  const [userEmail, setUserEmail] = useState<string | null>(initialUserEmail);
  const [userName, setUserName] = useState<string | null>(initialUserName);
  const [userImage, setUserImage] = useState<string | null>(initialUserImage);

  const isAdminUser = userEmail === "santagar@gmail.com" || userEmail === "asantacruz@tuexperiencia.com";

  const signOut = useCallback(async () => {
    await nextAuthSignOut({ redirect: false });
    setLoggedIn(false);
    setUserEmail(null);
    setUserName(null);
    setUserImage(null);
    onSignOut?.();
  }, [onSignOut]);

  const value = useMemo(
    () => ({
      loggedIn,
      userEmail,
      userName,
      userImage,
      isAdminUser,
      setLoggedIn,
      setUserEmail,
      setUserName,
      setUserImage,
      signOut,
    }),
    [loggedIn, userEmail, userName, userImage, isAdminUser, signOut]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
