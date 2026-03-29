import { type ReactNode, useMemo } from "react";
import { cn } from "../../lib/cn";

type GridArtProps = {
  className?: string;
  lineClassName?: string;
  fillClassName?: string;
  highlightOpacityScale?: number;
  glyphOpacity?: number;
};

type GridArtSurfaceProps = {
  children: ReactNode;
  sweepNonce?: number;
  className?: string;
  contentClassName?: string;
};

const CELL_SIZE = 18;
const COLS = 28;
const ROWS = 32;
const WIDTH = COLS * CELL_SIZE;
const HEIGHT = ROWS * CELL_SIZE;
const HIGHLIGHT_SEED: ReadonlyArray<readonly [number, number]> = [
  [3, 2],
  [7, 5],
  [12, 1],
  [18, 4],
  [22, 7],
  [5, 10],
  [15, 12],
  [20, 9],
  [8, 15],
  [25, 11],
  [2, 18],
  [10, 20],
  [17, 16],
  [23, 19],
  [6, 22],
  [14, 24],
  [21, 21],
  [26, 14],
  [4, 26],
  [11, 28],
  [19, 25],
  [9, 30],
  [16, 27],
  [24, 23],
  [1, 8],
  [13, 6],
  [27, 3],
  [20, 30],
  [3, 14],
  [8, 24],
  [22, 17],
  [15, 8],
  [6, 29],
  [25, 26],
  [11, 13],
  [18, 22],
  [2, 5],
  [26, 9],
  [9, 17],
  [14, 3],
];

export function GridArt({
  className,
  lineClassName,
  fillClassName,
  highlightOpacityScale = 1,
  glyphOpacity = 0.12,
}: GridArtProps) {
  const highlighted = useMemo(() => {
    const cells: Array<{ x: number; y: number; opacity: number }> = [];
    const isNearText = (cx: number, cy: number) => cx >= 3 && cx <= 25 && cy >= 12 && cy <= 19;

    for (const [x, y] of HIGHLIGHT_SEED) {
      if (x < COLS && y < ROWS && !isNearText(x, y)) {
        cells.push({
          x,
          y,
          opacity: (0.08 + (((x * 7 + y * 13) % 10) / 10) * 0.15) * highlightOpacityScale,
        });
      }
    }

    return cells;
  }, [highlightOpacityScale]);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <title>Decorative grid background</title>
      {Array.from({ length: COLS + 1 }, (_, col) => col).map((col) => (
        <line
          key={`v${col}`}
          x1={col * CELL_SIZE}
          y1={0}
          x2={col * CELL_SIZE}
          y2={HEIGHT}
          className={cn("stroke-foreground/[0.06]", lineClassName)}
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: ROWS + 1 }, (_, row) => row).map((row) => (
        <line
          key={`h${row}`}
          x1={0}
          y1={row * CELL_SIZE}
          x2={WIDTH}
          y2={row * CELL_SIZE}
          className={cn("stroke-foreground/[0.06]", lineClassName)}
          strokeWidth={1}
        />
      ))}
      {highlighted.map(({ x, y, opacity }) => (
        <rect
          key={`${x}-${y}`}
          x={x * CELL_SIZE + 1}
          y={y * CELL_SIZE + 1}
          width={CELL_SIZE - 2}
          height={CELL_SIZE - 2}
          className={cn("fill-foreground", fillClassName)}
          opacity={opacity}
        />
      ))}
      <g className={cn("fill-foreground", fillClassName)} opacity={glyphOpacity}>
        <rect x={4 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE * 4} />
        <rect x={5 * CELL_SIZE} y={17 * CELL_SIZE} width={CELL_SIZE * 2} height={CELL_SIZE} />
        <rect x={7 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE * 4} />
        <rect x={9 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE * 3} height={CELL_SIZE} />
        <rect x={10 * CELL_SIZE} y={14 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE * 4} />
        <rect x={13 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE * 3} height={CELL_SIZE} />
        <rect x={14 * CELL_SIZE} y={14 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE * 4} />
        <rect x={17 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE * 3} height={CELL_SIZE} />
        <rect x={17 * CELL_SIZE} y={14 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE * 4} />
        <rect x={17 * CELL_SIZE} y={15 * CELL_SIZE} width={CELL_SIZE * 2} height={CELL_SIZE} />
        <rect x={17 * CELL_SIZE} y={17 * CELL_SIZE} width={CELL_SIZE * 3} height={CELL_SIZE} />
        <rect x={21 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE * 5} />
        <rect x={21 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE * 3} height={CELL_SIZE} />
        <rect x={23 * CELL_SIZE} y={14 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} />
        <rect x={21 * CELL_SIZE} y={15 * CELL_SIZE} width={CELL_SIZE * 3} height={CELL_SIZE} />
        <rect x={23 * CELL_SIZE} y={16 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE * 2} />
      </g>
    </svg>
  );
}

function GridSweepBackdrop({ sweepNonce = 0 }: { sweepNonce?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[200vh] [mask-image:linear-gradient(180deg,transparent_0%,black_8%,black_92%,transparent_100%)] [-webkit-mask-image:linear-gradient(180deg,transparent_0%,black_8%,black_92%,transparent_100%)]">
        <GridArt
          className="opacity-[0.14]"
          lineClassName="stroke-foreground/[0.09]"
          highlightOpacityScale={1.3}
          glyphOpacity={0.12}
        />
      </div>

      {sweepNonce > 0 ? (
        <div
          key={sweepNonce}
          className="utter-grid-sweep absolute inset-y-[-18%] left-[-42%] w-[58%] opacity-100 motion-reduce:opacity-0"
        >
          <div className="absolute inset-0 rounded-full bg-foreground/[0.1] blur-3xl" />
          <div className="absolute inset-0 border-x border-foreground/[0.12]" />
          <div className="absolute inset-0 [mask-image:linear-gradient(90deg,transparent_0%,black_18%,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(90deg,transparent_0%,black_18%,black_82%,transparent_100%)]">
            <GridArt
              className="opacity-85"
              lineClassName="stroke-foreground/[0.16]"
              highlightOpacityScale={2}
              glyphOpacity={0.24}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GridArtSurface({
  children,
  sweepNonce = 0,
  className,
  contentClassName,
}: GridArtSurfaceProps) {
  return (
    <div className={cn("relative isolate", className)}>
      <GridSweepBackdrop sweepNonce={sweepNonce} />
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </div>
  );
}
