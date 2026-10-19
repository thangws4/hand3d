/** Adapter cho Space microsoft/TRELLIS.2: ảnh → file .glb. Client và fetch tiêm vào được để test. */
import { Client, handle_file } from "@gradio/client";
import { classifyError, GenError } from "./genErrors.ts";

export const SPACE_ID = "microsoft/TRELLIS.2";
export const TIMEOUT_MS = 6 * 60 * 1000;

export type Phase = "connecting" | "queued" | "preprocessing" | "generating" | "exporting" | "downloading";
export type PhaseInfo = { phase: Phase; position?: number };
export type SpaceEvent = { type: string; stage?: string; position?: number; title?: string; message?: unknown; data?: unknown };
export type SpaceJob = AsyncIterable<SpaceEvent> & { cancel: () => Promise<void>; wait_for_id?: () => Promise<unknown> };
export type SpaceClient = { submit: (endpoint: string, data: unknown[] | Record<string, unknown>) => SpaceJob };
export type GenerateOptions = {
  onPhase?: (p: PhaseInfo) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  connect?: (token: string) => Promise<SpaceClient>;
  fetchFn?: typeof fetch;
};

const defaultConnect = async (token: string) =>
  (await Client.connect(SPACE_ID, { token: token as `hf_${string}`, events: ["data", "status"] })) as unknown as SpaceClient;

export async function generate(image: Blob, token: string, opts: GenerateOptions = {}): Promise<Blob> {
  const { onPhase = () => {}, signal, timeoutMs = TIMEOUT_MS, connect = defaultConnect, fetchFn = fetch } = opts;
  const ctrl = new AbortController();
  const stopError = () => new GenError(ctrl.signal.reason === "timeout" ? "timeout" : "cancelled", "");
  // Promise bị reject khi huỷ/quá giờ — chạy đua với pipeline để không bao giờ treo
  const stopped = new Promise<never>((_, reject) => ctrl.signal.addEventListener("abort", () => reject(stopError())));
  const timer = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  const onAbort = () => ctrl.abort("cancelled");
  if (signal?.aborted) onAbort();
  signal?.addEventListener("abort", onAbort);
  // @gradio/client vẫn đẩy sự kiện sau cancel() → bỏ qua mọi báo cáo sau khi đã huỷ/quá giờ
  const report = (p: PhaseInfo) => {
    if (!ctrl.signal.aborted) onPhase(p);
  };

  const call = async (client: SpaceClient, endpoint: string, data: unknown[] | Record<string, unknown>, phase: Phase) => {
    if (ctrl.signal.aborted) throw stopError();
    report({ phase });
    const job = client.submit(endpoint, data);
    // cancel() cần event_id; gọi trước khi có id thì server trả 422 và job vẫn chạy ngầm
    const cancelJob = () => void (job.wait_for_id ? job.wait_for_id().then(() => job.cancel(), () => {}) : job.cancel());
    ctrl.signal.addEventListener("abort", cancelJob);
    try {
      for await (const ev of job) {
        if (ctrl.signal.aborted) throw stopError();
        if (ev.type === "status") {
          if (ev.stage === "error") throw classifyError(ev);
          // hàm thường: chỉ có "pending"; position > 0 là đang xếp hàng, position 0/không có là đã bắt đầu chạy
          if (ev.stage === "pending") report(ev.position ? { phase: "queued", position: ev.position } : { phase });
          if (ev.stage === "generating") report({ phase });
        } else if (ev.type === "data") {
          return (ev.data ?? []) as unknown[];
        }
      }
      throw new GenError("space_down", `${endpoint} kết thúc mà không trả dữ liệu`);
    } finally {
      ctrl.signal.removeEventListener("abort", cancelJob);
    }
  };

  const run = async () => {
    report({ phase: "connecting" });
    const client = await connect(token).catch((e) => Promise.reject(classifyError(e, "space_down")));
    await call(client, "/start_session", [], "connecting");
    const [pre] = await call(client, "/preprocess_image", [handle_file(image)], "preprocessing");
    await call(client, "/image_to_3d", { image: pre, resolution: "1024" }, "generating");
    const out = await call(client, "/extract_glb", { decimation_target: 100000, texture_size: 1024 }, "exporting");
    const url = (out as ({ url?: string } | null)[]).find((f) => f?.url)?.url;
    if (!url) throw new GenError("space_down", "Space không trả về file .glb");
    if (ctrl.signal.aborted) throw stopError();
    report({ phase: "downloading" });
    const res = await fetchFn(url, { signal: ctrl.signal });
    if (!res.ok) throw new GenError("space_down", `Tải file .glb lỗi HTTP ${res.status}`);
    return await res.blob();
  };

  try {
    return await Promise.race([run(), stopped]);
  } catch (e) {
    throw ctrl.signal.aborted ? stopError() : classifyError(e);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
