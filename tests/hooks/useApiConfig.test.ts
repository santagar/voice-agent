import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { useApiConfig } = await import(
  pathToFileURL(path.resolve(__dirname, "../../hooks/useApiConfig.ts")).href
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

test("useApiConfig fetches instructions/tools/sanitize", async () => {
  const mock = createFetchMock({
    ok: true,
    status: 200,
    data: { ok: true },
  });
  const { fetchInstructions, fetchTools, fetchSanitize } = useApiConfig(
    mock.fetch as typeof fetch
  );
  await fetchInstructions();
  await fetchTools();
  await fetchSanitize();
  assert.equal(mock.calls[0]?.url, "/api/config/instructions");
  assert.equal(mock.calls[1]?.url, "/api/config/tools");
  assert.equal(mock.calls[2]?.url, "/api/config/sanitize");
});

test("useApiConfig throws on failure", async () => {
  const mock = createFetchMock({ ok: false, status: 500 });
  const { fetchInstructions } = useApiConfig(mock.fetch as typeof fetch);
  await assert.rejects(() => fetchInstructions());
});
