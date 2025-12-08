import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { createTranscriptGuard } = await import(
  pathToFileURL(
    path.resolve(
      __dirname,
      "../../app/(public)/main/utils/transcriptGuard.ts"
    )
  ).href
);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("wait resolves after registered transcript promise", async () => {
  const guard = createTranscriptGuard();
  const order: string[] = [];

  const transcript = (async () => {
    order.push("transcript:start");
    await delay(5);
    order.push("transcript:end");
  })();

  guard.register(transcript);
  await guard.wait();
  order.push("after-wait");

  assert.deepEqual(order, ["transcript:start", "transcript:end", "after-wait"]);
});

test("wait does not throw if transcript persistence fails", async () => {
  const guard = createTranscriptGuard();
  const order: string[] = [];

  const transcript = (async () => {
    order.push("transcript:start");
    await delay(5);
    order.push("transcript:end");
    throw new Error("persist failed");
  })();

  guard.register(transcript);
  await guard.wait(); // should swallow the error
  order.push("after-wait");

  assert.deepEqual(order, ["transcript:start", "transcript:end", "after-wait"]);
});

test("wait is a no-op when there is no pending transcript", async () => {
  const guard = createTranscriptGuard();
  const order: string[] = [];

  await guard.wait();
  order.push("after-wait");

  assert.deepEqual(order, ["after-wait"]);
});

test("wait honors hold + register to enforce user-before-assistant ordering", async () => {
  const guard = createTranscriptGuard();
  const order: string[] = [];

  // User utterance starts: hold the guard (placeholder shown).
  guard.hold();

  // Simulate assistant finishing early and waiting.
  const waitPromise = guard.wait().then(() => {
    order.push("assistant-persists");
  });

  // User transcript persistence starts (e.g., POST /messages).
  const userPersist = (async () => {
    order.push("user-persist:start");
    await delay(5);
    order.push("user-persist:end");
  })();
  guard.register(userPersist);

  // Transcript arrives, we release the hold (placeholder gone).
  guard.release();

  await waitPromise;

  assert.deepEqual(order, [
    "user-persist:start",
    "user-persist:end",
    "assistant-persists",
  ]);
});
