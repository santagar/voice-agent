import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { useApiConversations } = await import(
  pathToFileURL(
    path.resolve(__dirname, "../../hooks/useApiConversations.ts")
  ).href
);

type FetchCall = { url: string; init?: RequestInit };

function createFetchMock(
  response: { ok: boolean; status?: number },
  calls: FetchCall[] = []
) {
  return {
    fetch: async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: response.ok,
        status: response.status ?? (response.ok ? 200 : 500),
      } as Response;
    },
    calls,
  };
}

test("archiveConversationRequest returns true on success", async () => {
  const tracker = createFetchMock({ ok: true });
  const { archiveConversation: archiveConversationRequest } = useApiConversations(
    tracker.fetch as typeof fetch
  );
  const result = await archiveConversationRequest("abc");
  assert.equal(result, true);
  assert.equal(tracker.calls[0]?.url, "/api/conversations/abc");
  assert.equal(tracker.calls[0]?.init?.method, "PATCH");
});

test("archiveConversationRequest returns false on failure", async () => {
  const tracker = createFetchMock({ ok: false, status: 500 });
  const { archiveConversation: archiveConversationRequest } = useApiConversations(
    tracker.fetch as typeof fetch
  );
  const result = await archiveConversationRequest("abc");
  assert.equal(result, false);
});

test("deleteConversationRequest accepts 204", async () => {
  const tracker = createFetchMock({ ok: false, status: 204 });
  const { deleteConversation: deleteConversationRequest } = useApiConversations(
    tracker.fetch as typeof fetch
  );
  const result = await deleteConversationRequest("abc");
  assert.equal(result, true);
  assert.equal(tracker.calls[0]?.init?.method, "DELETE");
});

test("deleteConversationRequest returns false on non-204 failure", async () => {
  const tracker = createFetchMock({ ok: false, status: 500 });
  const { deleteConversation: deleteConversationRequest } = useApiConversations(
    tracker.fetch as typeof fetch
  );
  const result = await deleteConversationRequest("abc");
  assert.equal(result, false);
});

test("renameConversationRequest trims and sends title", async () => {
  const calls: FetchCall[] = [];
  const fetchMock = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return { ok: true, status: 200 } as Response;
  };
  const { renameConversation: renameConversationRequest } = useApiConversations(
    fetchMock as typeof fetch
  );
  const result = await renameConversationRequest(
    "conv-1",
    "  Hello world  "
  );
  assert.equal(result, true);
  assert.equal(calls[0]?.url, "/api/conversations/conv-1");
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.ok(
    typeof calls[0]?.init?.body === "string" &&
      (calls[0]?.init?.body as string).includes("\"title\":\"Hello world\"")
  );
});

test("renameConversationRequest returns false when title is empty", async () => {
  const { renameConversation: renameConversationRequest } = useApiConversations(
    fetch as typeof fetch
  );
  const result = await renameConversationRequest("conv-1", "   ");
  assert.equal(result, false);
});
