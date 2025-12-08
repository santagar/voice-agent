import React from "react";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { SettingsDialog } from "@/components/front/settings/SettingsDialog";

type SessionDialogsProps = {
  showSettingsDialog: boolean;
  showLoginDialog: boolean;
  onCloseSettings: () => void;
  onCloseLogin: () => void;
  onLoggedIn: (email: string) => void;
};

export function SessionDialogs({
  showSettingsDialog,
  showLoginDialog,
  onCloseSettings,
  onCloseLogin,
  onLoggedIn,
}: SessionDialogsProps) {
  return (
    <>
      <SettingsDialog open={showSettingsDialog} onClose={onCloseSettings} />
      <LoginDialog
        open={showLoginDialog}
        onClose={onCloseLogin}
        onLoggedIn={(email) => {
          onLoggedIn(email);
          onCloseLogin();
        }}
      />
    </>
  );
}
