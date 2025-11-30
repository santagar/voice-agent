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
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.0461 12.2099C21.0461 11.5553 20.9874 10.9259 20.8783 10.3217H12.1846V13.8966H17.1524C16.9342 15.0462 16.2797 16.0197 15.2979 16.6742V18.9987H18.2937C20.0391 17.3875 21.0461 15.0211 21.0461 12.2099Z" fill="#4285F4"></path><path d="M12.1844 21.2307C14.6767 21.2307 16.7662 20.4084 18.2935 18.9986L15.2977 16.6741C14.4753 17.2279 13.4264 17.5636 12.1844 17.5636C9.78441 17.5636 7.74525 15.944 7.01518 13.7622H3.94385V16.1454C5.46273 19.158 8.57602 21.2307 12.1844 21.2307Z" fill="#34A853"></path><path d="M7.01516 13.7539C6.83054 13.2 6.72145 12.6126 6.72145 12C6.72145 11.3874 6.83054 10.8 7.01516 10.2462V7.86295H3.94382C3.31445 9.10491 2.95361 10.5063 2.95361 12C2.95361 13.4937 3.31445 14.8951 3.94382 16.1371L6.33544 14.2741L7.01516 13.7539Z" fill="#FBBC05"></path><path d="M12.1844 6.44475C13.5439 6.44475 14.7522 6.91469 15.7173 7.82098L18.3606 5.17762C16.7578 3.68391 14.6767 2.76923 12.1844 2.76923C8.57602 2.76923 5.46273 4.84196 3.94385 7.86294L7.01518 10.2462C7.74525 8.06434 9.78441 6.44475 12.1844 6.44475Z" fill="#EA4335"></path></svg>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.0911 7.2368C19.3972 7.66168 18.8223 8.25568 18.4204 8.96321C18.0185 9.67075 17.8027 10.4687 17.7932 11.2823C17.7959 12.1981 18.0672 13.0929 18.5735 13.856C19.0798 14.6191 19.7988 15.2169 20.6415 15.5754C20.3093 16.6474 19.8176 17.6632 19.1829 18.5888C18.2748 19.8961 17.3253 21.2032 15.8805 21.2032C14.4358 21.2032 14.0642 20.3638 12.3992 20.3638C10.7755 20.3638 10.1976 21.2308 8.87662 21.2308C7.55564 21.2308 6.63382 20.0198 5.57424 18.5338C4.17461 16.452 3.4054 14.0106 3.35889 11.5024C3.35889 7.37443 6.04214 5.18665 8.68397 5.18665C10.0875 5.18665 11.2572 6.10847 12.1378 6.10847C12.9772 6.10847 14.2844 5.1315 15.8805 5.1315C16.7012 5.11032 17.5145 5.29127 18.2487 5.6584C18.983 6.02553 19.6157 6.56757 20.0911 7.2368ZM15.1238 3.38405C15.8274 2.55637 16.2257 1.51233 16.2521 0.426336C16.2533 0.28317 16.2395 0.140275 16.2108 0C15.0022 0.11806 13.8846 0.694096 13.0872 1.60995C12.3769 2.40465 11.9636 3.42081 11.9176 4.48573C11.9181 4.61524 11.932 4.74435 11.9589 4.87103C12.0542 4.88904 12.1509 4.89827 12.2479 4.89861C12.8049 4.85429 13.347 4.69717 13.8414 4.4368C14.3358 4.17644 14.7721 3.81826 15.1238 3.38405Z" fill="currentColor"></path></svg>
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
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.25 3.25H11.25V11.25H3.25V3.25Z" fill="#F35325"></path><path d="M12.75 3.25H20.75V11.25H12.75V3.25Z" fill="#81BC06"></path><path d="M3.25 12.75H11.25V20.75H3.25V12.75Z" fill="#05A6F0"></path><path d="M12.75 12.75H20.75V20.75H12.75V12.75Z" fill="#FFBA08"></path></svg>
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
