import { formatDuration } from "../../utils/time";

interface Segment {
  color: string;
  seconds: number;
}

interface Props {
  segments: Segment[];
  totalSeconds: number;
  size?: number;
}

/** Donut chart of time shares (one arc per segment) with the total duration in the middle. */
export default function DonutChart({ segments, totalSeconds, size = 220 }: Props) {
  const radius = (size * 80) / 220;
  const strokeWidth = (size * 34) / 220;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulative = 0;
  const arcs = segments
    .filter((s) => s.seconds > 0)
    .map((s, i) => {
      const fraction = totalSeconds > 0 ? s.seconds / totalSeconds : 0;
      const dash = fraction * circumference;
      const offset = -cumulative * circumference;
      cumulative += fraction;
      return { ...s, dash, offset, key: i };
    });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-surfaceAlt" />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={a.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${a.dash} ${circumference - a.dash}`}
            strokeDashoffset={a.offset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-lg text-gray-100">{formatDuration(totalSeconds)}</span>
      </div>
    </div>
  );
}
