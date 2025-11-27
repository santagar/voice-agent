"use client";

import { useEffect, useState, FormEvent } from "react";
import { Apple, Mail, Phone, X } from "lucide-react";
import { Modal } from "@/components/front/ui/Modal";
import { useTheme } from "@/components/theme/ThemeContext";
import { useLocale } from "@/components/locale/LocaleContext";
import { signIn } from "next-auth/react";

type LoginDialogProps = {
  open: boolean;
  onClose: () => void;
  onLoggedIn: (email: string) => void;
};

export function LoginDialog({ open, onClose, onLoggedIn }: LoginDialogProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    void (async () => {
      const result = await signIn("credentials", {
        email,
        redirect: false,
      });
      if (result?.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      onLoggedIn(email.trim());
    })();
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <div
        className={`relative w-full max-w-md rounded-3xl border px-6 py-6 text-sm shadow-xl ${
          isDark
            ? "border-white/10 bg-neutral-900 text-gray-50"
            : "border-zinc-200 bg-white text-gray-900"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className={`absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs ${
            isDark
              ? "text-gray-300 hover:bg-white/10"
              : "text-gray-500 hover:bg-zinc-100"
          }`}
          aria-label={t("chat.login.close")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mt-2 text-center">
          <h2 className="text-xl font-semibold">
            {t("chat.login.title")}
          </h2>
          <p className="mt-2 text-xs text-gray-500">
            {t("chat.login.subtitle")}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => {
              void signIn("google", { callbackUrl: "/" });
            }}
            className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border text-sm font-medium ${
              isDark
                ? "border-white/15 bg-neutral-900 text-gray-50 hover:bg-neutral-800"
                : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-red-500">
              G
            </span>
            <span>{t("chat.login.withGoogle")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void signIn("apple", { callbackUrl: "/" });
            }}
            className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border text-sm font-medium ${
              isDark
                ? "border-white/15 bg-neutral-900 text-gray-50 hover:bg-neutral-800"
                : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Apple className="h-4 w-4" />
            <span>{t("chat.login.withApple")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void signIn("microsoft", { callbackUrl: "/" });
            }}
            className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border text-sm font-medium ${
              isDark
                ? "border-white/15 bg-neutral-900 text-gray-50 hover:bg-neutral-800"
                : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-sky-600">
              ⊞
            </span>
            <span>{t("chat.login.withMicrosoft")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void signIn("phone", { callbackUrl: "/" });
            }}
            className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border text-sm font-medium ${
              isDark
                ? "border-white/15 bg-neutral-900 text-gray-50 hover:bg-neutral-800"
                : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Phone className="h-4 w-4" />
            <span>{t("chat.login.withPhone")}</span>
          </button>
        </div>

        <div className="my-5 flex items-center text-[11px] text-gray-400">
          <div className="h-px flex-1 bg-gray-200/60 dark:bg-white/10" />
          <span className="px-2 uppercase tracking-[0.18em]">
            {t("chat.login.or")}
          </span>
          <div className="h-px flex-1 bg-gray-200/60 dark:bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div
            className={`flex h-11 w-full items-center gap-2 rounded-full border px-4 text-sm ${
              isDark
                ? "border-white/15 bg-neutral-900 text-gray-50"
                : "border-gray-300 bg-white text-gray-900"
            }`}
          >
            <Mail className="h-4 w-4 text-gray-400" />
            <input
              type="email"
              autoComplete="email"
              placeholder={t("chat.login.emailPlaceholder")}
              className="h-full flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <p className="mt-1 text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className={`flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold ${
              isDark
                ? "cursor-pointer bg-white text-neutral-950 hover:bg-gray-100"
                : "cursor-pointer bg-black text-white hover:bg-neutral-900"
            }`}
            disabled={submitting || !email.trim()}
          >
            {submitting ? t("chat.login.continueLoading") : t("chat.login.continue")}
          </button>
        </form>
      </div>
    </Modal>
  );
}
