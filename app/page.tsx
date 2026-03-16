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
const MAP_BOUNDS = { minLon: 55.2, maxLon: 56.8, minLat: 25.9, maxLat: 26.65 };

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
  [56.15, 26.53],
  [56.2, 26.51],
  [56.25, 26.48],
  [56.3, 26.44],
  [56.35, 26.41],
  [56.4, 26.38],
  [56.45, 26.35],
  [56.5, 26.33],
  [56.55, 26.30],
  [56.6, 26.28],
  [56.65, 26.25],
  [56.7, 26.23],
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
  [56.0, 26.10],
  [56.05, 26.13],
  [56.1, 26.16],
  [56.15, 26.19],
  [56.18, 26.21],
  [56.2, 26.23],
  [56.25, 26.25],
  [56.28, 26.23],
  [56.3, 26.20],
  [56.32, 26.17],
  [56.34, 26.14],
  [56.35, 26.10],
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
  if (pointInPolygon(lon, lat, larakIsland)) return true;
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
  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, larakIsland, w, h);
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

  // Country names — positioned over LAND
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold ${Math.max(16, Math.floor(w * 0.025))}px 'Georgia', serif`;
  ctx.fillText("I R A N", lonToX(55.5, w), latToY(26.60, h));  // over Iranian land mass

  ctx.font = `bold ${Math.max(13, Math.floor(w * 0.02))}px 'Georgia', serif`;
  ctx.fillText("U.A.E.", lonToX(55.3, w), latToY(25.95, h));   // over UAE land
  ctx.fillText("OMAN", lonToX(56.15, w), latToY(26.25, h));     // over Musandam land

  // Water body names — positioned over WATER
  ctx.font = `italic ${Math.max(11, Math.floor(w * 0.016))}px 'Georgia', serif`;
  ctx.fillStyle = "#c8e0f0";
  ctx.fillText("Persian Gulf", lonToX(55.25, w), latToY(26.15, h));
  ctx.fillText("Gulf of Oman", lonToX(56.45, w), latToY(26.0, h));

  ctx.font = `italic bold ${Math.max(12, Math.floor(w * 0.018))}px 'Georgia', serif`;
  ctx.fillStyle = "#a8d0e8";
  ctx.fillText("Strait of Hormuz", lonToX(55.7, w), latToY(26.12, h));

  // Island names
  ctx.font = `${Math.max(9, Math.floor(w * 0.013))}px 'Georgia', serif`;
  ctx.fillStyle = "#e8d8a0";
  ctx.fillText("Qeshm", lonToX(55.65, w), latToY(26.42, h));
  ctx.fillText("Hormuz", lonToX(56.42, w), latToY(26.46, h));
  ctx.fillText("Larak", lonToX(56.28, w), latToY(26.52, h));
  ctx.fillText("Hengam", lonToX(55.85, w), latToY(26.37, h));

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

function checkWin(board: CellState[][], rows: number, cols: number, _totalMines: number): boolean {
  // Win when all water cells are revealed (mines get destroyed when hit, so we just check for unrevealed water)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c].isLand && !board[r][c].revealed) return false;
    }
  }
  return true;
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
  const [oilPrice, setOilPrice] = useState(50);
  const [explosions, setExplosions] = useState<{r: number; c: number; startTime: number}[]>([]);
  const [tankersBlownUp, setTankersBlownUp] = useState(0);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState<{winners: any[]; losers: any[]}>({ winners: [], losers: [] });
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [eventPopup, setEventPopup] = useState<{ title: string; message: string; icon: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oilTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapDataRef = useRef<string | null>(null);
  const animCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const boardRef = useRef<CellState[][] | null>(null);
  const tankersBlownUpRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Keep refs in sync for animation loop access
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { tankersBlownUpRef.current = tankersBlownUp; }, [tankersBlownUp]);

  // Fetch leaderboard on mount and after score submission
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/scores");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

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

  // Generate static map background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cs = 28;
    const w = cols * cs;
    const h = rows * cs;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    drawMap(ctx, w, h);
    mapDataRef.current = canvas.toDataURL();
  }, [rows, cols]);

  // Animated overlay canvas — water shimmer, waves, ships
  useEffect(() => {
    const canvas = animCanvasRef.current;
    if (!canvas) return;
    const cs = 28;
    const w = cols * cs;
    const h = rows * cs;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    // Ship state: each ship travels along a shipping lane path
    type Ship = { progress: number; speed: number; lane: number; size: number; alive: boolean; explodeTimer: number; explodeX: number; explodeY: number; respawnTimer: number; };
    const ships: Ship[] = [
      { progress: 0, speed: 0.0004, lane: 0, size: 1.0, alive: true, explodeTimer: 0, explodeX: 0, explodeY: 0, respawnTimer: 0 },
      { progress: 0.35, speed: 0.0003, lane: 0, size: 0.8, alive: true, explodeTimer: 0, explodeX: 0, explodeY: 0, respawnTimer: 0 },
      { progress: 0.7, speed: 0.00035, lane: 0, size: 0.9, alive: true, explodeTimer: 0, explodeX: 0, explodeY: 0, respawnTimer: 0 },
      { progress: 0.1, speed: 0.00045, lane: 1, size: 1.0, alive: true, explodeTimer: 0, explodeX: 0, explodeY: 0, respawnTimer: 0 },
      { progress: 0.55, speed: 0.00032, lane: 1, size: 0.85, alive: true, explodeTimer: 0, explodeX: 0, explodeY: 0, respawnTimer: 0 },
      { progress: 0.85, speed: 0.0004, lane: 1, size: 0.75, alive: true, explodeTimer: 0, explodeX: 0, explodeY: 0, respawnTimer: 0 },
    ];

    // Shipping lane waypoints
    const lanes = [
      [[55.0, 26.2], [55.5, 26.15], [56.2, 26.15], [57.0, 25.95]],
      [[57.0, 25.85], [56.15, 26.05], [55.5, 26.0], [55.0, 26.05]],
    ];

    function getLanePos(lane: number[][], t: number): [number, number, number] {
      const segs = lane.length - 1;
      const seg = Math.min(Math.floor(t * segs), segs - 1);
      const localT = (t * segs) - seg;
      const x0 = lonToX(lane[seg][0], w), y0 = latToY(lane[seg][1], h);
      const x1 = lonToX(lane[seg + 1][0], w), y1 = latToY(lane[seg + 1][1], h);
      const x = x0 + (x1 - x0) * localT;
      const y = y0 + (y1 - y0) * localT;
      const angle = Math.atan2(y1 - y0, x1 - x0);
      return [x, y, angle];
    }

    function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const s = 6 * size;
      // Hull
      ctx.fillStyle = "rgba(80,80,80,0.8)";
      ctx.beginPath();
      ctx.moveTo(s * 1.5, 0);
      ctx.lineTo(s * 0.3, -s * 0.4);
      ctx.lineTo(-s * 1.2, -s * 0.35);
      ctx.lineTo(-s * 1.2, s * 0.35);
      ctx.lineTo(s * 0.3, s * 0.4);
      ctx.closePath();
      ctx.fill();
      // Bridge
      ctx.fillStyle = "rgba(200,200,200,0.7)";
      ctx.fillRect(-s * 0.6, -s * 0.2, s * 0.4, s * 0.4);
      // Wake
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-s * 1.2, -s * 0.1);
      ctx.lineTo(-s * 3, -s * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 1.2, s * 0.1);
      ctx.lineTo(-s * 3, s * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Missile state — Iran fires at oil tankers
    type Missile = {
      startX: number; startY: number;
      endX: number; endY: number;
      progress: number; speed: number;
      targetShipIdx: number; // index of ship being targeted
      willHit: boolean; // 5% chance
      trail: [number, number][];
      exploding: number; // 0 = flying, >0 = explosion timer
    };
    const missiles: Missile[] = [];
    let lastMissileTime = 0;

    // Iran launch points (north coast)
    const iranLaunchLons = [55.4, 55.7, 56.0, 56.3, 55.5, 55.9];

    function spawnMissile(t: number) {
      // Only fire from Iran, targeting a random alive ship
      const aliveShips = ships.map((s, i) => ({ s, i })).filter(x => x.s.alive);
      if (aliveShips.length === 0) return;

      const target = aliveShips[Math.floor(Math.random() * aliveShips.length)];
      const lon = iranLaunchLons[Math.floor(Math.random() * iranLaunchLons.length)];
      const startLat = 26.55 + Math.random() * 0.05;
      const willHit = Math.random() < 0.05; // 5% chance of hitting

      // Get target ship's current position for aiming
      const targetShip = target.s;
      const lane = lanes[targetShip.lane];
      const [tx, ty] = getLanePos(lane, targetShip.progress);

      // If not going to hit, add random offset to miss
      const missOffset = willHit ? 0 : (30 + Math.random() * 60) * (Math.random() > 0.5 ? 1 : -1);

      missiles.push({
        startX: lonToX(lon, w), startY: latToY(startLat, h),
        endX: tx + missOffset, endY: ty + (willHit ? 0 : missOffset * 0.5),
        progress: 0, speed: 0.008 + Math.random() * 0.006,
        targetShipIdx: target.i,
        willHit,
        trail: [], exploding: 0,
      });
    }

    let startTime = performance.now();

    function animate(now: number) {
      const t = (now - startTime) / 1000; // seconds
      ctx.clearRect(0, 0, w, h);

      // Water ripple/shimmer effect
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          // Check if this pixel is roughly water (not land)
          const lon = MAP_BOUNDS.minLon + (x / w) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
          const lat = MAP_BOUNDS.maxLat - (y / h) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
          if (isLandCell(lon, lat)) continue;

          const wave1 = Math.sin(x * 0.03 + t * 1.5) * Math.cos(y * 0.04 + t * 0.8);
          const wave2 = Math.sin(x * 0.05 - t * 1.2 + y * 0.02) * 0.5;
          const shimmer = (wave1 + wave2) * 0.5;
          const alpha = 0.02 + shimmer * 0.03;
          if (alpha > 0) {
            ctx.fillStyle = `rgba(180,220,255,${Math.abs(alpha)})`;
            ctx.fillRect(x, y, 8, 8);
          }
        }
      }

      // Animated wave lines
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const baseY = h * 0.3 + i * h * 0.08;
        for (let x = 0; x < w; x += 3) {
          const yOff = Math.sin(x * 0.015 + t * (0.8 + i * 0.15) + i * 2) * 4;
          if (x === 0) ctx.moveTo(x, baseY + yOff);
          else ctx.lineTo(x, baseY + yOff);
        }
        ctx.stroke();
      }

      // Draw ships with mine collision detection
      const cs = 28;
      for (const ship of ships) {
        // Handle explosion animation
        if (!ship.alive) {
          if (ship.explodeTimer > 0 && ship.explodeTimer < 1) {
            ship.explodeTimer += 0.015;
            const ex = ship.explodeX, ey = ship.explodeY;
            const r = ship.explodeTimer * 40;
            const alpha = 1 - ship.explodeTimer;
            // Big fireball for tanker
            const fireGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
            fireGrad.addColorStop(0, `rgba(255,255,200,${alpha * 0.9})`);
            fireGrad.addColorStop(0.2, `rgba(255,200,50,${alpha * 0.8})`);
            fireGrad.addColorStop(0.5, `rgba(255,100,20,${alpha * 0.6})`);
            fireGrad.addColorStop(1, `rgba(200,30,0,0)`);
            ctx.fillStyle = fireGrad;
            ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
            // Oil slick
            ctx.fillStyle = `rgba(30,20,10,${alpha * 0.4})`;
            ctx.beginPath(); ctx.ellipse(ex, ey + r*0.3, r*1.2, r*0.4, 0, 0, Math.PI * 2); ctx.fill();
            // Smoke
            for (let s = 0; s < 5; s++) {
              const smokeY = ey - r * 0.5 - s * 8 * ship.explodeTimer;
              const smokeR = 5 + s * 3;
              ctx.fillStyle = `rgba(60,60,60,${alpha * 0.3 * (1 - s * 0.15)})`;
              ctx.beginPath(); ctx.arc(ex + Math.sin(s + ship.explodeTimer * 5) * 8, smokeY, smokeR, 0, Math.PI * 2); ctx.fill();
            }
          } else {
            // Respawn after explosion
            ship.respawnTimer += 0.005;
            if (ship.respawnTimer > 1) {
              ship.alive = true;
              ship.progress = 0;
              ship.explodeTimer = 0;
              ship.respawnTimer = 0;
            }
          }
          continue;
        }

        ship.progress += ship.speed;
        if (ship.progress > 1) {
          ship.progress -= 1;
          // Tanker completed the strait — lower oil price
          window.dispatchEvent(new CustomEvent('tankerThrough'));
        }
        const lane = lanes[ship.lane];
        const [sx, sy, angle] = getLanePos(lane, ship.progress);

        // Check mine collision: convert ship pixel position to grid cell
        const currentBoard = boardRef.current;
        if (currentBoard) {
          const shipCol = Math.floor(sx / cs);
          const shipRow = Math.floor(sy / cs);
          if (shipRow >= 0 && shipRow < currentBoard.length && shipCol >= 0 && shipCol < currentBoard[0].length) {
            const cell = currentBoard[shipRow][shipCol];
            if (cell.mine && !cell.revealed) {
              // Tanker hit a mine! Blow up the mine and the tanker
              ship.alive = false;
              ship.explodeTimer = 0.01;
              ship.explodeX = sx;
              ship.explodeY = sy;
              ship.respawnTimer = 0;
              // Remove the mine from the board (good for player!)
              const newBoard = currentBoard.map(row => row.map(cl => ({ ...cl })));
              newBoard[shipRow][shipCol].mine = false;
              newBoard[shipRow][shipCol].revealed = true;
              // Recalculate adjacent counts around the removed mine
              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  const nr = shipRow + dr, nc = shipCol + dc;
                  if (nr >= 0 && nr < newBoard.length && nc >= 0 && nc < newBoard[0].length && !newBoard[nr][nc].isLand) {
                    let count = 0;
                    for (let ddr = -1; ddr <= 1; ddr++) {
                      for (let ddc = -1; ddc <= 1; ddc++) {
                        const nnr = nr + ddr, nnc = nc + ddc;
                        if (nnr >= 0 && nnr < newBoard.length && nnc >= 0 && nnc < newBoard[0].length && newBoard[nnr][nnc].mine) count++;
                      }
                    }
                    newBoard[nr][nc].adjacentMines = count;
                  }
                }
              }
              // Use a custom event to update React state from animation loop
              window.dispatchEvent(new CustomEvent('tankerMineHit', { detail: { board: newBoard } }));
            }
          }
        }

        drawShip(ctx, sx, sy, angle, ship.size);
      }

      // Spawn missiles periodically
      if (t - lastMissileTime > 1.5 + Math.random() * 2) {
        spawnMissile(t);
        lastMissileTime = t;
      }

      // Update and draw missiles
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];

        if (m.exploding > 0) {
          // Explosion animation
          m.exploding += 0.03;
          if (m.exploding > 1) {
            missiles.splice(i, 1);
            continue;
          }
          const ex = m.endX;
          const ey = m.endY;
          const r = m.exploding * 25;
          const alpha = 1 - m.exploding;

          // Fireball
          const fireGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
          fireGrad.addColorStop(0, `rgba(255,255,200,${alpha * 0.9})`);
          fireGrad.addColorStop(0.3, `rgba(255,160,50,${alpha * 0.7})`);
          fireGrad.addColorStop(0.6, `rgba(255,80,20,${alpha * 0.5})`);
          fireGrad.addColorStop(1, `rgba(200,30,0,0)`);
          ctx.fillStyle = fireGrad;
          ctx.beginPath();
          ctx.arc(ex, ey, r, 0, Math.PI * 2);
          ctx.fill();

          // Sparks
          for (let s = 0; s < 6; s++) {
            const ang = s * Math.PI / 3 + m.exploding * 4;
            const dist = r * (0.5 + m.exploding * 0.8);
            const sx = ex + Math.cos(ang) * dist;
            const sy = ey + Math.sin(ang) * dist;
            ctx.fillStyle = `rgba(255,200,50,${alpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        }

        // Update position
        m.progress += m.speed;
        const mx = m.startX + (m.endX - m.startX) * m.progress;
        // Add arc (missile goes up then down)
        const arc = -Math.sin(m.progress * Math.PI) * 40;
        const my = m.startY + (m.endY - m.startY) * m.progress + arc;

        // Add to trail
        m.trail.push([mx, my]);
        if (m.trail.length > 20) m.trail.shift();

        if (m.progress >= 1) {
          m.exploding = 0.01;
          // If this missile was going to hit, destroy the target ship
          if (m.willHit && ships[m.targetShipIdx] && ships[m.targetShipIdx].alive) {
            const targetShip = ships[m.targetShipIdx];
            targetShip.alive = false;
            targetShip.explodeTimer = 0.01;
            targetShip.explodeX = m.endX;
            targetShip.explodeY = m.endY;
            targetShip.respawnTimer = 0;
            // Dispatch event to update oil price +$10
            window.dispatchEvent(new CustomEvent('missileHitTanker'));
          }
          continue;
        }

        // Draw smoke trail
        ctx.strokeStyle = "rgba(200,200,200,0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        m.trail.forEach(([tx, ty], idx) => {
          if (idx === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        });
        ctx.stroke();

        // Draw flame trail
        if (m.trail.length > 2) {
          const trailGrad = ctx.createLinearGradient(
            m.trail[Math.max(0, m.trail.length - 8)][0],
            m.trail[Math.max(0, m.trail.length - 8)][1],
            mx, my
          );
          trailGrad.addColorStop(0, "rgba(255,100,20,0)");
          trailGrad.addColorStop(1, "rgba(255,180,50,0.5)");
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const start = Math.max(0, m.trail.length - 8);
          for (let j = start; j < m.trail.length; j++) {
            if (j === start) ctx.moveTo(m.trail[j][0], m.trail[j][1]);
            else ctx.lineTo(m.trail[j][0], m.trail[j][1]);
          }
          ctx.stroke();
        }

        // Draw missile body
        const angle = Math.atan2(
          m.endY - m.startY + Math.cos(m.progress * Math.PI) * 40 * Math.PI,
          m.endX - m.startX
        );
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(angle);
        // Body
        ctx.fillStyle = "rgba(180,180,180,0.9)";
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -2);
        ctx.lineTo(-4, 2);
        ctx.closePath();
        ctx.fill();
        // Nose glow
        ctx.fillStyle = "rgba(255,200,100,0.8)";
        ctx.beginPath();
        ctx.arc(5, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Fins
        ctx.fillStyle = "rgba(120,120,120,0.7)";
        ctx.beginPath();
        ctx.moveTo(-4, -2);
        ctx.lineTo(-7, -5);
        ctx.lineTo(-5, -2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-4, 2);
        ctx.lineTo(-7, 5);
        ctx.lineTo(-5, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Subtle light caustic effect on water
      const caustT = t * 0.3;
      for (let i = 0; i < 8; i++) {
        const cx = (w * 0.2 + Math.sin(caustT + i * 1.7) * w * 0.3 + w * 0.3 * (i / 8)) % w;
        const cy = (h * 0.3 + Math.cos(caustT * 0.7 + i * 2.1) * h * 0.2) % h;
        const lon = MAP_BOUNDS.minLon + (cx / w) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
        const lat = MAP_BOUNDS.maxLat - (cy / h) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
        if (!isLandCell(lon, lat)) {
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20 + Math.sin(t + i) * 10);
          grad.addColorStop(0, "rgba(180,230,255,0.06)");
          grad.addColorStop(1, "rgba(180,230,255,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(cx - 30, cy - 30, 60, 60);
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [rows, cols]);

  // Show name input when game ends
  useEffect(() => {
    if ((status === "won" || status === "lost") && !scoreSubmitted) {
      setShowNameInput(true);
    }
  }, [status, scoreSubmitted]);

  // Submit score
  const submitScore = useCallback(async () => {
    if (!playerName.trim() || submittingScore) return;
    setSubmittingScore(true);
    try {
      // Count mines cleared (revealed non-mine water cells don't count, we want mines that were flagged or removed by tankers)
      let minesCleared = 0;
      if (board) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (!board[r][c].isLand && board[r][c].revealed && !board[r][c].mine) {
              // This was a cleared cell
            }
            if (!board[r][c].isLand && board[r][c].flagged && board[r][c].mine) {
              minesCleared++;
            }
          }
        }
      }
      // Add tankers blown up mines
      minesCleared += tankersBlownUp;

      await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName.trim(),
          time_seconds: time,
          mines_cleared: minesCleared,
          total_mines: actualMines,
          difficulty,
          won: status === "won",
          oil_price: oilPrice,
          tankers_blown_up: tankersBlownUp,
        }),
      });
      setScoreSubmitted(true);
      setShowNameInput(false);
      fetchLeaderboard();
    } catch {}
    setSubmittingScore(false);
  }, [playerName, submittingScore, board, rows, cols, time, actualMines, difficulty, status, oilPrice, tankersBlownUp, fetchLeaderboard]);

  // Show event popup helper
  const showEventPopup = useCallback((title: string, message: string, icon: string) => {
    setEventPopup({ title, message, icon });
  }, []);

  // Listen for tanker-mine collision events from animation loop
  useEffect(() => {
    const mineHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setBoard(detail.board);
      setTankersBlownUp(prev => prev + 1);
      setOilPrice(prev => Math.min(prev + 10, 200));
      // No popup for auto tanker-mine hits (too frequent) — just visual explosion on canvas
    };
    const missileHandler = () => {
      setTankersBlownUp(prev => prev + 1);
      setOilPrice(prev => Math.min(prev + 10, 200));
      showEventPopup("MISSILE STRIKE!", "Iran fired an anti-ship missile and hit an oil tanker! Oil surges +$10/bbl!", "🚀");
    };
    const tankerThroughHandler = () => {
      setOilPrice(prev => Math.max(prev - 10, 50));
      // No popup for deliveries — too frequent. Just a quiet price drop.
    };
    window.addEventListener('tankerMineHit', mineHandler);
    window.addEventListener('missileHitTanker', missileHandler);
    window.addEventListener('tankerThrough', tankerThroughHandler);
    return () => {
      window.removeEventListener('tankerMineHit', mineHandler);
      window.removeEventListener('missileHitTanker', missileHandler);
      window.removeEventListener('tankerThrough', tankerThroughHandler);
    };
  }, [showEventPopup]);

  // Timer
  useEffect(() => {
    if (status === "playing") {
      timerRef.current = setInterval(() => setTime(t => Math.min(t + 1, 999)), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // Oil price rises $1 every 5 seconds while playing — lose at $200
  useEffect(() => {
    if (status === "playing") {
      oilTimerRef.current = setInterval(() => {
        setOilPrice(p => {
          const next = p + 1;
          if (next >= 200) {
            setStatus("lost");
            // Reveal all mines
            setBoard(prev => prev ? prev.map(row => row.map(cl => ({
              ...cl,
              revealed: cl.mine ? true : cl.revealed,
            }))) : null);
          }
          return Math.min(next, 200);
        });
      }, 5000);
    } else {
      if (oilTimerRef.current) clearInterval(oilTimerRef.current);
    }
    return () => { if (oilTimerRef.current) clearInterval(oilTimerRef.current); };
  }, [status]);

  const resetGame = useCallback(() => {
    setBoard(null);
    setStatus("idle");
    setFlagCount(0);
    setTime(0);
    setOilPrice(50);
    setExplosions([]);
    setTankersBlownUp(0);
    setShowNameInput(false);
    setScoreSubmitted(false);
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
      // Mine explodes but game continues — just that mine is destroyed, oil +$10
      const newBoard = board.map(row => row.map(cl => ({ ...cl })));
      newBoard[r][c] = { ...newBoard[r][c], mine: false, revealed: true };
      // Recalculate adjacents around the destroyed mine
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !newBoard[nr][nc].isLand) {
            let count = 0;
            for (let ddr = -1; ddr <= 1; ddr++) {
              for (let ddc = -1; ddc <= 1; ddc++) {
                const nnr = nr + ddr, nnc = nc + ddc;
                if (nnr >= 0 && nnr < rows && nnc >= 0 && nnc < cols && newBoard[nnr][nnc].mine) count++;
              }
            }
            newBoard[nr][nc].adjacentMines = count;
          }
        }
      }
      setBoard(newBoard);
      // Single mine explosion animation
      setExplosions([{ r, c, startTime: Date.now() }]);
      // Oil price jumps +$10
      setOilPrice(prev => {
        const next = Math.min(prev + 10, 200);
        if (next >= 200) {
          setStatus("lost");
        }
        return next;
      });
      // Show popup
      setEventPopup({ title: "MINE DETONATED!", message: "You hit a sea mine! It has been destroyed but oil prices surge +$10/bbl!", icon: "💣" });
      // Check win (mine was removed, so fewer mines to avoid now)
      if (checkWin(newBoard, rows, cols, actualMines)) setStatus("won");
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
    const hitMines: [number, number][] = [];

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbor = newBoard[nr][nc];
          if (!neighbor.revealed && !neighbor.flagged && !neighbor.isLand) {
            if (neighbor.mine) {
              hitMines.push([nr, nc]);
              // Mine explodes but doesn't end game — destroy it
              newBoard[nr][nc].mine = false;
              newBoard[nr][nc].revealed = true;
            } else {
              newBoard = reveal(newBoard, nr, nc, rows, cols);
            }
          }
        }
      }
    }

    if (hitMines.length > 0) {
      // Recalculate adjacents for affected areas
      for (const [mr, mc] of hitMines) {
        for (let dr2 = -1; dr2 <= 1; dr2++) {
          for (let dc2 = -1; dc2 <= 1; dc2++) {
            const nr2 = mr + dr2, nc2 = mc + dc2;
            if (nr2 >= 0 && nr2 < rows && nc2 >= 0 && nc2 < cols && !newBoard[nr2][nc2].isLand) {
              let cnt = 0;
              for (let ddr = -1; ddr <= 1; ddr++) {
                for (let ddc = -1; ddc <= 1; ddc++) {
                  const nnr = nr2 + ddr, nnc = nc2 + ddc;
                  if (nnr >= 0 && nnr < rows && nnc >= 0 && nnc < cols && newBoard[nnr][nnc].mine) cnt++;
                }
              }
              newBoard[nr2][nc2].adjacentMines = cnt;
            }
          }
        }
      }
      setExplosions(hitMines.map(([mr, mc]) => ({ r: mr, c: mc, startTime: Date.now() })));
      setOilPrice(prev => {
        const next = Math.min(prev + hitMines.length * 10, 200);
        if (next >= 200) setStatus("lost");
        return next;
      });
      setEventPopup({ title: "MINES DETONATED!", message: `${hitMines.length} mine${hitMines.length > 1 ? "s" : ""} exploded! Oil surges +$${hitMines.length * 10}/bbl!`, icon: "💣" });
      setBoard(newBoard);
      if (checkWin(newBoard, rows, cols, actualMines)) setStatus("won");
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
    setOilPrice(50);
    setExplosions([]);
    setTankersBlownUp(0);
    setShowNameInput(false);
    setScoreSubmitted(false);
  };

  // Mobile touch: long press to flag/unflag
  const handleTouchStart = useCallback((r: number, c: number) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      // Toggle flag (same as right-click)
      if (status === "won" || status === "lost") return;
      if (!board) return;
      if (landMask[r][c]) return;
      const cell = board[r][c];
      if (cell.revealed) return;
      const newBoard = board.map(row => row.map(cl => ({ ...cl })));
      newBoard[r][c].flagged = !cell.flagged;
      setBoard(newBoard);
      setFlagCount(f => cell.flagged ? f - 1 : f + 1);
    }, 400);
  }, [board, status, landMask]);

  const handleTouchEnd = useCallback((r: number, c: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!longPressTriggeredRef.current) {
      // Short tap = reveal
      handleCellClick(r, c);
    }
  }, [handleCellClick]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const cellSize = isMobile ? Math.floor((typeof window !== 'undefined' ? Math.min(window.innerWidth - 20, 400) : 400) / cols) : 28;
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
      <h1 style={{ color: "#e0d5b0", fontFamily: "serif", fontSize: isMobile ? "16px" : "22px", marginBottom: "4px", textShadow: "2px 2px 4px rgba(0,0,0,0.5)", letterSpacing: "2px", textAlign: "center" }}>
        ⚓ MINESWEEPER: STRAIT OF HORMUZ ⚓
      </h1>
      <div style={{
        color: oilPrice > 150 ? "#ff2222" : oilPrice > 100 ? "#ff6622" : "#ff4444",
        fontFamily: "'Courier New', monospace",
        fontSize: isMobile ? "11px" : "20px",
        fontWeight: "bold",
        marginBottom: "6px",
        padding: isMobile ? "4px 10px" : "6px 20px",
        background: "rgba(255,0,0,0.08)",
        border: `2px solid ${oilPrice > 150 ? "#ff2222" : oilPrice > 100 ? "#ff6622" : "#ff444466"}`,
        borderRadius: "6px",
        textShadow: "0 0 12px rgba(255,50,0,0.6), 0 0 24px rgba(255,0,0,0.3)",
        animation: oilPrice > 150 ? "pulse 0.5s infinite" : oilPrice > 100 ? "pulse 1s infinite" : "none",
        letterSpacing: "2px",
      }}>
        ⚠️ CLEAR THE STRAIT BEFORE THE WORLD ECONOMY COLLAPSES!!! ⚠️
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } } @keyframes explode { 0% { transform: scale(1); opacity: 1; } 30% { transform: scale(1.8); background: rgba(255,200,50,0.9); } 60% { transform: scale(2.5); background: rgba(255,80,0,0.7); } 100% { transform: scale(3); opacity: 0; } }`}</style>

      {/* Oil Price Meter */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "6px",
        padding: "4px 16px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: "4px",
        border: `1px solid ${oilPrice > 150 ? "#ff4444" : oilPrice > 100 ? "#ff8844" : "#446688"}`,
      }}>
        <span style={{ color: "#aabbcc", fontSize: "12px", fontFamily: "monospace" }}>🛢️ OIL</span>
        <div style={{
          width: "200px",
          height: "14px",
          background: "#1a1a2e",
          borderRadius: "3px",
          overflow: "hidden",
          border: "1px solid #333",
        }}>
          <div style={{
            width: `${((oilPrice - 50) / 150) * 100}%`,
            height: "100%",
            background: oilPrice > 150 ? "#ff3333" : oilPrice > 100 ? `linear-gradient(90deg, #ff8800, #ff4400)` : `linear-gradient(90deg, #44aa44, #aaaa00)`,
            transition: "width 0.5s ease, background 0.5s ease",
            borderRadius: "2px",
          }} />
        </div>
        <span style={{
          color: oilPrice > 150 ? "#ff4444" : oilPrice > 100 ? "#ffaa44" : "#44cc44",
          fontSize: "16px",
          fontWeight: "bold",
          fontFamily: "'Courier New', monospace",
          minWidth: "80px",
          textAlign: "right",
        }}>
          ${oilPrice}/bbl
        </span>
        {oilPrice >= 200 && <span style={{ color: "#ff4444", fontSize: "12px" }}>💥 CRASHED!</span>}
      </div>

      {/* Difficulty hidden — expert only */}

      {/* Game area with side ads */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "center" : "flex-start", gap: isMobile ? "8px" : "16px" }}>

      {/* Left side ad (hidden on mobile) */}
      {!isMobile && (
      <div style={{ width: "160px", minHeight: "600px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
        <AdBanner slot="1111111111" style={{ width: 160, minHeight: 600 }} />
      </div>
      )}

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
          {/* Map background (static) */}
          {mapDataRef.current && (
            <img
              src={mapDataRef.current}
              alt=""
              style={{ position: "absolute", top: 0, left: 0, width: gridW, height: gridH, opacity: 0.6, pointerEvents: "none" }}
            />
          )}
          {/* Animated water overlay */}
          <canvas
            ref={animCanvasRef}
            style={{ position: "absolute", top: 0, left: 0, width: gridW, height: gridH, pointerEvents: "none", zIndex: 1 }}
          />

          {/* Cells */}
          <div style={{ position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`, gridTemplateRows: `repeat(${rows}, ${cellSize}px)` }}>
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const cell = board ? board[r][c] : null;
                const isLand = landMask[r][c];
                const isRevealed = cell?.revealed ?? false;
                const isFlagged = cell?.flagged ?? false;
                const isMine = cell?.mine ?? false;
                const adj = cell?.adjacentMines ?? 0;
                const isExploded = isRevealed && isMine && status === "lost";
                const explosion = explosions.find(e => e.r === r && e.c === c);
                const isExploding = explosion && Date.now() >= explosion.startTime;

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
                    onTouchStart={(e) => { e.preventDefault(); handleTouchStart(r, c); }}
                    onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd(r, c); }}
                    onTouchCancel={handleTouchCancel}
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
                    {isExploding && isExploded && (
                      <div style={{
                        position: "absolute",
                        width: cellSize * 3,
                        height: cellSize * 3,
                        borderRadius: "50%",
                        animation: "explode 0.8s ease-out forwards",
                        background: "radial-gradient(circle, rgba(255,255,200,0.9) 0%, rgba(255,120,0,0.8) 40%, rgba(255,50,0,0.4) 70%, transparent 100%)",
                        pointerEvents: "none",
                        zIndex: 10,
                      }} />
                    )}
                    {isRevealed && isMine && (isExploding ? "💥" : "💣")}
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
              ? "🎖️ STRAIT SECURED — ALL MINES CLEARED! OIL MARKETS STABILIZED!"
              : "📉 OIL HIT $200/BBL — GLOBAL ECONOMY COLLAPSED!"}
            {tankersBlownUp > 0 && (
              <div style={{ fontSize: "13px", marginTop: "4px", color: "#ffaa44" }}>
                🚢 {tankersBlownUp} tanker{tankersBlownUp > 1 ? "s" : ""} destroyed by mines
              </div>
            )}
          </div>
        )}

        {/* Tankers blown up counter (during play) */}
        {status === "playing" && tankersBlownUp > 0 && (
          <div style={{ textAlign: "center", padding: "4px", marginTop: "4px", color: "#ffaa44", fontSize: "12px", fontFamily: "monospace" }}>
            🚢 Tankers lost: {tankersBlownUp} (+${tankersBlownUp * 10}/bbl)
          </div>
        )}
      </div>

      {/* Right side: Leaderboard & Loserboard */}
      <div style={{ width: isMobile ? "100%" : "220px", maxWidth: isMobile ? gridW : "220px", minHeight: isMobile ? "auto" : "600px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Leaderboard */}
        <div style={{
          background: "rgba(0,40,20,0.6)",
          border: "1px solid #2a5a3a",
          borderRadius: "6px",
          padding: "8px",
          maxHeight: "290px",
          overflow: "auto",
        }}>
          <div style={{ color: "#4ade80", fontWeight: "bold", fontSize: "13px", textAlign: "center", marginBottom: "6px", fontFamily: "monospace", letterSpacing: "1px" }}>
            🏆 LEADERBOARD
          </div>
          {leaderboard.winners.length === 0 ? (
            <div style={{ color: "#556", fontSize: "11px", textAlign: "center", padding: "10px" }}>No winners yet — be the first!</div>
          ) : (
            <table style={{ width: "100%", fontSize: "10px", fontFamily: "monospace", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#6a9" }}>
                  <th style={{ textAlign: "left", padding: "2px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "2px" }}>Name</th>
                  <th style={{ textAlign: "right", padding: "2px" }}>Time</th>
                  <th style={{ textAlign: "right", padding: "2px" }}>Oil$</th>
                  <th style={{ textAlign: "center", padding: "2px" }}>🚢</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.winners.map((s: any, i: number) => (
                  <tr key={i} style={{ color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "#8a9" }}>
                    <td style={{ padding: "1px 2px" }}>{i + 1}</td>
                    <td style={{ padding: "1px 2px", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name} <span style={{ fontSize: "8px", color: "#556" }}>{s.country}</span>
                    </td>
                    <td style={{ textAlign: "right", padding: "1px 2px" }}>{s.time_seconds}s</td>
                    <td style={{ textAlign: "right", padding: "1px 2px" }}>${s.oil_price}</td>
                    <td style={{ textAlign: "center", padding: "1px 2px" }}>{s.tankers_blown_up || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Loserboard */}
        <div style={{
          background: "rgba(40,0,0,0.6)",
          border: "1px solid #5a2a2a",
          borderRadius: "6px",
          padding: "8px",
          maxHeight: "290px",
          overflow: "auto",
        }}>
          <div style={{ color: "#f87171", fontWeight: "bold", fontSize: "13px", textAlign: "center", marginBottom: "6px", fontFamily: "monospace", letterSpacing: "1px" }}>
            💀 LOSERBOARD
          </div>
          {leaderboard.losers.length === 0 ? (
            <div style={{ color: "#556", fontSize: "11px", textAlign: "center", padding: "10px" }}>No losers yet — don&apos;t be the first!</div>
          ) : (
            <table style={{ width: "100%", fontSize: "10px", fontFamily: "monospace", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#a66" }}>
                  <th style={{ textAlign: "left", padding: "2px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "2px" }}>Name</th>
                  <th style={{ textAlign: "right", padding: "2px" }}>Time</th>
                  <th style={{ textAlign: "right", padding: "2px" }}>Oil$</th>
                  <th style={{ textAlign: "center", padding: "2px" }}>🚢</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.losers.map((s: any, i: number) => (
                  <tr key={i} style={{ color: "#a88" }}>
                    <td style={{ padding: "1px 2px" }}>{i + 1}</td>
                    <td style={{ padding: "1px 2px", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name} <span style={{ fontSize: "8px", color: "#556" }}>{s.country}</span>
                    </td>
                    <td style={{ textAlign: "right", padding: "1px 2px" }}>{s.time_seconds}s</td>
                    <td style={{ textAlign: "right", padding: "1px 2px", color: s.oil_price >= 200 ? "#ff4444" : "#a88" }}>${s.oil_price}</td>
                    <td style={{ textAlign: "center", padding: "1px 2px" }}>{s.tankers_blown_up || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Ad below leaderboard */}
        <AdBanner slot="2222222222" style={{ width: 220, minHeight: 250 }} />
      </div>

      </div>{/* end flex wrapper */}

      {/* Event popup */}
      {eventPopup && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          cursor: "pointer",
        }}
          onClick={() => setEventPopup(null)}
        >
          <div style={{
            background: "linear-gradient(135deg, #1a2a3a 0%, #0a1628 100%)",
            border: "2px solid #ff884488",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 0 40px rgba(255,100,0,0.3)",
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "48px", marginBottom: "8px" }}>{eventPopup.icon}</div>
            <div style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "#ff8844",
              marginBottom: "8px",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "2px",
              textShadow: "0 0 10px rgba(255,100,0,0.5)",
            }}>
              {eventPopup.title}
            </div>
            <div style={{ color: "#aabbcc", fontSize: "14px", marginBottom: "16px", lineHeight: "1.5" }}>
              {eventPopup.message}
            </div>
            {/* Ad spot in the popup */}
            <div style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px dashed #33445566",
              borderRadius: "6px",
              padding: "8px",
              marginBottom: "12px",
              minHeight: "90px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <AdBanner slot="3333333333" style={{ width: "100%", minHeight: 90 }} />
            </div>
            <button
              onClick={() => setEventPopup(null)}
              style={{
                padding: "8px 24px",
                background: "#2a4a6a",
                color: "#fff",
                border: "1px solid #4a6a8a",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      {/* Name input modal */}
      {showNameInput && !scoreSubmitted && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#1a2a3a",
            border: `2px solid ${status === "won" ? "#4ade80" : "#f87171"}`,
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
            maxWidth: "360px",
            width: "90%",
          }}>
            <div style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: status === "won" ? "#4ade80" : "#f87171",
              marginBottom: "8px",
              fontFamily: "serif",
            }}>
              {status === "won" ? "🎖️ VICTORY!" : "💥 GAME OVER!"}
            </div>
            <div style={{ color: "#aabbcc", fontSize: "13px", marginBottom: "4px", fontFamily: "monospace" }}>
              Time: {time}s | Oil: ${oilPrice}/bbl
              {tankersBlownUp > 0 && ` | Tankers: ${tankersBlownUp}`}
            </div>
            <div style={{ color: "#8899aa", fontSize: "14px", marginBottom: "16px" }}>
              Enter your name for the {status === "won" ? "leaderboard" : "loserboard"}:
            </div>
            <input
              type="text"
              maxLength={20}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitScore()}
              placeholder="Your name..."
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "16px",
                background: "#0a1628",
                border: "1px solid #446688",
                borderRadius: "6px",
                color: "#fff",
                textAlign: "center",
                marginBottom: "12px",
                outline: "none",
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                onClick={submitScore}
                disabled={submittingScore || !playerName.trim()}
                style={{
                  padding: "8px 20px",
                  background: submittingScore ? "#333" : status === "won" ? "#2a7a4a" : "#7a2a2a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: submittingScore ? "wait" : "pointer",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                {submittingScore ? "Submitting..." : "Submit Score"}
              </button>
              <button
                onClick={() => setShowNameInput(false)}
                style={{
                  padding: "8px 20px",
                  background: "#333",
                  color: "#888",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ color: "#8899aa", fontSize: "12px", marginTop: "8px", textAlign: "center", fontFamily: "monospace" }}>
        Left click: Reveal  •  Right click: Flag  •  Double click number: Chord
      </div>
      <div style={{ color: "#667788", fontSize: "11px", marginTop: "4px", fontFamily: "monospace" }}>
        Mines are only in the water — land is safe! Oil tankers that hit mines will clear them (+$10/bbl)
      </div>

      {/* Share buttons */}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <a
          href="https://www.facebook.com/sharer/sharer.php?u=https://hormuzstraitsweeper.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "6px 14px", background: "#1877f2", color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
        >
          📘 Share on Facebook
        </a>
        <a
          href="fb-messenger://share/?link=https://hormuzstraitsweeper.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "6px 14px", background: "#0084ff", color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
        >
          💬 Messenger
        </a>
        <a
          href="https://api.whatsapp.com/send?text=Can%20you%20clear%20the%20Strait%20of%20Hormuz%20before%20oil%20hits%20%24200%2Fbbl%3F%20Play%20now%3A%20https%3A%2F%2Fhormuzstraitsweeper.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "6px 14px", background: "#25d366", color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
        >
          📱 WhatsApp
        </a>
        <a
          href="https://twitter.com/intent/tweet?text=Can%20you%20clear%20the%20Strait%20of%20Hormuz%20before%20oil%20hits%20%24200%2Fbbl%3F&url=https%3A%2F%2Fhormuzstraitsweeper.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "6px 14px", background: "#1da1f2", color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
        >
          🐦 Tweet
        </a>
        <button
          onClick={() => {
            navigator.clipboard?.writeText("https://hormuzstraitsweeper.com");
          }}
          style={{ padding: "6px 14px", background: "#444", color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
        >
          🔗 Copy Link
        </button>
      </div>

      {/* Mobile instructions */}
      {isMobile && (
        <div style={{ color: "#667788", fontSize: "11px", marginTop: "6px", fontFamily: "monospace", textAlign: "center" }}>
          Tap: Reveal | Long press: Flag/Unflag
        </div>
      )}

      {/* Bottom Ad */}
      <AdBanner slot="0987654321" style={{ marginTop: "16px", maxWidth: gridW }} />

      {/* Credit */}
      <div style={{ color: "#556677", fontSize: "12px", marginTop: "16px", fontFamily: "serif", letterSpacing: "1px" }}>
        Made by Thomas Perkins
      </div>
    </div>
  );
}
