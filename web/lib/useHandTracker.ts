"use client";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAMERA_LOST_MESSAGE,
  cameraErrorMessage,
  DETECT_FAILED_MESSAGE,
  INSECURE_CONTEXT_MESSAGE,
  MODEL_LOAD_MESSAGE,
  shouldRetryDefault,
} from "@/lib/cameraErrors";
import type { Hand } from "@/lib/controller";
import { nextTimestamp, toHands } from "@/lib/hands";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

export type TrackerStatus = "idle" | "loading" | "running" | "error";

const openCamera = (deviceId: string) =>
  navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
  });

async function createLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO" as const,
    numHands: 2,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    return await HandLandmarker.createFromOptions(fileset, options("CPU")); // máy không có WebGL2
  }
}

/** Camera + MediaPipe Hand Landmarker → handsRef cập nhật mỗi khung hình (không re-render React). */
export function useHandTracker(deviceId: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handsRef = useRef<Hand[]>([]);
  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [run, setRun] = useState(0); // 0 = người dùng chưa bấm "Bật camera"

  const start = useCallback(() => {
    setStatus("loading");
    setError(null);
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    if (run === 0) return;
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;

    const cleanup = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
      stream = null;
      landmarker = null;
      handsRef.current = [];
    };
    const fail = (msg: string) => {
      cleanup();
      if (!cancelled) {
        setError(msg);
        setStatus("error");
      }
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return fail(INSECURE_CONTEXT_MESSAGE);
      try {
        stream = await openCamera(deviceId).catch((e) => {
          if (shouldRetryDefault(e, deviceId)) return openCamera("");
          throw e;
        });
      } catch (e) {
        return fail(cameraErrorMessage(e));
      }
      if (cancelled) return cleanup();
      // Camera bị rút ra / hệ điều hành tắt giữa phiên: báo lỗi thay vì giữ tay cũ mãi
      stream.getVideoTracks()[0]?.addEventListener("ended", () => fail(CAMERA_LOST_MESSAGE));

      const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (cancelled) return cleanup();
      setDevices(all.filter((d) => d.kind === "videoinput"));

      const video = videoRef.current;
      if (!video) return fail("Không tìm thấy khung video.");
      video.srcObject = stream;
      await video.play().catch(() => {}); // bị ngắt khi đổi camera: bỏ qua

      try {
        landmarker = await createLandmarker();
      } catch {
        return fail(MODEL_LOAD_MESSAGE);
      }
      if (cancelled) return cleanup();
      setStatus("running");

      let lastTs = 0;
      let lastFrame = -1;
      const loop = () => {
        if (landmarker && video.readyState >= 2 && video.currentTime !== lastFrame) {
          lastFrame = video.currentTime;
          lastTs = nextTimestamp(lastTs, performance.now());
          try {
            handsRef.current = toHands(landmarker.detectForVideo(video, lastTs));
          } catch {
            return fail(DETECT_FAILED_MESSAGE); // vd. mất WebGL context: dừng vòng lặp và báo lỗi
          }
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [run, deviceId]);

  return { videoRef, handsRef, status, error, devices, start };
}
