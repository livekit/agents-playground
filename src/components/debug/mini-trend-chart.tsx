import { useId, useRef, useState } from "react";

export type TrendPoint = {
  t: number;
  v: number;
};

const STALE_TREND_RATIO = 0.6;

export function MiniTrendChart({
  points,
  unit,
  label,
}: {
  points: TrendPoint[];
  unit: "s" | "tok/s" | "count";
  label: string;
}) {
  const patternId = useId();
  const maskGradientId = useId();
  const maskId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [frozenPoints, setFrozenPoints] = useState<TrendPoint[] | null>(null);
  const displayedPoints = frozenPoints ?? points;

  if (displayedPoints.length === 0) {
    return (
      <div
        className="h-[160px] flex items-center justify-center text-[10px]"
        style={{ color: "var(--lk-dbg-fg4)" }}
      >
        No samples
      </div>
    );
  }

  const width = 520;
  const height = 186;
  const left = unit === "tok/s" ? 94 : 72;
  const right = 12;
  const top = 10;
  const bottom = 30;
  let min = Infinity;
  let max = -Infinity;
  for (const p of displayedPoints) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  const span = Math.max(max - min, 1e-9);
  const minTime = displayedPoints[0]?.t ?? 0;
  const maxTime = displayedPoints[displayedPoints.length - 1]?.t ?? minTime;
  const timeSpan = Math.max(maxTime - minTime, 1e-9);

  const plotted = displayedPoints.map((point) => {
    const x =
      displayedPoints.length === 1
        ? width / 2
        : left + ((point.t - minTime) / timeSpan) * (width - left - right);
    const norm = (point.v - min) / span;
    const y = top + (1 - norm) * (height - top - bottom);
    return { x, y };
  });

  const firstTimestamp = displayedPoints[0]?.t ?? 0;
  const lastTimestamp =
    displayedPoints[displayedPoints.length - 1]?.t ?? firstTimestamp;
  const staleCutoffSec =
    firstTimestamp + (lastTimestamp - firstTimestamp) * STALE_TREND_RATIO;

  const linePath = plotted
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const [staleLinePath, freshLinePath] = (() => {
    type XY = { x: number; y: number };
    const stalePolylines: XY[][] = [];
    const freshPolylines: XY[][] = [];
    const epsilon = 0.01;

    const appendSegment = (target: XY[][], start: XY, end: XY) => {
      const polyline = target[target.length - 1];
      if (!polyline) {
        target.push([start, end]);
        return;
      }
      const tail = polyline[polyline.length - 1];
      const isConnected =
        tail !== undefined &&
        Math.abs(tail.x - start.x) < epsilon &&
        Math.abs(tail.y - start.y) < epsilon;
      if (isConnected) {
        polyline.push(end);
        return;
      }
      target.push([start, end]);
    };

    for (let i = 1; i < plotted.length; i++) {
      const prev = plotted[i - 1];
      const curr = plotted[i];
      const prevPoint = displayedPoints[i - 1];
      const currPoint = displayedPoints[i];
      if (!prev || !curr || !prevPoint || !currPoint) continue;

      const prevStale = prevPoint.t <= staleCutoffSec;
      const currStale = currPoint.t <= staleCutoffSec;
      if (prevStale === currStale) {
        appendSegment(prevStale ? stalePolylines : freshPolylines, prev, curr);
        continue;
      }

      const dt = currPoint.t - prevPoint.t;
      if (dt === 0) {
        appendSegment(prevStale ? stalePolylines : freshPolylines, prev, curr);
        continue;
      }

      const ratio = Math.max(
        0,
        Math.min(1, (staleCutoffSec - prevPoint.t) / dt),
      );
      const split = {
        x: prev.x + (curr.x - prev.x) * ratio,
        y: prev.y + (curr.y - prev.y) * ratio,
      };
      appendSegment(prevStale ? stalePolylines : freshPolylines, prev, split);
      appendSegment(currStale ? stalePolylines : freshPolylines, split, curr);
    }

    const toPath = (polylines: XY[][]) =>
      polylines
        .map((polyline) =>
          polyline
            .map(
              (point, i) =>
                `${i === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
            )
            .join(" "),
        )
        .join(" ");

    return [toPath(stalePolylines), toPath(freshPolylines)];
  })();
  const lastPoint = plotted[plotted.length - 1] ?? {
    x: width - right,
    y: height / 2,
  };
  const firstPoint = plotted[0] ?? { x: left, y: height / 2 };
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${(height - bottom).toFixed(2)} L ${firstPoint.x.toFixed(2)} ${(height - bottom).toFixed(2)} Z`;
  const graphBottom = height - bottom;

  const yTicks = [0, 0.33, 0.66, 1].map((k) => {
    const v = min + (1 - k) * span;
    const y = top + k * (height - top - bottom);
    return { v, y };
  });

  const xTickIdx = Array.from(
    new Set([
      0,
      Math.floor((displayedPoints.length - 1) / 2),
      displayedPoints.length - 1,
    ]),
  );

  const formatYAxis = (v: number): string => {
    if (unit === "tok/s") {
      const d = span < 1 ? 2 : span < 10 ? 1 : 0;
      return `${v.toFixed(d)} tok/s`;
    }
    if (unit === "count") {
      return `${Math.round(v)}`;
    }
    // All values under 1s → format as ms
    if (max < 1) {
      const spanMs = span * 1000;
      if (spanMs < 10) return `${(v * 1000).toFixed(1)} ms`;
      return `${Math.round(v * 1000)} ms`;
    }
    // Seconds: pick enough decimal places so adjacent ticks don't collide
    const decimals = Math.min(
      3,
      Math.max(1, Math.ceil(-Math.log10(span * 0.3))),
    );
    return `${v.toFixed(decimals)} s`;
  };

  const formatXAxis = (t: number): string =>
    new Date(t * 1000)
      .toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
      .toLowerCase();

  const hoverSample = (() => {
    if (hoverRatio === null || displayedPoints.length === 0) return undefined;
    const hoverX = left + hoverRatio * (width - left - right);
    if (displayedPoints.length === 1) {
      const onlyPoint = displayedPoints[0];
      const onlyPlotted = plotted[0];
      if (!onlyPoint || !onlyPlotted) return undefined;
      return { x: width / 2, y: onlyPlotted.y, t: onlyPoint.t, v: onlyPoint.v };
    }

    let leftIndex = 0;
    for (let i = 0; i < plotted.length - 1; i++) {
      const curr = plotted[i];
      const next = plotted[i + 1];
      if (!curr || !next) continue;
      if (hoverX <= next.x) {
        leftIndex = i;
        break;
      }
      leftIndex = i + 1;
    }
    const rightIndex = Math.min(displayedPoints.length - 1, leftIndex + 1);
    const leftRaw = displayedPoints[leftIndex];
    const rightRaw = displayedPoints[rightIndex];
    const leftPlotted = plotted[leftIndex];
    const rightPlotted = plotted[rightIndex];
    if (!leftRaw || !rightRaw || !leftPlotted || !rightPlotted)
      return undefined;
    const dx = rightPlotted.x - leftPlotted.x;
    const blend =
      dx === 0 ? 0 : Math.max(0, Math.min(1, (hoverX - leftPlotted.x) / dx));

    return {
      x: hoverX,
      y: leftPlotted.y + (rightPlotted.y - leftPlotted.y) * blend,
      t: leftRaw.t + (rightRaw.t - leftRaw.t) * blend,
      v: leftRaw.v + (rightRaw.v - leftRaw.v) * blend,
    };
  })();
  const hoverLabel =
    hoverSample !== undefined ? formatYAxis(hoverSample.v) : "";
  const hoverTimestamp =
    hoverSample !== undefined
      ? new Date(hoverSample.t * 1000).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      : "";
  const tooltipHeight = 68;
  const tooltipPaddingX = 14;
  const tooltipTimestampY = 22;
  const tooltipValueRowY = 45;
  const tooltipValueTextX = tooltipPaddingX + 11;
  const tooltipMetricLabel = `${label}:`;
  const tooltipMetricValue = hoverLabel;
  const tooltipValueGap = 8;
  const tooltipMinWidth = 158;
  const tooltipMaxWidth = 300;
  const monoCharWidth = 5.8;
  const sansCharWidth = 5.2;
  const timestampTextWidth = hoverTimestamp.length * monoCharWidth;
  const labelTextWidth = tooltipMetricLabel.length * sansCharWidth;
  const valueTextWidth = tooltipMetricValue.length * sansCharWidth;
  const valueRowTextWidth =
    labelTextWidth + tooltipValueGap + valueTextWidth + 11;
  const tooltipContentWidth = Math.max(timestampTextWidth, valueRowTextWidth);
  const tooltipWidth = Math.min(
    tooltipMaxWidth,
    Math.max(
      tooltipMinWidth,
      Math.ceil(tooltipContentWidth + tooltipPaddingX * 2),
    ),
  );

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-[186px]"
      aria-hidden
      onMouseMove={(e) => {
        const svg = svgRef.current;
        if (!svg) return;
        if (frozenPoints === null) setFrozenPoints(displayedPoints);
        const rect = svg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * width;
        const ratio = Math.max(
          0,
          Math.min(1, (x - left) / (width - left - right)),
        );
        setHoverRatio(ratio);
      }}
      onMouseLeave={() => {
        setHoverRatio(null);
        setFrozenPoints(null);
      }}
    >
      <defs>
        <pattern
          id={patternId}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="2.5"
            cy="2.5"
            r="1.6"
            fill="var(--lk-theme-color, var(--lk-dbg-fg))"
            opacity="0.58"
          />
        </pattern>
        <linearGradient id={maskGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="55%" stopColor="white" stopOpacity="0.28" />
          <stop offset="100%" stopColor="white" stopOpacity="0.08" />
        </linearGradient>
        <mask
          id={maskId}
          x="0"
          y="0"
          width={width}
          height={height}
          maskUnits="userSpaceOnUse"
        >
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            fill={`url(#${maskGradientId})`}
          />
        </mask>
      </defs>
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={left}
            x2={width - right}
            y1={tick.y}
            y2={tick.y}
            stroke="rgba(255, 255, 255, 0.09)"
            strokeWidth="1"
          />
          <text
            x={left - 6}
            y={tick.y + 3}
            fontSize="12"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            textAnchor="end"
            fill="rgba(255, 255, 255, 0.52)"
          >
            {formatYAxis(tick.v)}
          </text>
        </g>
      ))}
      <path d={areaPath} fill={`url(#${patternId})`} mask={`url(#${maskId})`} />
      <line
        x1={lastPoint.x}
        x2={lastPoint.x}
        y1={lastPoint.y}
        y2={graphBottom}
        stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      {staleLinePath && (
        <path
          d={staleLinePath}
          fill="none"
          stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
          strokeOpacity="0.9"
          strokeWidth="2.4"
        />
      )}
      {freshLinePath && (
        <path
          d={freshLinePath}
          fill="none"
          stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
          strokeWidth="2.4"
        />
      )}
      {hoverSample && (
        <>
          <line
            x1={left}
            x2={width - right}
            y1={hoverSample.y}
            y2={hoverSample.y}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
          <line
            x1={hoverSample.x}
            x2={hoverSample.x}
            y1={top}
            y2={graphBottom}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
          <rect
            x={hoverSample.x - 4}
            y={hoverSample.y - 4}
            width="8"
            height="8"
            fill="var(--lk-dbg-bg)"
            stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
            strokeWidth="1.8"
            rx="1"
          />
        </>
      )}
      {xTickIdx.map((idx, i) => {
        const point = displayedPoints[idx];
        const plottedPoint = plotted[idx];
        if (!point) return null;
        const x = plottedPoint?.x ?? width / 2;
        return (
          <text
            key={i}
            x={x}
            y={height - 6}
            fontSize="12"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            textAnchor={
              i === 0 ? "start" : i === xTickIdx.length - 1 ? "end" : "middle"
            }
            fill="rgba(255, 255, 255, 0.52)"
          >
            {formatXAxis(point.t)}
          </text>
        );
      })}
      {hoverSample && (
        <g
          transform={`translate(${Math.min(width - tooltipWidth, Math.max(left + 8, hoverSample.x + 14))}, ${Math.min(height - tooltipHeight, Math.max(top + 6, hoverSample.y + 8))})`}
        >
          <rect
            x="0"
            y="0"
            width={tooltipWidth}
            height={tooltipHeight}
            rx="6"
            fill="rgb(12, 12, 12)"
            stroke="rgba(255,255,255,0.28)"
          />
          <text
            x={tooltipPaddingX}
            y={tooltipTimestampY}
            fontSize="9.5"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            fill="rgba(255,255,255,0.9)"
          >
            {hoverTimestamp}
          </text>
          <rect
            x={tooltipPaddingX}
            y={tooltipValueRowY - 8}
            width="7"
            height="7"
            fill="var(--lk-theme-color, var(--lk-dbg-fg))"
          />
          <text
            x={tooltipValueTextX}
            y={tooltipValueRowY}
            fontSize="9.8"
            fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          >
            <tspan fill="rgba(255,255,255,0.82)">{tooltipMetricLabel}</tspan>
            <tspan dx={tooltipValueGap} fill="#fff">
              {tooltipMetricValue}
            </tspan>
          </text>
        </g>
      )}
    </svg>
  );
}
