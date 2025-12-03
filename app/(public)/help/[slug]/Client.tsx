"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Copy, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale/LocaleContext";
import { useTheme } from "@/components/theme/ThemeContext";
import { Header } from "../components/Header";

type Heading = {
  id: string;
  level: number;
  text: string;
};

type ArticleClientProps = {
  markdown: string;
  updatedAt?: string;
  titleOverride?: string | null;
  mdUrl?: string;
};

const KEY_COLOR = "#ec4899";
const STRING_COLOR = "#10b981";
const NUM_BOOL_COLOR = "#38bdf8";
const PUNCT_COLOR = "#f97316";

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[`*_]/g, "")
    .trim();
}

function slugify(text: string): string {
  const clean = normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-");
  return clean.replace(/-+/g, "-");
}

function flattenText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(flattenText).join("");
  }
  if (React.isValidElement(node)) {
    const child = (
      node as React.ReactElement<{ children?: React.ReactNode }>
    ).props?.children;
    return child ? flattenText(child) : "";
  }
  return "";
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(source: string): string {
  let value: any;
  try {
    value = JSON.parse(source);
  } catch {
    return escapeHtml(source);
  }

  const indentUnit = "  ";

  const renderValue = (val: any, indent: number): string => {
    const pad = indentUnit.repeat(indent);
    if (Array.isArray(val)) {
      if (val.length === 0) return "[]";
      let out = "[\n";
      val.forEach((item, idx) => {
        out +=
          pad +
          indentUnit +
          renderValue(item, indent + 1) +
          (idx < val.length - 1
            ? `<span style="color:${PUNCT_COLOR};">,</span>\n`
            : "\n");
      });
      out += pad + "]";
      return out;
    }
    if (val && typeof val === "object") {
      const keys = Object.keys(val);
      if (keys.length === 0) return "{}";
      let out = "{\n";
      keys.forEach((key, idx) => {
        const keyHtml = `<span style="color:${KEY_COLOR};">"${escapeHtml(
          key
        )}"</span>`;
        out +=
          pad +
          indentUnit +
          keyHtml +
          `<span style="color:${PUNCT_COLOR};">: </span>` +
          renderValue(val[key], indent + 1) +
          (idx < keys.length - 1
            ? `<span style="color:${PUNCT_COLOR};">,</span>\n`
            : "\n");
      });
      out += pad + "}";
      return out;
    }
    if (typeof val === "string") {
      return `<span style="color:${STRING_COLOR};">"${escapeHtml(
        val
      )}"</span>`;
    }
    if (typeof val === "number") {
      return `<span style="color:${NUM_BOOL_COLOR};">${String(val)}</span>`;
    }
    if (typeof val === "boolean" || val === null) {
      return `<span style="color:${NUM_BOOL_COLOR};">${String(val)}</span>`;
    }
    return escapeHtml(String(val));
  };

  return renderValue(value, 0);
}

function extractHeadings(markdown: string): Heading[] {
  return markdown
    .split("\n")
    .map((line) => {
      const match = line.match(/^(#{1,6})\s+(.*)/);
      if (!match) return null;
      const level = match[1].length;
      const text = match[2].trim();
      return {
        id: slugify(text),
        level,
        text,
      } as Heading;
    })
    .filter(Boolean) as Heading[];
}

export function Client({ markdown, updatedAt, titleOverride, mdUrl }: ArticleClientProps) {
  const { locale, setLocale } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();
  const didMountRef = React.useRef(false);
  const isDark = theme === "dark";
  const sharedBackground = isDark ? "bg-neutral-900/80" : "bg-white/80";
  const pageBackground = `${sharedBackground} ${isDark ? "text-zinc-100" : "text-gray-900"}`;
  const mutedText = isDark ? "text-zinc-400" : "text-gray-600";
  const bodyText = isDark ? "text-zinc-200" : "text-gray-800";
  const navLink = isDark
    ? "text-zinc-100 hover:bg-white/10"
    : "text-gray-800 hover:bg-zinc-100";
  const pillButton = isDark
    ? "text-zinc-100 hover:bg-white/10"
    : "text-gray-700 hover:bg-zinc-100";
  const codeBlock = "border-white/10 bg-neutral-800 text-zinc-100";
  const inlineCode = "bg-neutral-800 text-zinc-100";

  const [headings, setHeadings] = React.useState<Heading[]>(() => extractHeadings(markdown));
  const [activeHash, setActiveHash] = React.useState<string | null>(null);

  const heroTitle = titleOverride || headings.find((h) => h.level === 1)?.text || "Help";

  const formatDate = React.useCallback(
    (date: Date) =>
      new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date),
    [locale]
  );

  React.useEffect(() => {
    setHeadings(extractHeadings(markdown));
  }, [markdown]);

  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    router.refresh();
  }, [locale, router]);

  React.useEffect(() => {
    const handleHashChange = () => {
      setActiveHash(window.location.hash || null);
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.getAttribute("id");
          if (id) {
            setActiveHash(`#${id}`);
          }
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const sectionIds = headings
      .filter((h) => h.level === 2)
      .map((h) => h.id)
      .filter(Boolean);

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const navHeadings = headings.filter((h) => h.level === 2);

  const markdownComponents = React.useMemo(
    () => ({
      h1: () => null,
      h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h2
          id={slugify(flattenText(children))}
          className="mt-10 text-xl font-semibold scroll-mt-28"
          {...props}
        >
          {children}
        </h2>
      ),
      p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p className={`text-base leading-relaxed ${bodyText}`} {...props}>
          {children}
        </p>
      ),
      ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
        <ul
          className={`list-disc space-y-1 pl-5 text-base leading-relaxed ${bodyText}`}
          {...props}
        >
          {children}
        </ul>
      ),
      li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
        <li {...props}>{children}</li>
      ),
      blockquote: ({ children, ...props }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
        <blockquote
          className={`border-l-4 pl-4 text-base leading-relaxed ${bodyText} ${
            isDark ? "border-white/10" : "border-zinc-200"
          }`}
          {...props}
        >
          {children}
        </blockquote>
      ),
      code: ({ inline, children, className, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) =>
        inline ? (
          <code className={`rounded px-1.5 py-0.5 font-mono text-[13px] ${inlineCode}`} {...props}>
            {children}
          </code>
        ) : (
          <code className={className} {...props}>
            {children}
          </code>
        ),
      pre: ({ children, className, ...props }: React.HTMLAttributes<HTMLPreElement>) => {
        const codeChild = React.Children.toArray(children)[0] as any;
        const raw =
          typeof codeChild === "string"
            ? codeChild
            : Array.isArray(codeChild?.props?.children)
            ? codeChild.props.children.join("")
            : typeof codeChild?.props?.children === "string"
            ? codeChild.props.children
            : "";
        const [copied, setCopied] = React.useState(false);

        const handleCopy = () => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard
              .writeText(raw)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              })
              .catch(() => {});
          }
        };

        return (
          <div className="relative group">
            <pre
              className={`max-w-full overflow-x-auto rounded-2xl p-4 pr-14 text-[13px] leading-6 whitespace-pre ${codeBlock} ${className ?? ""}`}
              {...props}
            >
              {React.isValidElement(codeChild) ? (
                <code
                  className="font-mono"
                  dangerouslySetInnerHTML={{
                    __html: highlightJson(raw),
                  }}
                />
              ) : (
                children
              )}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                isDark
                  ? "border-white/15 bg-neutral-800 text-zinc-100 hover:bg-neutral-700"
                  : "border-black/10 bg-white text-gray-900 hover:bg-zinc-50"
              }`}
              aria-label={copied ? "Copied" : "Copy code"}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        );
      },
    }),
    [bodyText, codeBlock, inlineCode, isDark]
  );

  const navHeadingsFiltered = headings.filter((h) => h.level === 2);
  const lastUpdatedDate = updatedAt ? new Date(updatedAt) : null;

  return (
    <main className={`min-h-screen ${pageBackground}`}>
      <Header title="Help" subtitle="" />

      <div className="mx-auto max-w-5xl px-5 pt-10 sm:px-6 lg:px-8">
        {lastUpdatedDate && heroTitle ? (
          <section className="text-center space-y-4">
            <p className={`text-sm ${mutedText}`}>{formatDate(lastUpdatedDate)}</p>
            <h1 className="text-center text-4xl font-semibold tracking-tight">
              {heroTitle}
            </h1>
            {mdUrl ? (
              <div className="flex justify-center">
                <a
                  href={mdUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    isDark
                      ? "text-zinc-100 hover:bg-white/10"
                      : "text-gray-900 hover:bg-zinc-100"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  View as Markdown
                </a>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="mx-auto flex max-w-6xl gap-6 px-5 pb-16 pt-20 sm:px-6 lg:gap-8 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-32 space-y-4">
            <nav className="mb-4 flex items-center gap-2 text-sm text-slate-900 dark:text-zinc-100">
              <a href="/help" className={`hover:underline ${mutedText}`}>
                Help
              </a>
              <span className={mutedText}>/</span>
              <span className="font-semibold">
                {heroTitle || "Article"}
              </span>
            </nav>
            <div>{/* spacer for potential intro */}</div>
            <nav className="space-y-1 text-sm">
              {navHeadingsFiltered.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  className={`block rounded-md px-2 py-1 transition ${navLink} ${
                    activeHash === `#${heading.id}`
                      ? "underline decoration-1 underline-offset-2"
                      : ""
                  }`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1 max-w-3xl w-full mx-auto px-1 sm:px-0">
          <nav className="mb-6 flex items-center gap-2 text-sm pl-1 sm:pl-0 lg:hidden text-slate-900 dark:text-zinc-100">
            <a href="/help" className={`hover:underline ${mutedText}`}>
              Help
            </a>
            <span className={mutedText}>/</span>
            <span className="font-semibold">
              {heroTitle || "Article"}
            </span>
          </nav>

          <article className="space-y-8" id="content-top">
            <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
          </article>
        </div>
      </div>
    </main>
  );
}
