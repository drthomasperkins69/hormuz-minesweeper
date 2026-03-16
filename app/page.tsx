"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";

// --- Types ---
type CellState = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
  isLand: boolean;
};

type GameStatus = "idle" | "playing" | "won" | "lost";
type Difficulty = "beginner" | "intermediate" | "expert";

const DIFFICULTIES: Record<Difficulty, { rows: number; cols: number; mines: number }> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

// --- Geographic map using real coordinates ---
// Zoomed in tightly on the Strait of Hormuz
const MAP_BOUNDS = { minLon: 55.0, maxLon: 57.0, minLat: 25.8, maxLat: 26.8 };

function lonToX(lon: number, w: number) {
  return ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * w;
}
function latToY(lat: number, h: number) {
  return ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * h;
}

// Convert grid cell (r,c) to lon/lat center
function cellToGeo(r: number, c: number, rows: number, cols: number): [number, number] {
  const lon = MAP_BOUNDS.minLon + ((c + 0.5) / cols) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const lat = MAP_BOUNDS.maxLat - ((r + 0.5) / rows) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  return [lon, lat];
}

// --- Coastline data (same coordinates, works at any zoom) ---
const iranCoast: [number, number][] = [
  [55.0, 26.8], // top-left of view
  [55.0, 26.58],
  [55.05, 26.57],
  [55.1, 26.56],
  [55.15, 26.56],
  [55.2, 26.57],
  [55.25, 26.58],
  [55.3, 26.60],
  [55.35, 26.62],
  [55.4, 26.63],
  [55.45, 26.64],
  [55.5, 26.65],
  [55.55, 26.65],
  [55.6, 26.64],
  [55.65, 26.63],
  [55.7, 26.61],
  [55.75, 26.60],
  [55.8, 26.58],
  [55.85, 26.57],
  [55.9, 26.56],
  [55.95, 26.55],
  [56.0, 26.55],
  [56.05, 26.54],
  [56.1, 26.53],
  [56.15, 26.50],
  [56.2, 26.47],
  [56.25, 26.43],
  [56.3, 26.38],
  [56.35, 26.35],
  [56.4, 26.32],
  [56.45, 26.30],
  [56.5, 26.28],
  [56.55, 26.26],
  [56.6, 26.24],
  [56.65, 26.22],
  [56.7, 26.20],
  [56.8, 26.18],
  [56.9, 26.15],
  [57.0, 26.12],
  [57.0, 26.8], // top-right of view
];

const arabCoast: [number, number][] = [
  [55.0, 25.8], // bottom-left of view
  [55.0, 25.88],
  [55.1, 25.90],
  [55.2, 25.93],
  [55.3, 25.95],
  [55.4, 25.97],
  [55.5, 25.98],
  [55.6, 26.00],
  [55.7, 26.02],
  [55.75, 26.04],
  [55.8, 26.06],
  [55.85, 26.08],
  [55.9, 26.10],
  [55.95, 26.12],
  [56.0, 26.14],
  [56.05, 26.18],
  [56.1, 26.22],
  [56.15, 26.26],
  [56.18, 26.28],
  [56.2, 26.30],
  [56.25, 26.32],
  [56.28, 26.30],
  [56.3, 26.27],
  [56.32, 26.24],
  [56.34, 26.20],
  [56.35, 26.16],
  [56.36, 26.12],
  [56.37, 26.08],
  [56.38, 26.04],
  [56.4, 26.00],
  [56.42, 25.96],
  [56.45, 25.92],
  [56.5, 25.88],
  [56.55, 25.85],
  [56.6, 25.82],
  [56.65, 25.80],
  [56.7, 25.80],
  [56.8, 25.80],
  [56.9, 25.80],
  [57.0, 25.80],
  [57.0, 25.8], // bottom-right of view
];

const qeshm: [number, number][] = [
  [55.3, 26.52], [55.4, 26.50], [55.5, 26.48], [55.6, 26.46],
  [55.7, 26.44], [55.8, 26.42], [55.9, 26.40], [56.0, 26.38],
  [56.05, 26.37], [56.1, 26.36], [56.15, 26.36], [56.2, 26.37],
  [56.22, 26.38], [56.2, 26.40], [56.15, 26.42], [56.1, 26.43],
  [56.05, 26.44], [56.0, 26.45], [55.9, 26.46], [55.8, 26.48],
  [55.7, 26.50], [55.6, 26.52], [55.5, 26.53], [55.4, 26.54],
  [55.35, 26.54],
];

const hormuzIsland: [number, number][] = [
  [56.44, 26.44], [56.48, 26.42], [56.50, 26.44],
  [56.48, 26.47], [56.44, 26.47], [56.42, 26.45],
];

const larakIsland: [number, number][] = [
  [56.32, 26.50], [56.36, 26.49], [56.38, 26.51],
  [56.36, 26.53], [56.32, 26.53], [56.30, 26.51],
];

const hengamIsland: [number, number][] = [
  [55.88, 26.35], [55.92, 26.34], [55.93, 26.36],
  [55.90, 26.38], [55.87, 26.37],
];

const greaterTunb: [number, number][] = [
  [55.28, 26.24], [55.32, 26.23], [55.33, 26.25],
  [55.30, 26.27], [55.27, 26.26],
];

const lesserTunb: [number, number][] = [
  [55.12, 26.14], [55.15, 26.13], [55.16, 26.15],
  [55.14, 26.16], [55.11, 26.15],
];

// --- Point-in-polygon test (ray casting) ---
function pointInPolygon(lon: number, lat: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isLandCell(lon: number, lat: number): boolean {
  if (pointInPolygon(lon, lat, iranCoast)) return true;
  if (pointInPolygon(lon, lat, arabCoast)) return true;
  if (pointInPolygon(lon, lat, qeshm)) return true;
  if (pointInPolygon(lon, lat, hormuzIsland)) return true;
  if (pointInPolygon(lon, lat, larakIsland)) return true;
  if (pointInPolygon(lon, lat, hengamIsland)) return true;
  if (pointInPolygon(lon, lat, greaterTunb)) return true;
  if (pointInPolygon(lon, lat, lesserTunb)) return true;
  return false;
}

// --- Build land mask for a grid ---
function buildLandMask(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const [lon, lat] = cellToGeo(r, c, rows, cols);
      return isLandCell(lon, lat);
    })
  );
}

function drawCoastline(
  ctx: CanvasRenderingContext2D,
  coords: [number, number][],
  w: number,
  h: number,
  close = true
) {
  ctx.beginPath();
  coords.forEach(([lon, lat], i) => {
    const x = lonToX(lon, w);
    const y = latToY(lat, h);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (close) ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawMap(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Ocean
  const oceanGrad = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.8);
  oceanGrad.addColorStop(0, "#5ba8d0");
  oceanGrad.addColorStop(0.4, "#4a96bf");
  oceanGrad.addColorStop(1, "#3a7aa0");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(100,190,220,0.15)";
  ctx.fillRect(0, 0, w, h);

  const landColor = "#c8b87c";
  const landDark = "#a89860";
  ctx.strokeStyle = landDark;
  ctx.lineWidth = 1.5;

  // Iran
  ctx.fillStyle = landColor;
  drawCoastline(ctx, iranCoast, w, h);
  const iranGrad = ctx.createLinearGradient(0, 0, w * 0.5, h * 0.3);
  iranGrad.addColorStop(0, "rgba(180,160,120,0.4)");
  iranGrad.addColorStop(1, "rgba(200,184,124,0.1)");
  ctx.fillStyle = iranGrad;
  drawCoastline(ctx, iranCoast, w, h);

  // UAE/Oman
  ctx.fillStyle = landColor;
  drawCoastline(ctx, arabCoast, w, h);
  const arabGrad = ctx.createLinearGradient(w * 0.3, h, w * 0.8, h * 0.5);
  arabGrad.addColorStop(0, "rgba(180,160,120,0.4)");
  arabGrad.addColorStop(1, "rgba(200,184,124,0.1)");
  ctx.fillStyle = arabGrad;
  drawCoastline(ctx, arabCoast, w, h);

  // Islands
  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, qeshm, w, h);
  ctx.fillStyle = "#d4a574";
  drawCoastline(ctx, hormuzIsland, w, h);
  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, larakIsland, w, h);
  drawCoastline(ctx, hengamIsland, w, h);
  drawCoastline(ctx, greaterTunb, w, h);
  drawCoastline(ctx, lesserTunb, w, h);

  // Shipping lanes
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lonToX(55.0, w), latToY(26.2, h));
  ctx.lineTo(lonToX(55.5, w), latToY(26.15, h));
  ctx.lineTo(lonToX(56.2, w), latToY(26.15, h));
  ctx.lineTo(lonToX(57.0, w), latToY(25.95, h));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lonToX(55.0, w), latToY(26.05, h));
  ctx.lineTo(lonToX(55.5, w), latToY(26.0, h));
  ctx.lineTo(lonToX(56.15, w), latToY(26.05, h));
  ctx.lineTo(lonToX(57.0, w), latToY(25.85, h));
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(14, Math.floor(w * 0.022))}px 'Georgia', serif`;
  ctx.fillText("I R A N", lonToX(55.3, w), latToY(26.72, h));

  ctx.font = `bold ${Math.max(12, Math.floor(w * 0.018))}px 'Georgia', serif`;
  ctx.fillText("U.A.E.", lonToX(55.1, w), latToY(25.92, h));
  ctx.fillText("OMAN", lonToX(56.55, w), latToY(25.88, h));

  ctx.font = `italic ${Math.max(11, Math.floor(w * 0.016))}px 'Georgia', serif`;
  ctx.fillStyle = "#c8e0f0";
  ctx.fillText("Persian Gulf", lonToX(55.05, w), latToY(26.25, h));
  ctx.fillText("Gulf of Oman", lonToX(56.55, w), latToY(26.05, h));

  ctx.font = `italic bold ${Math.max(11, Math.floor(w * 0.016))}px 'Georgia', serif`;
  ctx.fillStyle = "#a8d0e8";
  ctx.fillText("Strait of Hormuz", lonToX(55.7, w), latToY(26.22, h));

  ctx.font = `${Math.max(9, Math.floor(w * 0.013))}px 'Georgia', serif`;
  ctx.fillStyle = "#e8d8a0";
  ctx.fillText("Qeshm", lonToX(55.65, w), latToY(26.50, h));
  ctx.fillText("Hormuz", lonToX(56.35, w), latToY(26.40, h));
  ctx.fillText("Larak", lonToX(56.22, w), latToY(26.54, h));
  ctx.fillText("Hengam", lonToX(55.82, w), latToY(26.33, h));

  // City markers
  ctx.shadowBlur = 0;
  const cs = Math.max(3, Math.floor(w * 0.005));
  ctx.fillStyle = "#ffcc00";
  ctx.beginPath();
  ctx.arc(lonToX(56.28, w), latToY(26.55, h), cs, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffeeaa";
  ctx.font = `${Math.max(9, Math.floor(w * 0.012))}px sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 2;
  ctx.fillText("Bandar Abbas", lonToX(56.30, w), latToY(26.57, h));

  ctx.fillStyle = "#ffcc00";
  ctx.beginPath();
  ctx.arc(lonToX(56.25, w), latToY(26.20, h), cs, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffeeaa";
  ctx.fillText("Khasab", lonToX(56.12, w), latToY(26.16, h));

  ctx.shadowBlur = 0;

  // Mountain shading
  for (let i = 0; i < 50; i++) {
    const cx = lonToX(55.0 + Math.random() * 2.0, w);
    const cy = latToY(26.75 - Math.random() * 0.15, h);
    ctx.fillStyle = `rgba(160,140,100,${0.06 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10 + Math.random() * 20, 4 + Math.random() * 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Desert texture
  for (let i = 0; i < 40; i++) {
    const cx = lonToX(55.0 + Math.random() * 1.5, w);
    const cy = latToY(25.85 + Math.random() * 0.1, h);
    ctx.fillStyle = `rgba(210,190,140,${0.05 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10 + Math.random() * 20, 4 + Math.random() * 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Number colors (classic minesweeper) ---
const NUM_COLORS: Record<number, string> = {
  1: "#0000ff",
  2: "#008000",
  3: "#ff0000",
  4: "#000080",
  5: "#800000",
  6: "#008080",
  7: "#000000",
  8: "#808080",
};

// --- Game logic ---
function createBoard(rows: number, cols: number, mines: number, firstR: number, firstC: number, landMask: boolean[][]): CellState[][] {
  const board: CellState[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
      isLand: landMask[r][c],
    }))
  );

  // Collect water cells for mine placement
  const waterCells: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!landMask[r][c]) {
        // Skip first click neighborhood
        if (Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1) continue;
        waterCells.push([r, c]);
      }
    }
  }

  // Shuffle and pick mines (only in water)
  for (let i = waterCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [waterCells[i], waterCells[j]] = [waterCells[j], waterCells[i]];
  }

  const actualMines = Math.min(mines, waterCells.length);
  for (let i = 0; i < actualMines; i++) {
    const [r, c] = waterCells[i];
    board[r][c].mine = true;
  }

  // Count adjacents (only count water-cell mines)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine || board[r][c].isLand) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++;
        }
      }
      board[r][c].adjacentMines = count;
    }
  }

  return board;
}

function reveal(board: CellState[][], r: number, c: number, rows: number, cols: number): CellState[][] {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  const stack: [number, number][] = [[r, c]];

  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    if (newBoard[cr][cc].revealed || newBoard[cr][cc].flagged || newBoard[cr][cc].isLand) continue;
    newBoard[cr][cc].revealed = true;
    if (newBoard[cr][cc].adjacentMines === 0 && !newBoard[cr][cc].mine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          stack.push([cr + dr, cc + dc]);
        }
      }
    }
  }

  return newBoard;
}

function checkWin(board: CellState[][], rows: number, cols: number, totalMines: number): boolean {
  let revealedCount = 0;
  let landCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isLand) landCount++;
      else if (board[r][c].revealed) revealedCount++;
    }
  }
  return revealedCount === (rows * cols - landCount - totalMines);
}

// --- AdSense Component ---
function AdBanner({ slot, style }: { slot: string; style?: React.CSSProperties }) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded
    }
  }, []);

  return (
    <div ref={adRef} style={{ textAlign: "center", overflow: "hidden", ...style }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

// --- Main Component ---
export default function HormuzMinesweeper() {
  const [difficulty, setDifficulty] = useState<Difficulty>("expert");
  const { rows, cols, mines } = DIFFICULTIES[difficulty];
  const [board, setBoard] = useState<CellState[][] | null>(null);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [flagCount, setFlagCount] = useState(0);
  const [time, setTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapDataRef = useRef<string | null>(null);

  // Pre-compute land mask
  const landMask = useMemo(() => buildLandMask(rows, cols), [rows, cols]);

  // Count water cells for win condition
  const waterCellCount = useMemo(() => {
    let count = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!landMask[r][c]) count++;
      }
    }
    return count;
  }, [landMask, rows, cols]);

  const actualMines = Math.min(mines, waterCellCount - 9); // ensure space around first click

  // Generate map background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cellSize = 28;
    const w = cols * cellSize;
    const h = rows * cellSize;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    drawMap(ctx, w, h);
    mapDataRef.current = canvas.toDataURL();
  }, [rows, cols]);

  // Timer
  useEffect(() => {
    if (status === "playing") {
      timerRef.current = setInterval(() => setTime(t => Math.min(t + 1, 999)), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const resetGame = useCallback(() => {
    setBoard(null);
    setStatus("idle");
    setFlagCount(0);
    setTime(0);
  }, []);

  const handleCellClick = useCallback((r: number, c: number) => {
    if (status === "won" || status === "lost") return;
    if (landMask[r][c]) return; // Can't click land

    if (!board) {
      const newBoard = createBoard(rows, cols, actualMines, r, c, landMask);
      const revealed = reveal(newBoard, r, c, rows, cols);
      setBoard(revealed);
      setStatus("playing");
      if (checkWin(revealed, rows, cols, actualMines)) setStatus("won");
      return;
    }

    const cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    if (cell.mine) {
      const newBoard = board.map(row => row.map(cl => ({
        ...cl,
        revealed: cl.mine ? true : cl.revealed,
      })));
      newBoard[r][c] = { ...newBoard[r][c], revealed: true };
      setBoard(newBoard);
      setStatus("lost");
      return;
    }

    const revealed = reveal(board, r, c, rows, cols);
    setBoard(revealed);
    if (checkWin(revealed, rows, cols, actualMines)) setStatus("won");
  }, [board, status, rows, cols, actualMines, landMask]);

  const handleChord = useCallback((r: number, c: number) => {
    if (status !== "playing" || !board) return;
    const cell = board[r][c];
    if (!cell.revealed || cell.adjacentMines === 0) return;

    let flaggedNeighbors = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].flagged) {
          flaggedNeighbors++;
        }
      }
    }

    if (flaggedNeighbors !== cell.adjacentMines) return;

    let newBoard = board.map(row => row.map(cl => ({ ...cl })));
    let hitMine = false;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbor = newBoard[nr][nc];
          if (!neighbor.revealed && !neighbor.flagged && !neighbor.isLand) {
            if (neighbor.mine) {
              hitMine = true;
              newBoard[nr][nc].revealed = true;
            } else {
              newBoard = reveal(newBoard, nr, nc, rows, cols);
            }
          }
        }
      }
    }

    if (hitMine) {
      newBoard = newBoard.map(row => row.map(cl => ({
        ...cl,
        revealed: cl.mine ? true : cl.revealed,
      })));
      setBoard(newBoard);
      setStatus("lost");
    } else {
      setBoard(newBoard);
      if (checkWin(newBoard, rows, cols, actualMines)) setStatus("won");
    }
  }, [board, status, rows, cols, actualMines]);

  const handleRightClick = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (status === "won" || status === "lost") return;
    if (!board) return;
    if (landMask[r][c]) return; // Can't flag land
    const cell = board[r][c];
    if (cell.revealed) return;

    const newBoard = board.map(row => row.map(cl => ({ ...cl })));
    newBoard[r][c].flagged = !cell.flagged;
    setBoard(newBoard);
    setFlagCount(f => cell.flagged ? f - 1 : f + 1);
  }, [board, status, landMask]);

  const changeDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setBoard(null);
    setStatus("idle");
    setFlagCount(0);
    setTime(0);
  };

  const cellSize = 28;
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;

  const face = status === "won" ? "😎" : status === "lost" ? "💀" : "🙂";
  const minesLeft = actualMines - flagCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "10px", background: "#1a1a2e" }}>
      {/* Hidden canvas for map generation */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Top Ad */}
      <AdBanner slot="1234567890" style={{ marginBottom: "12px", maxWidth: gridW }} />

      {/* Title */}
      <h1 style={{ color: "#e0d5b0", fontFamily: "serif", fontSize: "24px", marginBottom: "8px", textShadow: "2px 2px 4px rgba(0,0,0,0.5)", letterSpacing: "2px" }}>
        ⚓ MINESWEEPER: STRAIT OF HORMUZ ⚓
      </h1>

      {/* Difficulty selector */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        {(["beginner", "intermediate", "expert"] as Difficulty[]).map(d => (
          <button
            key={d}
            onClick={() => changeDifficulty(d)}
            style={{
              padding: "4px 14px",
              background: difficulty === d ? "#5ba3cc" : "#2a3a5e",
              color: "#fff",
              border: difficulty === d ? "2px solid #8fd4ff" : "2px solid #3a4a6e",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: difficulty === d ? "bold" : "normal",
              fontSize: "13px",
              textTransform: "capitalize",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Game frame */}
      <div style={{
        background: "#4a5568",
        borderRadius: "8px",
        padding: "8px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        border: "3px solid #2d3748",
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#2d3748",
          padding: "6px 12px",
          borderRadius: "4px",
          marginBottom: "6px",
        }}>
          <div style={{
            background: "#000",
            color: "#ff0000",
            fontFamily: "'Courier New', monospace",
            fontSize: "28px",
            fontWeight: "bold",
            padding: "2px 8px",
            borderRadius: "3px",
            minWidth: "65px",
            textAlign: "center",
            border: "2px inset #333",
          }}>
            {String(Math.max(0, minesLeft)).padStart(3, "0")}
          </div>

          <button
            onClick={resetGame}
            style={{
              fontSize: "28px",
              background: "#ddd",
              border: "3px outset #eee",
              borderRadius: "4px",
              cursor: "pointer",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {face}
          </button>

          <div style={{
            background: "#000",
            color: "#ff0000",
            fontFamily: "'Courier New', monospace",
            fontSize: "28px",
            fontWeight: "bold",
            padding: "2px 8px",
            borderRadius: "3px",
            minWidth: "65px",
            textAlign: "center",
            border: "2px inset #333",
          }}>
            {String(time).padStart(3, "0")}
          </div>
        </div>

        {/* Grid */}
        <div style={{
          position: "relative",
          width: gridW,
          height: gridH,
          overflow: "hidden",
          borderRadius: "2px",
          border: "3px inset #666",
        }}>
          {/* Map background */}
          {mapDataRef.current && (
            <img
              src={mapDataRef.current}
              alt=""
              style={{ position: "absolute", top: 0, left: 0, width: gridW, height: gridH, opacity: 0.6, pointerEvents: "none" }}
            />
          )}

          {/* Cells */}
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`, gridTemplateRows: `repeat(${rows}, ${cellSize}px)` }}>
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const cell = board ? board[r][c] : null;
                const isLand = landMask[r][c];
                const isRevealed = cell?.revealed ?? false;
                const isFlagged = cell?.flagged ?? false;
                const isMine = cell?.mine ?? false;
                const adj = cell?.adjacentMines ?? 0;
                const isExploded = isRevealed && isMine && status === "lost";

                if (isLand) {
                  return (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        background: "transparent",
                        border: "1px solid rgba(168,152,96,0.15)",
                        cursor: "default",
                      }}
                    />
                  );
                }

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    onDoubleClick={() => handleChord(r, c)}
                    onContextMenu={(e) => handleRightClick(e, r, c)}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor: (status === "won" || status === "lost") ? "default" : "pointer",
                      userSelect: "none",
                      border: isRevealed
                        ? "1px solid rgba(100,130,160,0.3)"
                        : "2px outset rgba(120,180,220,0.5)",
                      background: isExploded
                        ? "rgba(255,50,50,0.7)"
                        : isRevealed
                          ? "rgba(180,200,220,0.2)"
                          : "rgba(60,120,180,0.3)",
                      transition: "background 0.1s",
                      color: isRevealed && !isMine && adj > 0 ? (NUM_COLORS[adj] || "#000") : "#000",
                      textShadow: isRevealed && !isMine && adj > 0 ? "0 0 3px rgba(255,255,255,0.6)" : "none",
                    }}
                  >
                    {isFlagged && !isRevealed && "🚩"}
                    {isRevealed && isMine && "💣"}
                    {isRevealed && !isMine && adj > 0 && adj}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Status message */}
        {(status === "won" || status === "lost") && (
          <div style={{
            textAlign: "center",
            padding: "8px",
            marginTop: "6px",
            borderRadius: "4px",
            background: status === "won" ? "rgba(0,180,0,0.2)" : "rgba(200,0,0,0.2)",
            color: status === "won" ? "#4ade80" : "#f87171",
            fontWeight: "bold",
            fontSize: "16px",
            fontFamily: "serif",
            letterSpacing: "1px",
          }}>
            {status === "won"
              ? "🎖️ STRAIT SECURED — ALL MINES CLEARED!"
              : "💥 MINE DETONATED — STRAIT COMPROMISED!"}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{ color: "#8899aa", fontSize: "12px", marginTop: "8px", textAlign: "center", fontFamily: "monospace" }}>
        Left click: Reveal  •  Right click: Flag  •  Double click number: Chord
      </div>
      <div style={{ color: "#667788", fontSize: "11px", marginTop: "4px", fontFamily: "monospace" }}>
        Mines are only in the water — land is safe!
      </div>

      {/* Bottom Ad */}
      <AdBanner slot="0987654321" style={{ marginTop: "16px", maxWidth: gridW }} />
    </div>
  );
}
