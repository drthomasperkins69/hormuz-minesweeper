"use client";
import { useState, useCallback, useEffect, useRef } from "react";

// --- Types ---
type CellState = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
};

type GameStatus = "idle" | "playing" | "won" | "lost";
type Difficulty = "beginner" | "intermediate" | "expert";

const DIFFICULTIES: Record<Difficulty, { rows: number; cols: number; mines: number }> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

// --- Geographic map using real coordinates ---
// Bounding box: approx 54.5°E to 57.5°E, 25.5°N to 27.5°N (Strait of Hormuz region)
const MAP_BOUNDS = { minLon: 54.0, maxLon: 57.5, minLat: 25.2, maxLat: 27.6 };

function lonToX(lon: number, w: number) {
  return ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * w;
}
function latToY(lat: number, h: number) {
  // Flip Y: higher lat = lower Y
  return ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * h;
}

function drawCoastline(
  ctx: CanvasRenderingContext2D,
  coords: [number, number][], // [lon, lat]
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
  // Ocean gradient
  const oceanGrad = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.8);
  oceanGrad.addColorStop(0, "#5ba8d0");
  oceanGrad.addColorStop(0.4, "#4a96bf");
  oceanGrad.addColorStop(1, "#3a7aa0");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  // Shallow water near coasts
  ctx.fillStyle = "rgba(100,190,220,0.15)";
  ctx.fillRect(0, 0, w, h);

  const landColor = "#c8b87c";
  const landDark = "#a89860";
  ctx.strokeStyle = landDark;
  ctx.lineWidth = 1.5;

  // --- IRAN coastline (detailed, runs along the north) ---
  // From west (Persian Gulf side) curving east through the Strait and into Gulf of Oman
  const iranCoast: [number, number][] = [
    [54.0, 27.6],   // top-left corner
    [54.0, 27.05],  // west coast start
    [54.05, 27.0],
    [54.1, 26.95],
    [54.15, 26.92],
    [54.2, 26.88],
    [54.25, 26.85],
    [54.3, 26.83],
    [54.35, 26.82],
    [54.4, 26.80],
    [54.45, 26.78],
    [54.5, 26.77],  // Bandar Lengeh area
    [54.55, 26.76],
    [54.6, 26.74],
    [54.65, 26.72],
    [54.7, 26.70],
    [54.75, 26.68],
    [54.8, 26.66],
    [54.85, 26.64],
    [54.9, 26.62],
    [54.95, 26.60],
    [55.0, 26.58],  // approaching Qeshm
    [55.05, 26.57],
    [55.1, 26.56],
    [55.15, 26.56],
    [55.2, 26.57],  // indent above Qeshm (Clarence Strait)
    [55.25, 26.58],
    [55.3, 26.60],
    [55.35, 26.62],
    [55.4, 26.63],
    [55.45, 26.64],
    [55.5, 26.65],
    [55.55, 26.65],
    [55.6, 26.64],  // Bandar Abbas area
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
    [56.2, 26.47],  // narrowest part of strait
    [56.25, 26.43],
    [56.3, 26.38],
    [56.35, 26.35],
    [56.4, 26.32],
    [56.45, 26.30],
    [56.5, 26.28],
    [56.55, 26.26],
    [56.6, 26.24],
    [56.65, 26.22],
    [56.7, 26.20],  // Jask direction
    [56.8, 26.18],
    [56.9, 26.15],
    [57.0, 26.12],
    [57.1, 26.10],
    [57.2, 26.08],
    [57.3, 26.06],
    [57.4, 26.05],
    [57.5, 26.04],  // east edge
    [57.5, 27.6],   // top-right corner
  ];

  // Add terrain texture to Iran
  ctx.fillStyle = landColor;
  drawCoastline(ctx, iranCoast, w, h);

  // Terrain detail on Iran
  const iranGrad = ctx.createLinearGradient(0, 0, w * 0.5, h * 0.3);
  iranGrad.addColorStop(0, "rgba(180,160,120,0.4)");
  iranGrad.addColorStop(1, "rgba(200,184,124,0.1)");
  ctx.fillStyle = iranGrad;
  drawCoastline(ctx, iranCoast, w, h);

  // --- UAE / Oman coastline (south side) ---
  const arabCoast: [number, number][] = [
    [54.0, 25.2],   // bottom-left corner
    [54.0, 25.5],   // UAE coast start
    [54.1, 25.55],
    [54.2, 25.6],
    [54.3, 25.65],
    [54.4, 25.7],
    [54.5, 25.73],
    [54.6, 25.75],
    [54.7, 25.78],
    [54.8, 25.82],
    [54.9, 25.85],
    [55.0, 25.88],
    [55.1, 25.90],
    [55.2, 25.93],
    [55.3, 25.95],
    [55.4, 25.97],
    [55.5, 25.98],
    [55.6, 26.00],  // Ras al-Khaimah area
    [55.7, 26.02],
    [55.75, 26.04],
    [55.8, 26.06],
    [55.85, 26.08],
    [55.9, 26.10],
    [55.95, 26.12],
    [56.0, 26.14],
    [56.05, 26.18],  // Musandam peninsula tip
    [56.1, 26.22],
    [56.15, 26.26],
    [56.18, 26.28],  // Musandam tip (northernmost)
    [56.2, 26.30],
    [56.25, 26.32],
    [56.28, 26.30],  // east side of Musandam
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
    [56.7, 25.78],
    [56.8, 25.74],
    [56.9, 25.70],
    [57.0, 25.66],
    [57.1, 25.62],
    [57.2, 25.58],
    [57.3, 25.52],
    [57.4, 25.46],
    [57.5, 25.40],  // east edge
    [57.5, 25.2],   // bottom-right corner
  ];

  ctx.fillStyle = landColor;
  drawCoastline(ctx, arabCoast, w, h);

  const arabGrad = ctx.createLinearGradient(w * 0.3, h, w * 0.8, h * 0.5);
  arabGrad.addColorStop(0, "rgba(180,160,120,0.4)");
  arabGrad.addColorStop(1, "rgba(200,184,124,0.1)");
  ctx.fillStyle = arabGrad;
  drawCoastline(ctx, arabCoast, w, h);

  // --- Qeshm Island (largest island in the strait) ---
  const qeshm: [number, number][] = [
    [55.3, 26.52],
    [55.4, 26.50],
    [55.5, 26.48],
    [55.6, 26.46],
    [55.7, 26.44],
    [55.8, 26.42],
    [55.9, 26.40],
    [56.0, 26.38],
    [56.05, 26.37],
    [56.1, 26.36],
    [56.15, 26.36],
    [56.2, 26.37],  // east tip
    [56.22, 26.38],
    [56.2, 26.40],
    [56.15, 26.42],
    [56.1, 26.43],
    [56.05, 26.44],
    [56.0, 26.45],
    [55.9, 26.46],
    [55.8, 26.48],
    [55.7, 26.50],
    [55.6, 26.52],
    [55.5, 26.53],
    [55.4, 26.54],
    [55.35, 26.54],
  ];

  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, qeshm, w, h);

  // --- Hormuz Island ---
  const hormuz: [number, number][] = [
    [56.44, 26.44],
    [56.48, 26.42],
    [56.50, 26.44],
    [56.48, 26.47],
    [56.44, 26.47],
    [56.42, 26.45],
  ];
  ctx.fillStyle = "#d4a574"; // reddish soil (Hormuz is known for red earth)
  drawCoastline(ctx, hormuz, w, h);

  // --- Larak Island ---
  const larak: [number, number][] = [
    [56.32, 26.50],
    [56.36, 26.49],
    [56.38, 26.51],
    [56.36, 26.53],
    [56.32, 26.53],
    [56.30, 26.51],
  ];
  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, larak, w, h);

  // --- Hengam Island ---
  const hengam: [number, number][] = [
    [55.88, 26.35],
    [55.92, 26.34],
    [55.93, 26.36],
    [55.90, 26.38],
    [55.87, 26.37],
  ];
  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, hengam, w, h);

  // --- Abu Musa Island ---
  const abuMusa: [number, number][] = [
    [55.00, 25.86],
    [55.04, 25.85],
    [55.05, 25.87],
    [55.03, 25.89],
    [54.99, 25.88],
  ];
  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, abuMusa, w, h);

  // --- Greater Tunb ---
  const greaterTunb: [number, number][] = [
    [55.28, 26.24],
    [55.32, 26.23],
    [55.33, 26.25],
    [55.30, 26.27],
    [55.27, 26.26],
  ];
  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, greaterTunb, w, h);

  // --- Lesser Tunb ---
  const lesserTunb: [number, number][] = [
    [55.12, 26.14],
    [55.15, 26.13],
    [55.16, 26.15],
    [55.14, 26.16],
    [55.11, 26.15],
  ];
  ctx.fillStyle = "#bfae72";
  drawCoastline(ctx, lesserTunb, w, h);

  // --- Shipping lanes (dashed lines through the strait) ---
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;

  // Inbound lane
  ctx.beginPath();
  ctx.moveTo(lonToX(54.5, w), latToY(26.2, h));
  ctx.lineTo(lonToX(55.5, w), latToY(26.15, h));
  ctx.lineTo(lonToX(56.2, w), latToY(26.15, h));
  ctx.lineTo(lonToX(57.0, w), latToY(25.95, h));
  ctx.stroke();

  // Outbound lane
  ctx.beginPath();
  ctx.moveTo(lonToX(54.5, w), latToY(26.05, h));
  ctx.lineTo(lonToX(55.5, w), latToY(26.0, h));
  ctx.lineTo(lonToX(56.15, w), latToY(26.05, h));
  ctx.lineTo(lonToX(57.0, w), latToY(25.85, h));
  ctx.stroke();

  ctx.setLineDash([]);

  // --- Labels ---
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;

  // Country names
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(12, Math.floor(w * 0.018))}px 'Georgia', serif`;
  ctx.fillText("I R A N", lonToX(54.8, w), latToY(27.1, h));

  ctx.font = `bold ${Math.max(11, Math.floor(w * 0.015))}px 'Georgia', serif`;
  ctx.fillText("U.A.E.", lonToX(54.5, w), latToY(25.55, h));
  ctx.fillText("OMAN", lonToX(56.6, w), latToY(25.5, h));

  // Water body names
  ctx.font = `italic ${Math.max(10, Math.floor(w * 0.014))}px 'Georgia', serif`;
  ctx.fillStyle = "#c8e0f0";
  ctx.fillText("Persian Gulf", lonToX(54.2, w), latToY(26.3, h));
  ctx.fillText("Gulf of Oman", lonToX(56.7, w), latToY(26.0, h));

  ctx.font = `italic bold ${Math.max(9, Math.floor(w * 0.013))}px 'Georgia', serif`;
  ctx.fillStyle = "#a8d0e8";
  ctx.fillText("Strait of Hormuz", lonToX(55.6, w), latToY(26.2, h));

  // Island names
  ctx.font = `${Math.max(8, Math.floor(w * 0.01))}px 'Georgia', serif`;
  ctx.fillStyle = "#e8d8a0";
  ctx.fillText("Qeshm", lonToX(55.65, w), latToY(26.50, h));
  ctx.fillText("Hormuz", lonToX(56.35, w), latToY(26.40, h));
  ctx.fillText("Larak", lonToX(56.22, w), latToY(26.54, h));
  ctx.fillText("Hengam", lonToX(55.82, w), latToY(26.33, h));

  // City markers
  ctx.shadowBlur = 0;
  const citySize = Math.max(3, Math.floor(w * 0.004));

  // Bandar Abbas
  ctx.fillStyle = "#ffcc00";
  ctx.beginPath();
  ctx.arc(lonToX(56.28, w), latToY(27.19, h), citySize, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffeeaa";
  ctx.font = `${Math.max(8, Math.floor(w * 0.01))}px sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 2;
  ctx.fillText("Bandar Abbas", lonToX(56.32, w), latToY(27.17, h));

  // Bandar Lengeh
  ctx.fillStyle = "#ffcc00";
  ctx.beginPath();
  ctx.arc(lonToX(54.88, w), latToY(26.56, h), citySize, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffeeaa";
  ctx.fillText("Bandar Lengeh", lonToX(54.55, w), latToY(26.60, h));

  // Khasab (Musandam)
  ctx.fillStyle = "#ffcc00";
  ctx.beginPath();
  ctx.arc(lonToX(56.25, w), latToY(26.20, h), citySize, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffeeaa";
  ctx.fillText("Khasab", lonToX(56.12, w), latToY(26.16, h));

  ctx.shadowBlur = 0;

  // Mountain shading on Iran side
  for (let i = 0; i < 40; i++) {
    const cx = lonToX(54.5 + Math.random() * 2.5, w);
    const cy = latToY(27.4 - Math.random() * 0.3, h);
    ctx.fillStyle = `rgba(160,140,100,${0.05 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8 + Math.random() * 15, 3 + Math.random() * 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Desert texture on Arabian side
  for (let i = 0; i < 30; i++) {
    const cx = lonToX(54.5 + Math.random() * 1.5, w);
    const cy = latToY(25.4 + Math.random() * 0.3, h);
    ctx.fillStyle = `rgba(210,190,140,${0.04 + Math.random() * 0.06})`;
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
function createBoard(rows: number, cols: number, mines: number, firstR: number, firstC: number): CellState[][] {
  const board: CellState[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    }))
  );

  // Place mines avoiding first click and its neighbors
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (board[r][c].mine) continue;
    if (Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1) continue;
    board[r][c].mine = true;
    placed++;
  }

  // Count adjacents
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
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
    if (newBoard[cr][cc].revealed || newBoard[cr][cc].flagged) continue;
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
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].revealed) revealedCount++;
    }
  }
  return revealedCount === rows * cols - totalMines;
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

    if (!board) {
      // First click
      const newBoard = createBoard(rows, cols, mines, r, c);
      const revealed = reveal(newBoard, r, c, rows, cols);
      setBoard(revealed);
      setStatus("playing");
      if (checkWin(revealed, rows, cols, mines)) setStatus("won");
      return;
    }

    const cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    if (cell.mine) {
      // Lost - reveal all mines
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
    if (checkWin(revealed, rows, cols, mines)) setStatus("won");
  }, [board, status, rows, cols, mines]);

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
          if (!neighbor.revealed && !neighbor.flagged) {
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
      if (checkWin(newBoard, rows, cols, mines)) setStatus("won");
    }
  }, [board, status, rows, cols, mines]);

  const handleRightClick = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (status === "won" || status === "lost") return;
    if (!board) return;
    const cell = board[r][c];
    if (cell.revealed) return;

    const newBoard = board.map(row => row.map(cl => ({ ...cl })));
    newBoard[r][c].flagged = !cell.flagged;
    setBoard(newBoard);
    setFlagCount(f => cell.flagged ? f - 1 : f + 1);
  }, [board, status]);

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
  const minesLeft = mines - flagCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "10px", background: "#1a1a2e" }}>
      {/* Hidden canvas for map generation */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

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
          {/* Mine counter */}
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

          {/* Face button */}
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

          {/* Timer */}
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
              style={{ position: "absolute", top: 0, left: 0, width: gridW, height: gridH, opacity: 0.5, pointerEvents: "none" }}
            />
          )}

          {/* Cells */}
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`, gridTemplateRows: `repeat(${rows}, ${cellSize}px)` }}>
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const cell = board ? board[r][c] : null;
                const isRevealed = cell?.revealed ?? false;
                const isFlagged = cell?.flagged ?? false;
                const isMine = cell?.mine ?? false;
                const adj = cell?.adjacentMines ?? 0;
                const isExploded = isRevealed && isMine && status === "lost";

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
                        : "2px outset rgba(180,200,220,0.6)",
                      background: isExploded
                        ? "rgba(255,50,50,0.7)"
                        : isRevealed
                          ? "rgba(180,200,220,0.25)"
                          : "rgba(100,140,180,0.35)",
                      transition: "background 0.1s",
                      color: isRevealed && !isMine && adj > 0 ? (NUM_COLORS[adj] || "#000") : "#000",
                      textShadow: isRevealed && !isMine && adj > 0 ? "0 0 2px rgba(255,255,255,0.5)" : "none",
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
    </div>
  );
}
