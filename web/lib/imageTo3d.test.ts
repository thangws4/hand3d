import { test } from "node:test";
import assert from "node:assert/strict";
import { generate, type PhaseInfo, type SpaceClient, type SpaceEvent } from "./imageTo3d.ts";

const TOKEN = "hf_" + "a".repeat(34);
const GLB_URL = "https://space.example/file=out.glb";
const IMG = new Blob(["png"], { type: "image/png" });
const ANON_QUOTA =
  "You have exceeded your ZeroGPU quota (120s requested vs. 178s left). Try again in 23:59:57. Authenticate with a Hugging Face token for more quota - https://huggingface.co/settings/tokens";

type Script = Record<string, SpaceEvent[] | "hang">;
const OK: Script = {
  "/start_session": [{ type: "data", data: [] }],
  "/preprocess_image": [{ type: "data", data: [{ url: "pre.png" }] }],
  "/image_to_3d": [
    { type: "status", stage: "pending", position: 3 },
    { type: "status", stage: "generating" },
    { type: "data", data: ["<html>"] },
  ],
  "/extract_glb": [{ type: "data", data: [{ url: GLB_URL }, { url: GLB_URL }] }],
};

function fake(script: Script) {
  const calls: { endpoint: string; data: unknown }[] = [];
  let cancelled = 0;
  const client: SpaceClient = {
    submit(endpoint, data) {
      calls.push({ endpoint, data });
      const evs = script[endpoint] ?? [];
      return {
        cancel: async () => {
          cancelled++;
        },
        async *[Symbol.asyncIterator]() {
          if (evs === "hang") await new Promise(() => {});
          else yield* evs;
        },
      };
    },
  };
  return { calls, client, cancelled: () => cancelled };
}

const okFetch = (async () => new Response("GLB")) as typeof fetch;

test("gọi đủ 4 endpoint theo thứ tự, báo giai đoạn + vị trí hàng đợi, trả blob glb", async () => {
  const f = fake(OK);
  const phases: PhaseInfo[] = [];
  let fetched = "";
  const blob = await generate(IMG, TOKEN, {
    connect: async () => f.client,
    onPhase: (p) => phases.push(p),
    fetchFn: (async (url: string) => ((fetched = url), new Response("GLB"))) as typeof fetch,
  });
  assert.deepEqual(f.calls.map((c) => c.endpoint), ["/start_session", "/preprocess_image", "/image_to_3d", "/extract_glb"]);
  assert.deepEqual(f.calls[2].data, { image: { url: "pre.png" }, resolution: "1024" });
  assert.deepEqual(f.calls[3].data, { decimation_target: 100000, texture_size: 1024 });
  assert.ok(phases.some((p) => p.phase === "queued" && p.position === 3));
  assert.deepEqual([...new Set(phases.map((p) => p.phase))], ["connecting", "preprocessing", "generating", "queued", "exporting", "downloading"]);
  assert.equal(fetched, GLB_URL);
  assert.equal(await blob.text(), "GLB");
});

test("status lỗi quota ẩn danh ở image_to_3d → GenError bad_token", async () => {
  const f = fake({ ...OK, "/image_to_3d": [{ type: "status", stage: "error", title: "ZeroGPU quota exceeded", message: ANON_QUOTA }] });
  await assert.rejects(generate(IMG, TOKEN, { connect: async () => f.client, fetchFn: okFetch }), { code: "bad_token" });
});

test("huỷ khi đang tạo hình → GenError cancelled, job gradio bị cancel", async () => {
  const f = fake({ ...OK, "/image_to_3d": "hang" });
  const ctrl = new AbortController();
  const p = generate(IMG, TOKEN, { connect: async () => f.client, fetchFn: okFetch, signal: ctrl.signal });
  setTimeout(() => ctrl.abort(), 20);
  await assert.rejects(p, { code: "cancelled" });
  assert.equal(f.cancelled(), 1);
});

test("quá thời gian → GenError timeout", async () => {
  const f = fake({ ...OK, "/image_to_3d": "hang" });
  await assert.rejects(generate(IMG, TOKEN, { connect: async () => f.client, fetchFn: okFetch, timeoutMs: 20 }), { code: "timeout" });
});

test("huỷ đúng lúc đang tải file glb → cancelled, fetch nhận signal đã huỷ", async () => {
  const f = fake(OK);
  const ctrl = new AbortController();
  let fetchSignal: AbortSignal | undefined;
  const slowFetch = ((_url: string, init?: RequestInit) => {
    fetchSignal = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  }) as typeof fetch;
  const p = generate(IMG, TOKEN, {
    connect: async () => f.client,
    fetchFn: slowFetch,
    signal: ctrl.signal,
    onPhase: ({ phase }) => phase === "downloading" && setTimeout(() => ctrl.abort(), 0),
  });
  await assert.rejects(p, { code: "cancelled" });
  assert.equal(fetchSignal?.aborted, true);
});

test("connect thất bại → space_down; extract_glb không có url → space_down", async () => {
  await assert.rejects(
    generate(IMG, TOKEN, { connect: async () => Promise.reject(new Error("Could not resolve app config")), fetchFn: okFetch }),
    { code: "space_down" },
  );
  const f = fake({ ...OK, "/extract_glb": [{ type: "data", data: [null, null] }] });
  await assert.rejects(generate(IMG, TOKEN, { connect: async () => f.client, fetchFn: okFetch }), { code: "space_down" });
});
