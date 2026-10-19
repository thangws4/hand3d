"use client";
import { useEffect, useRef, type RefObject } from "react";
import type { Hand } from "@/lib/controller";
import { CONNECTIONS } from "@/lib/hands";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  handsRef: RefObject<Hand[]>;
  visible: boolean;
};

/** Ô camera lật gương + khung xương tay. Landmark đã được lật sẵn nên vẽ thẳng lên canvas không lật. */
export function CameraPreview({ videoRef, handsRef, visible }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const { width: w, height: h } = canvas;
        ctx.clearRect(0, 0, w, h);
        for (const { landmarks: lm } of handsRef.current) {
          ctx.strokeStyle = "rgba(230, 237, 243, 0.85)";
          ctx.lineWidth = 2;
          for (const [a, b] of CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo(lm[a].x * w, lm[a].y * h);
            ctx.lineTo(lm[b].x * w, lm[b].y * h);
            ctx.stroke();
          }
          ctx.fillStyle = "#3df5c4";
          for (const p of lm) {
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [handsRef]);

  // object-fill cho cả video và canvas để toạ độ chuẩn hoá khớp nhau dù camera không đúng 4:3
  return (
    <div className={`relative aspect-[4/3] w-64 overflow-hidden border border-line bg-black ${visible ? "" : "hidden"}`}>
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-fill" />
      <canvas ref={canvasRef} width={320} height={240} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
