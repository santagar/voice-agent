import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { hydrateConversationOnce } = await import(
  pathToFileURL(
    path.resolve(
      __dirname,
      "../../app/(public)/main/hooks/conversationHydrationHelpers.ts"
    )
  ).href
);

type VoiceMessage = { id?: string; from: string; text: string };

type MockStorage = {
  data: Record<string, string>;
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
};

function createStorage(): MockStorage {
  const data: Record<string, string> = {};
  return {
    data,
    setItem: (key, value) => {
      data[key] = value;
    },
    getItem: (key) => data[key] ?? null,
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const t = (key: string) => key;

type FetchResult = { ok: boolean; status: number; data?: any };

function makeGetConversation(response: FetchResult) {
  return (async () => ({
    ok: response.ok,
    status: response.status,
    conversation: response.data?.conversation,
    messages: response.data?.messages,
  })) as any;
}

test("hydrateConversationOnce succeeds and maps messages", async () => {
  const messages: VoiceMessage[] = [];
  let activeId: string | null = null;

  const status = await hydrateConversationOnce({
    initialChatId: "conv-123",
    t,
    fetchConversation: makeGetConversation({
      ok: true,
      status: 200,
      data: {
        messages: [
          { id: "1", from: "assistant", text: "hola" },
          { id: "2", from: "user", text: "adios" },
        ],
      },
    }),
    storage: createStorage(),
    onPushHome: () => {},
    onSetMessages: (msgs: VoiceMessage[]) => messages.push(...msgs),
    onSetConversationId: (id: string) => {
      activeId = id;
    },
    onSetChatId: () => {},
    onSetIsNewChatLayout: () => {},
  });

  assert.equal(status, "ok");
  assert.equal(messages.length, 2);
  assert.equal(activeId, "conv-123");
});

test("hydrateConversationOnce handles 404 and stores toast", async () => {
  const storage = createStorage();
  let pushedHome = false;
  const status = await hydrateConversationOnce({
    initialChatId: "missing",
    t,
    fetchConversation: makeGetConversation({ ok: false, status: 404 }),
    storage,
    onPushHome: () => {
      pushedHome = true;
    },
    onSetMessages: () => {},
    onSetConversationId: () => {},
    onSetChatId: () => {},
    onSetIsNewChatLayout: () => {},
  });

  assert.equal(status, "not_found");
  assert.equal(pushedHome, true);
  assert.ok(storage.getItem("va-toast"));
});

test("hydrateConversationOnce returns invalid when payload is missing messages", async () => {
  const status = await hydrateConversationOnce({
    initialChatId: "bad",
    t,
    fetchConversation: makeGetConversation({
      ok: true,
      status: 200,
      data: { foo: "bar" },
    }),
    storage: createStorage(),
    onPushHome: () => {},
    onSetMessages: () => {},
    onSetConversationId: () => {},
    onSetChatId: () => {},
    onSetIsNewChatLayout: () => {},
  });

  assert.equal(status, "invalid");
});

test("hydrateConversationOnce returns timeout on AbortError", async () => {
  const status = await hydrateConversationOnce({
    initialChatId: "abort",
    t,
    fetchConversation: (async () => {
      throw new DOMException("Aborted", "AbortError");
    }) as any,
    storage: createStorage(),
    onPushHome: () => {},
    onSetMessages: () => {},
    onSetConversationId: () => {},
    onSetChatId: () => {},
    onSetIsNewChatLayout: () => {},
  });

  assert.equal(status, "timeout");
});

test("hydrateConversationOnce returns error on fetch failure", async () => {
  const status = await hydrateConversationOnce({
    initialChatId: "fail",
    t,
    fetchConversation: (async () => {
      throw new Error("boom");
    }) as any,
    storage: createStorage(),
    onPushHome: () => {},
    onSetMessages: () => {},
    onSetConversationId: () => {},
    onSetChatId: () => {},
    onSetIsNewChatLayout: () => {},
  });

  assert.equal(status, "error");
});
