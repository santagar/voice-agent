import Link from "next/link";
import Image from "next/image";
import { AudioLines } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200/70 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50">
          <AudioLines className="h-9 w-9" strokeWidth={1.6} />
        </div>
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Voice Agent Lab ready for real-time prototyping.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Kick off by editing <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">app/lab/page.tsx</code> and follow the official{" "}
            <a
              href="https://platform.openai.com/docs/guides/audio_realtime"
              className="font-medium text-zinc-950 dark:text-zinc-50"
              target="_blank"
              rel="noreferrer"
            >
              OpenAI Realtime + Audio guide
            </a>{" "}
            for streaming conversations, or review{" "}
            <a
              href="https://docs.pinecone.io/docs/overview"
              className="font-medium text-zinc-950 dark:text-zinc-50"
              target="_blank"
              rel="noreferrer"
            >
              Pinecone vector best practices
            </a>{" "}
            to keep your agent backed by fresh knowledge.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="/lab"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Open Lab
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="#"
          >
            Documentation
          </Link>
        </div>
      </main>
    </div>
  );
}
