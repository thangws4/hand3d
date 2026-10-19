"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { classifyError, errorMessage } from "@/lib/genErrors";
import { clearToken, isValidToken, loadToken, maskToken, saveToken } from "@/lib/hfToken";
import { generate, SPACE_ID, type PhaseInfo } from "@/lib/imageTo3d";
import { prepImage } from "@/lib/imagePrep";
import { setModel } from "@/lib/model";

const ModelPreview = dynamic(() => import("@/components/ModelPreview"), { ssr: false });

type Picked = { blob: Blob; url: string; name: string };
type Run =
  | { kind: "idle" }
  | { kind: "running"; info: PhaseInfo; startedAt: number }
  | { kind: "done"; blob: Blob; url: string }
  | { kind: "error"; message: string };

const PHASE_TEXT: Record<PhaseInfo["phase"], string> = {
  connecting: "Đang kết nối tới Hugging Face…",
  queued: "Đang xếp hàng",
  preprocessing: "Đang tách nền ảnh…",
  generating: "Đang tạo hình 3D, thường mất 1–2 phút…",
  exporting: "Đang xuất file .glb…",
  downloading: "Đang tải file về máy…",
};
const phaseText = (p: PhaseInfo) => (p.phase === "queued" ? `Đang xếp hàng, vị trí ${p.position}…` : PHASE_TEXT[p.phase]);
const baseName = (name: string) => name.replace(/\.[^.]+$/, "") || "model";

export default function Creator() {
  const router = useRouter();
  const [token, setToken] = useState(loadToken);
  const [draft, setDraft] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const ctrlRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Rời trang khi đang tạo: huỷ job để không tiêu hạn mức ngầm
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const running = run.kind === "running";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const submitToken = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidToken(draft)) return setTokenError("Token phải bắt đầu bằng hf_ và dài ít nhất 33 ký tự.");
    saveToken(draft);
    setToken(draft.trim());
    setDraft("");
    setTokenError(null);
  };

  const removeToken = () => {
    clearToken();
    setToken("");
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await prepImage(file);
      if (picked) URL.revokeObjectURL(picked.url);
      setPicked({ blob, url: URL.createObjectURL(blob), name: baseName(file.name) });
      setRun({ kind: "idle" });
    } catch (e) {
      setRun({ kind: "error", message: errorMessage(classifyError(e)) });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    void pick(e.dataTransfer.files[0]);
  };

  const start = async () => {
    if (!picked || running) return;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const startedAt = Date.now();
    setNow(startedAt);
    setRun({ kind: "running", info: { phase: "connecting" }, startedAt });
    try {
      const blob = await generate(picked.blob, token, {
        signal: ctrl.signal,
        onPhase: (info) => setRun({ kind: "running", info, startedAt }),
      });
      setRun({ kind: "done", blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      const err = classifyError(e);
      if (!ctrl.signal.aborted || err.code !== "cancelled") setRun({ kind: "error", message: errorMessage(err) });
      else setRun({ kind: "idle" });
    } finally {
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  };

  const openInPlay = () => {
    if (run.kind !== "done" || !picked) return;
    setModel(run.blob, `${picked.name}.glb`);
    router.push("/play");
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_1.1fr]">
      <section>
        <h1 className="text-4xl font-semibold tracking-tight">Tạo mô hình 3D từ ảnh</h1>
        <p className="mt-3 max-w-md text-muted">
          Chụp một vật thể trên nền đơn giản, tải ảnh lên và nhận về file .glb để điều khiển bằng tay.
        </p>

        {!token ? (
          <form onSubmit={submitToken} className="mt-8 border border-line bg-panel p-6">
            <h2 className="text-lg font-medium">Cần Hugging Face token (miễn phí)</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Tạo tài khoản tại huggingface.co.</li>
              <li>
                Mở{" "}
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-accent underline">
                  huggingface.co/settings/tokens
                </a>{" "}
                và tạo token loại <b className="text-ink">Read</b>.
              </li>
              <li>Dán token vào ô dưới đây.</li>
            </ol>
            <label htmlFor="hf-token" className="mt-5 block text-sm">Token</label>
            <input
              id="hf-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="hf_…"
              className="mt-1 w-full border border-line bg-bg px-3 py-2 font-mono text-sm"
            />
            {tokenError && <p role="alert" className="mt-2 text-sm text-warn">{tokenError}</p>}
            <button className="mt-4 bg-accent px-5 py-2 font-semibold text-bg">Lưu token</button>
            <p className="mt-3 text-xs text-muted">
              Token chỉ lưu trong trình duyệt này và chỉ được gửi tới Hugging Face.
            </p>
          </form>
        ) : (
          <>
            <p className="mt-6 text-sm text-muted">
              Token: <span className="font-mono text-ink">{maskToken(token)}</span>{" "}
              <button onClick={removeToken} disabled={running} className="ml-2 underline hover:text-ink disabled:opacity-50">
                Xoá token
              </button>
            </p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="mt-4 grid min-h-56 place-items-center border border-dashed border-line bg-panel p-4 text-center"
            >
              {picked ? (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh blob cục bộ, không cần tối ưu
                <img src={picked.url} alt={`Ảnh đã chọn: ${picked.name}`} className="max-h-64 object-contain" />
              ) : (
                <p className="text-muted">Kéo thả ảnh vào đây</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={running}
                className="border border-line px-4 py-2 hover:border-accent disabled:opacity-50"
              >
                Chọn ảnh
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  void pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                onClick={start}
                disabled={!picked || running}
                className="bg-accent px-5 py-2 font-semibold text-bg disabled:opacity-50"
              >
                Tạo 3D
              </button>
              {running && (
                <button onClick={() => ctrlRef.current?.abort()} className="border border-line px-4 py-2 hover:border-warn">
                  Huỷ
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">
              Ảnh sẽ được gửi tới Hugging Face Space công khai <span className="font-mono">{SPACE_ID}</span> để xử lý.
            </p>
          </>
        )}
      </section>

      <section aria-live="polite" className="flex min-h-96 flex-col border border-line bg-panel">
        {run.kind === "done" ? (
          <>
            <div className="min-h-96 flex-1">
              <ModelPreview
                url={run.url}
                onError={(e) => setRun({ kind: "error", message: `Không đọc được file .glb: ${e.message}` })}
              />
            </div>
            <div className="flex flex-wrap gap-3 border-t border-line p-4">
              <a href={run.url} download={`${picked?.name ?? "model"}.glb`} className="border border-line px-4 py-2 hover:border-accent">
                Tải .glb
              </a>
              <button onClick={openInPlay} className="bg-accent px-5 py-2 font-semibold text-bg">
                Điều khiển bằng tay
              </button>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            {run.kind === "running" && (
              <div>
                <p className="text-lg">{phaseText(run.info)}</p>
                <p className="mt-2 font-mono text-sm text-muted">{Math.round((now - run.startedAt) / 1000)} giây</p>
              </div>
            )}
            {run.kind === "error" && <p role="alert" className="max-w-sm text-warn">{run.message}</p>}
            {run.kind === "idle" && <p className="text-muted">Mô hình 3D sẽ hiện ở đây.</p>}
          </div>
        )}
      </section>
    </main>
  );
}
