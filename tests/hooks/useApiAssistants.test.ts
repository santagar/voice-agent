import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { useApiAssistants } = await import(
  pathToFileURL(path.resolve(__dirname, "../../hooks/useApiAssistants.ts")).href
);

type FetchCall = { url: string; init?: RequestInit };

function createFetchMock(response: { ok: boolean; status?: number; data?: any }) {
  const calls: FetchCall[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      async json() {
        return response.data ?? null;
      },
    } as Response;
  };
  return { fetch, calls };
}

test("fetchAssistantConfig hits the correct endpoint and returns json", async () => {
  const mock = createFetchMock({
    ok: true,
    status: 200,
    data: { instructions: [] },
  });
  const { fetchAssistantConfig } = useApiAssistants(mock.fetch as typeof fetch);
  const data = await fetchAssistantConfig("asst-123");
  assert.equal(mock.calls[0]?.url, "/api/assistants/asst-123/config");
  assert.deepEqual(data, { instructions: [] });
});

test("fetchAssistantConfig throws on failure", async () => {
  const mock = createFetchMock({ ok: false, status: 500 });
  const { fetchAssistantConfig } = useApiAssistants(mock.fetch as typeof fetch);
  await assert.rejects(() => fetchAssistantConfig("bad-id"));
});
