"use client";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { CameraPreview } from "@/components/CameraPreview";
import { Scene } from "@/components/Scene";
import { Controller } from "@/lib/controller";
import { GESTURE_GUIDE } from "@/lib/gestureGuide";
import { clearModel, getModel, isModelFile, setModel, type StoredModel } from "@/lib/model";
import { useHandTracker } from "@/lib/useHandTracker";

const DEVICE_KEY = "hand3d.camera";
const readDevice = () => {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? "";
  } catch {
    return "";
  }
};
const saveDevice = (id: string) => {
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {}
};

export default function Player() {
  const [deviceId, setDeviceId] = useState(readDevice);
  const { videoRef, handsRef, status, error, devices, start } = useHandTracker(deviceId);
  const [controller] = useState(() => new Controller());
  const [model, setModelState] = useState<StoredModel | null>(getModel);
  const [hud, setHud] = useState("Không thấy tay");
  const [toast, setToast] = useState<string | null>(null);
  const hudRef = useRef(hud);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current); // timer của toast trước không được xoá toast mới
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const onFrame = useCallback(
    (dt: number) => {
      const hands = handsRef.current;
      const gestures = controller.step(hands, dt);
      const text = hands.map((h, i) => `${h.side}: ${gestures[i]}`).join(" | ") || "Không thấy tay";
      if (text !== hudRef.current) {
        hudRef.current = text;
        setHud(text);
      }
      return controller.transform;
    },
    [controller, handsRef],
  );

  const onModelError = useCallback(
    (e: Error) => {
      clearModel();
      setModelState(null);
      showToast(`Không đọc được model: ${e.message}`);
    },
    [showToast],
  );

  const openFile = (file: File | undefined) => {
    if (!file) return;
    if (!isModelFile(file.name)) return showToast("Chỉ hỗ trợ file .glb hoặc .gltf (texture nhúng sẵn).");
    setModelState(setModel(file, file.name));
    controller.reset();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    openFile(e.dataTransfer.files[0]);
  };

  const running = status === "running";

  return (
    <div
      className="relative h-[calc(100dvh-3.5rem)] overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <Scene modelUrl={model?.url ?? null} onFrame={onFrame} onModelError={onModelError} />

      {/* HUD trên trái */}
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-sm">
        {running && <p className="text-accent">{hud}</p>}
        <p className="mt-1 text-xs text-muted">Model: {model?.name ?? "khối lập phương"}</p>
      </div>

      {/* Điều khiển trên phải */}
      <div className="absolute right-4 top-4 flex gap-2 text-sm">
        {devices.length > 1 && (
          <select
            aria-label="Chọn camera"
            value={deviceId}
            onChange={(e) => {
              setDeviceId(e.target.value);
              saveDevice(e.target.value);
            }}
            className="border border-line bg-panel px-2 py-1.5 text-ink"
          >
            <option value="">Camera mặc định</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-line bg-panel px-3 py-1.5 text-ink hover:border-accent"
        >
          Mở model
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".glb,.gltf"
          hidden
          onChange={(e) => {
            openFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {/* Ô camera dưới trái — luôn mount để hook gắn được stream vào <video> */}
      <div className="absolute bottom-4 left-4">
        <CameraPreview videoRef={videoRef} handsRef={handsRef} visible={running} />
      </div>

      {/* Màn hình bắt đầu / đang tải / lỗi */}
      {!running && (
        <div className="absolute inset-0 grid place-items-center bg-bg/80 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-line bg-panel p-7">
            <h1 className="text-2xl font-semibold">Điều khiển bằng tay</h1>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {GESTURE_GUIDE.map((g) => (
                <li key={g.gesture} className="flex gap-2">
                  <span aria-hidden>{g.emoji}</span>
                  <span className="text-muted">{g.action}</span>
                </li>
              ))}
            </ul>
            {error && <p role="alert" className="mt-5 text-sm text-warn">{error}</p>}
            <button
              onClick={start}
              disabled={status === "loading"}
              className="mt-6 w-full bg-accent py-3 font-semibold text-bg disabled:opacity-60"
            >
              {status === "loading" ? "Đang khởi động…" : status === "error" ? "Thử lại" : "Bật camera"}
            </button>
            <p className="mt-3 text-xs text-muted">
              Kéo thả file .glb vào trang để thay model. Camera được xử lý ngay trên máy bạn.
            </p>
          </div>
        </div>
      )}

      {toast && (
        <p role="status" className="absolute bottom-4 right-4 border border-warn bg-panel px-4 py-2 text-sm text-warn">
          {toast}
        </p>
      )}
    </div>
  );
}
