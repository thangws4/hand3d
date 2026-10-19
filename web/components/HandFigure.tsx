import { CONNECTIONS } from "@/lib/hands";

// 21 điểm khớp của một bàn tay đang xoè, cùng đánh số như MediaPipe (0 = cổ tay, 4 = đầu ngón cái, 8 = đầu ngón trỏ…)
const POINTS: [number, number][] = [
  [0.5, 0.95],
  [0.38, 0.85], [0.28, 0.74], [0.21, 0.64], [0.15, 0.55],
  [0.4, 0.55], [0.37, 0.38], [0.355, 0.27], [0.345, 0.17],
  [0.5, 0.53], [0.5, 0.33], [0.5, 0.21], [0.5, 0.1],
  [0.6, 0.55], [0.62, 0.37], [0.63, 0.26], [0.64, 0.17],
  [0.69, 0.6], [0.73, 0.47], [0.755, 0.39], [0.78, 0.31],
];
const S = 400;

/** Khung xương bàn tay đúng như MediaPipe nhìn thấy — hình đại diện của cả dự án. */
export function HandFigure({ className = "" }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={className} role="img" aria-label="Khung xương bàn tay gồm 21 điểm khớp">
      <g className="bone" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" opacity={0.55}>
        {CONNECTIONS.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={POINTS[a][0] * S} y1={POINTS[a][1] * S} x2={POINTS[b][0] * S} y2={POINTS[b][1] * S} />
        ))}
      </g>
      {POINTS.map(([x, y], i) => (
        <g key={i} className="landmark" style={{ animationDelay: `${i * 40}ms` }}>
          <circle cx={x * S} cy={y * S} r={i % 4 === 0 && i > 0 ? 7 : 5} className="fill-accent" />
          <text x={x * S + 10} y={y * S - 8} className="fill-muted font-mono text-[11px]">{i}</text>
        </g>
      ))}
    </svg>
  );
}
