"use client";
import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { CameraPreview } from "@/components/CameraPreview";
import { Scene, type PartSummary } from "@/components/Scene";
import { Controller, EXPLODE_MAX, type HitTest, type PointerMode } from "@/lib/controller";
import { DEMO_NAME } from "@/lib/demoModel";
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
  const [parts, setParts] = useState<PartSummary[]>([]);
  const partNames = useRef(new Map<string, string>());
  const cursorRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null); // lớp bọc khung 3D nhận sự kiện chuột
  const sliderRef = useRef<HTMLInputElement>(null);
  const hitTestRef = useRef<HitTest>(() => null); // hitTest mới nhất từ Scene, dùng trong sự kiện chuột
  const [partLabel, setPartLabel] = useState("");
  const partLabelRef = useRef("");

  const onParts = useCallback((list: PartSummary[]) => {
    partNames.current = new Map(list.map((p) => [p.id, p.name]));
    setParts(list);
  }, []);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current); // timer của toast trước không được xoá toast mới
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const onFrame = useCallback(
    (dt: number, hitTest: HitTest) => {
      hitTestRef.current = hitTest;
      const hands = handsRef.current;
      const gestures = controller.step(hands, dt, hitTest);
      const highlight = controller.grabbed ?? controller.pointerGrab ?? controller.hovered ?? controller.pointerHovered;
      const name = highlight ? (partNames.current.get(highlight) ?? "") : "";
      if (name !== partLabelRef.current) {
        partLabelRef.current = name;
        setPartLabel(name);
      }
      const text = hands.map((h, i) => `${h.side}: ${gestures[i]}`).join(" | ") || "Không thấy tay";
      if (text !== hudRef.current) {
        hudRef.current = text;
        setHud(text);
      }
      // Con trỏ tay và thanh trượt cập nhật trực tiếp trên DOM mỗi khung, không qua React state
      const el = cursorRef.current;
      const c = controller.cursor;
      if (el && el.parentElement) {
        el.style.display = c ? "block" : "none";
        if (c) el.style.transform = `translate(${c.x * el.parentElement.clientWidth}px, ${c.y * el.parentElement.clientHeight}px)`;
      }
      const s = sliderRef.current;
      if (s && document.activeElement !== s) s.value = String(controller.transform.explode);
      return { transform: controller.transform, highlight };
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

  const toStage = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } : { x: 0, y: 0 };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    const mode: PointerMode = e.button === 2 || e.shiftKey ? "pan" : "rotate";
    e.currentTarget.setPointerCapture(e.pointerId); // nhả chuột ngoài khung vẫn kết thúc kéo
    const p = toStage(e);
    controller.pointerDown(p.x, p.y, mode, hitTestRef.current);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = toStage(e);
    controller.pointerMove(p.x, p.y);
    if (e.pointerType === "mouse") controller.pointerHover(p.x, p.y, hitTestRef.current);
  };

  const onPointerEnd = () => controller.pointerUp();

  // Lăn chuột: listener không passive để chặn cuộn trang (onWheel của React là passive)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      controller.wheel(e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [controller]);

  const running = status === "running";

  return (
    <div
      className="relative h-[calc(100dvh-3.5rem)] overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div
        ref={stageRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={() => controller.clearHover()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Scene modelUrl={model?.url ?? null} onFrame={onFrame} onModelError={onModelError} onParts={onParts} />
      </div>
      {running && (
        <div
          ref={cursorRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 -ml-3 -mt-3 hidden size-6 rounded-full border-2 border-accent"
        />
      )}

      {/* HUD trên trái */}
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-sm" data-parts={parts.length}>
        {running && <p className="text-accent">{hud}</p>}
        {partLabel && <p className="text-ink">Linh kiện: {partLabel}</p>}
        <p className="mt-1 text-xs text-muted">
          Model: {model?.name ?? DEMO_NAME}
          {parts.length === 1 && " · liền một khối, không tách được linh kiện"}
        </p>
      </div>

      {/* Điều khiển trên phải */}
      {/* z-10: nằm trên lớp phủ bắt đầu/lỗi để vẫn đổi được camera và mở model khi camera lỗi */}
      <div className="absolute right-4 top-4 z-10 flex gap-2 text-sm">
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
          onClick={() => controller.reset()}
          className="border border-line bg-panel px-3 py-1.5 text-ink hover:border-accent"
        >
          Đặt lại
        </button>
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

      {/* Độ bung: kéo để bung/ráp; tự cập nhật khi bung bằng 2 tay */}
      <label className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 border border-line bg-panel/90 px-4 py-2 text-sm">
        <span className="text-muted">Độ bung</span>
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={EXPLODE_MAX}
          step={0.01}
          defaultValue={0}
          disabled={parts.length < 2}
          onInput={(e) => controller.setExplode(Number(e.currentTarget.value))}
          className="w-40 accent-[#3df5c4] disabled:opacity-40"
        />
      </label>

      {/* Ô camera dưới trái — luôn mount để hook gắn được stream vào <video> */}
      <div className="absolute bottom-4 left-4">
        <CameraPreview videoRef={videoRef} handsRef={handsRef} visible={running} />
      </div>

      {/* Thẻ bật camera ở góc — không che khung 3D, chuột dùng được ngay */}
      {!running && (
        <div className="absolute bottom-4 right-4 z-10 w-96 border border-line bg-panel p-5">
          <h1 className="text-lg font-semibold">Điều khiển bằng tay</h1>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {GESTURE_GUIDE.map((g) => (
              <li key={g.gesture} className="flex gap-2">
                <span aria-hidden className="w-9 shrink-0 whitespace-nowrap">{g.emoji}</span>
                <span className="text-muted">{g.action}</span>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
          <button
            onClick={start}
            disabled={status === "loading"}
            className="mt-4 w-full bg-accent py-2.5 font-semibold text-bg disabled:opacity-60"
          >
            {status === "loading" ? "Đang khởi động…" : status === "error" ? "Thử lại" : "Bật camera"}
          </button>
          <p className="mt-3 text-xs text-muted">
            Hoặc dùng chuột: kéo để xoay, kéo lên linh kiện để cầm, chuột phải để dịch, lăn để phóng to.
          </p>
        </div>
      )}

      {toast && (
        <p role="status" className="absolute left-1/2 top-4 -translate-x-1/2 border border-warn bg-panel px-4 py-2 text-sm text-warn">
          {toast}
        </p>
      )}
    </div>
  );
}
