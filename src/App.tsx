import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./main.css";

const W = 360;
const H = 560;
const PW = 34;
const PH = 18;
const PY = H - 66;
const AW = 24;
const AH = 18;
const PIX = 3;
const TYPES = ["grunt", "zig", "tank", "diver", "elite", "splitter"] as const;

type AlienType = "grunt" | "zig" | "tank" | "diver" | "elite" | "splitter" | "boss";
type PowerType = "shield" | "rapid" | "spread" | "bomb" | "laser" | "wing" | "chain" | "magnet" | "chrono" | "overdrive" | "singularity";
type Rect = { x: number; y: number; w: number; h: number; [key: string]: any };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const snap = (v: number) => Math.round(v / PIX) * PIX;
const rectsOverlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function runSelfTests() {
  console.assert(clamp(12, 0, 10) === 10, "clamp upper bound failed");
  console.assert(clamp(-1, 0, 10) === 0, "clamp lower bound failed");
  console.assert(snap(4) === 3 && snap(5) === 6, "snap failed");
  console.assert(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), "overlap failed");
  console.assert(!rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 5, y: 5, w: 2, h: 2 }), "non-overlap failed");
  console.assert(makeAliens(5)[0].type === "boss", "boss wave generation failed");
}
runSelfTests();

function readHighScore() {
  try { return Number(localStorage.getItem("neonInvadersHighScore") || 0); } catch { return 0; }
}
function writeHighScore(score: number) {
  try { localStorage.setItem("neonInvadersHighScore", String(score)); } catch {}
}

function makeAliens(level: number): Rect[] {
  if (level % 5 === 0) {
    const hp = 28 + level * 4;
    return [{ id: `boss-${level}`, type: "boss", x: W / 2 - 48, y: 76, w: 96, h: 44, hp, maxHp: hp, alive: true, wobble: 0, phase: 0 }];
  }
  const rows = Math.min(3 + Math.floor(level / 2), 6);
  const aliens: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 8; c++) {
      const type = level < 2 ? "grunt" : TYPES[(r + c + level) % TYPES.length];
      const hp = type === "elite" ? 3 : type === "tank" || type === "splitter" ? 2 : 1;
      aliens.push({ id: `${level}-${r}-${c}`, type, x: 34 + c * 36, y: 58 + r * 30, w: AW, h: AH, hp, maxHp: hp, alive: true, wobble: Math.random() * 9, phase: Math.random() * 9 });
    }
  }
  return aliens;
}

function newGame(highScore = readHighScore()) {
  return {
    status: "title",
    playerX: W / 2 - PW / 2,
    playerCooldown: 0,
    bullets: [] as Rect[],
    enemyBullets: [] as Rect[],
    aliens: makeAliens(1),
    alienDir: 1,
    alienStep: 0,
    alienShoot: 0,
    bossBeamTimer: 2.4,
    powerups: [] as Rect[],
    particles: [] as Rect[],
    shockwaves: [] as Rect[],
    popups: [] as Rect[],
    lightning: [] as Rect[],
    comets: [] as Rect[],
    singularities: [] as Rect[],
    beams: [] as Rect[],
    saucer: null as Rect | null,
    saucerTimer: 7,
    barriers: Array.from({ length: 4 }, (_, i) => ({ x: 34 + i * 78, y: H - 126, w: 42, h: 22, hp: 12, maxHp: 12 })),
    score: 0,
    highScore,
    lives: 3,
    bombs: 2,
    level: 1,
    waveLivesStart: 3,
    perfectWaves: 0,
    combo: 1,
    comboTimer: 0,
    shield: 0,
    rapid: 0,
    spread: 0,
    laser: 0,
    chain: 0,
    magnet: 0,
    chrono: 0,
    overdrive: 0,
    drones: 0,
    charge: 0,
    waveMod: "standard",
    message: "DEFEND THE GALAXY",
    messageTimer: 2,
    feed: [] as Rect[],
    flash: 0,
    shake: 0,
    hitStop: 0,
    stars: Array.from({ length: 76 }, (_, i) => ({ id: i, x: Math.random() * W, y: Math.random() * H, speed: rand(14, 62), size: Math.random() > 0.84 ? 2 : 1 })),
  };
}

function addFeed(g: any, text: string, color = "#31F7FF") {
  g.feed.unshift({ text, color, life: 2.3, maxLife: 2.3 });
  g.feed = g.feed.slice(0, 4);
}
function addPopup(g: any, text: string, x: number, y: number, color = "#FFE85C") {
  g.popups.push({ text, x, y, vy: -28, life: 0.85, maxLife: 0.85, color });
}
function addLightning(g: any, x1: number, y1: number, x2: number, y2: number) {
  g.lightning.push({ x1, y1, x2, y2, life: 0.16, maxLife: 0.16, seed: Math.random() * 1000 });
}
function addBurst(g: any, x: number, y: number, amount = 12, color = "#FFE85C") {
  const palettes: Record<string, string[]> = {
    "#FFE85C": ["#FFF7AE", "#FFE85C", "#FFB347"],
    "#FF4FD8": ["#FFD1F7", "#FF4FD8", "#FF6B6B"],
    "#31F7FF": ["#DEFCFF", "#31F7FF", "#7CFF6B"],
    "#FF6B6B": ["#FFD0D0", "#FFB347", "#FF6B6B"],
    "#7CFF6B": ["#E6FFD8", "#7CFF6B", "#31F7FF"],
    "#FFFFFF": ["#FFFFFF", "#DEFCFF", "#FF4FD8"],
    "#B388FF": ["#FFFFFF", "#B388FF", "#31F7FF"],
  };
  const pal = palettes[color] || ["#FFFFFF", color, "#FF6B6B"];
  for (let i = 0; i < Math.max(8, amount); i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(45, 170 + amount);
    g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.18, 0.6), maxLife: 0.6, size: pick([3, 3, 6, 6, 9]), color: pick(pal), gravity: rand(60, 155), kind: Math.random() < 0.75 ? "chunk" : "spark" });
  }
  if (amount >= 18) g.shockwaves.push({ x, y, size: 6, maxSize: 30 + amount, life: 0.25, maxLife: 0.25, color: pal[1] });
}

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, shield: number, powered: boolean) {
  if (shield > 0) {
    ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 70) * 0.12;
    ctx.strokeStyle = "#31F7FF"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + PW / 2, y + PH / 2, 24, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = powered ? "#31F7FF" : "#7CFF6B";
  ctx.fillRect(x + 14, y, 6, 4); ctx.fillRect(x + 10, y + 4, 14, 5); ctx.fillRect(x + 4, y + 9, 26, 5); ctx.fillRect(x, y + 14, 34, 4);
  ctx.fillStyle = "#D6FFD0"; ctx.fillRect(x + 15, y + 5, 4, 4);
}
function drawAlien(ctx: CanvasRenderingContext2D, alien: Rect, frame: number) {
  if (alien.type === "boss") {
    ctx.fillStyle = "#FF4FD8"; ctx.fillRect(alien.x + 12, alien.y, 72, 8); ctx.fillRect(alien.x, alien.y + 8, 96, 18); ctx.fillRect(alien.x + 8, alien.y + 26, 80, 10);
    ctx.fillRect(alien.x + (frame ? 8 : 18), alien.y + 36, 12, 8); ctx.fillRect(alien.x + (frame ? 76 : 66), alien.y + 36, 12, 8);
    ctx.fillStyle = "#31F7FF"; ctx.fillRect(alien.x + 24, alien.y + 14, 10, 6); ctx.fillRect(alien.x + 62, alien.y + 14, 10, 6);
    ctx.fillStyle = "#470026"; ctx.fillRect(alien.x + 10, alien.y - 8, 76, 4);
    ctx.fillStyle = "#7CFF6B"; ctx.fillRect(alien.x + 10, alien.y - 8, 76 * (alien.hp / alien.maxHp), 4);
    return;
  }
  const colors: Record<string, string> = { grunt: "#FF4FD8", zig: "#31F7FF", tank: "#FFE85C", diver: "#7CFF6B", elite: "#FFFFFF", splitter: "#FF6B6B" };
  ctx.fillStyle = colors[alien.type] || "#FF4FD8";
  ctx.fillRect(alien.x + 6, alien.y, 12, 4); ctx.fillRect(alien.x + 2, alien.y + 4, 20, 4); ctx.fillRect(alien.x, alien.y + 8, 24, 6);
  ctx.fillRect(alien.x + (frame ? 2 : 6), alien.y + 14, 4, 4); ctx.fillRect(alien.x + (frame ? 18 : 14), alien.y + 14, 4, 4);
  ctx.fillStyle = "#14001F"; ctx.fillRect(alien.x + 6, alien.y + 8, 3, 3); ctx.fillRect(alien.x + 15, alien.y + 8, 3, 3);
  if (alien.hp > 1) { ctx.fillStyle = "#7CFF6B"; ctx.fillRect(alien.x + 4, alien.y - 4, 16 * (alien.hp / alien.maxHp), 2); }
}
function drawBarrier(ctx: CanvasRenderingContext2D, barrier: Rect) {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) {
    const edgeHole = (r === 0 && (c === 0 || c === 6)) || (r === 3 && c >= 2 && c <= 4);
    const broken = ((c * 17 + r * 9 + barrier.hp) % 12) / 12 < 1 - barrier.hp / barrier.maxHp;
    if (!edgeHole && !broken) { ctx.fillStyle = barrier.hp > 5 ? "#7CFF6B" : "#FFE85C"; ctx.fillRect(barrier.x + c * 6, barrier.y + r * 6, 5, 5); }
  }
}
function drawPowerup(ctx: CanvasRenderingContext2D, p: Rect) {
  const labels: Record<string, string> = { shield: "S", rapid: "R", spread: "W", bomb: "B", laser: "L", wing: "D", chain: "*", magnet: "M", chrono: "T", overdrive: "O", singularity: "G" };
  const colors: Record<string, string> = { shield: "#31F7FF", rapid: "#FFE85C", spread: "#7CFF6B", bomb: "#FF6B6B", laser: "#FF4FD8", wing: "#DEFCFF", chain: "#31F7FF", magnet: "#7CFF6B", chrono: "#FFFFFF", overdrive: "#FFB347", singularity: "#B388FF" };
  ctx.fillStyle = colors[p.type] || "#FFFFFF"; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "#07000E"; ctx.font = "10px monospace"; ctx.fillText(labels[p.type] || "?", p.x + 5, p.y + 12);
}
function drawSaucer(ctx: CanvasRenderingContext2D, saucer: Rect | null) {
  if (!saucer) return;
  ctx.fillStyle = "#FF6B6B"; ctx.fillRect(saucer.x + 8, saucer.y, 28, 6); ctx.fillRect(saucer.x, saucer.y + 6, 44, 8); ctx.fillRect(saucer.x + 10, saucer.y + 14, 24, 4);
  ctx.fillStyle = "#FFE85C"; ctx.fillRect(saucer.x + 18, saucer.y + 7, 8, 4);
}
function drawSingularity(ctx: CanvasRenderingContext2D, s: Rect, now: number) {
  const pulse = Math.sin(now / 80 + s.seed) * 4; const r = s.radius + pulse;
  ctx.globalAlpha = 0.55; ctx.fillStyle = "#120022"; ctx.fillRect(snap(s.x - r), snap(s.y - r), snap(r * 2), snap(r * 2)); ctx.globalAlpha = 1;
  ctx.strokeStyle = "#B388FF"; ctx.lineWidth = 3; ctx.strokeRect(snap(s.x - r), snap(s.y - r), snap(r * 2), snap(r * 2));
  ctx.strokeStyle = "#31F7FF"; ctx.lineWidth = 2; ctx.strokeRect(snap(s.x - r / 2), snap(s.y - r / 2), snap(r), snap(r));
}

function RetroSpaceInvaders() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<any>(newGame());
  const keysRef = useRef({ left: false, right: false, fire: false, bomb: false });
  const touchDirRef = useRef(0);
  const [ui, setUi] = useState({ score: 0, highScore: readHighScore(), lives: 3, bombs: 2, level: 1, status: "title" });

  const syncUi = () => {
    const g = gameRef.current;
    setUi({ score: g.score, highScore: g.highScore, lives: g.lives, bombs: g.bombs, level: g.level, status: g.status });
  };

  const startGame = () => {
    const highScore = gameRef.current.highScore;
    gameRef.current = newGame(highScore);
    gameRef.current.status = "playing";
    addFeed(gameRef.current, "MISSION START", "#31F7FF");
    syncUi();
  };

  const togglePause = () => {
    const g = gameRef.current;
    if (g.status === "title" || g.status === "gameover") startGame();
    else g.status = g.status === "playing" ? "paused" : "playing";
    syncUi();
  };

  const tapFire = () => { keysRef.current.fire = true; window.setTimeout(() => { keysRef.current.fire = false; }, 120); };
  const tapBomb = () => { keysRef.current.bomb = true; window.setTimeout(() => { keysRef.current.bomb = false; }, 120); };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = true;
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) keysRef.current.fire = true;
      if (["x", "X", "b", "B"].includes(e.key)) keysRef.current.bomb = true;
      if (["p", "P"].includes(e.key)) togglePause();
      if (e.key === "Enter" && gameRef.current.status !== "playing") startGame();
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = false;
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) keysRef.current.fire = false;
      if (["x", "X", "b", "B"].includes(e.key)) keysRef.current.bomb = false;
    };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0, last = performance.now(), uiTimer = 0;

    const levelUp = (g: any) => {
      const mods = ["standard", "meteor-storm", "void-rush", "gold-rush", "bullet-hell", "rift-zone"];
      g.level += 1; g.waveMod = g.level % 5 === 0 ? "boss" : pick(mods); g.aliens = makeAliens(g.level);
      g.bullets = []; g.enemyBullets = []; g.powerups = []; g.comets = []; g.beams = []; g.singularities = []; g.alienDir = 1;
      g.bombs = Math.min(3, g.bombs + 1);
      if (g.lives >= g.waveLivesStart) { const bonus = 500 * Math.max(1, g.level - 1); g.score += bonus; g.perfectWaves += 1; addPopup(g, `PERFECT +${bonus}`, W / 2, H / 2 - 70, "#7CFF6B"); addFeed(g, "PERFECT WAVE", "#7CFF6B"); }
      g.waveLivesStart = g.lives; g.score += 100 * g.level; g.message = g.waveMod === "boss" ? `WARNING: BOSS WAVE ${g.level}` : `WAVE ${g.level}: ${g.waveMod.toUpperCase()}`;
      g.messageTimer = 2; g.flash = 0.2; addFeed(g, g.message, g.waveMod === "gold-rush" ? "#FFE85C" : "#31F7FF");
    };

    const killAlien = (g: any, alien: Rect, bullet: Rect | null) => {
      alien.alive = false; if (bullet) bullet.dead = true;
      const base = alien.type === "boss" ? 1200 : alien.type === "elite" ? 75 : alien.type === "splitter" ? 50 : alien.type === "tank" ? 40 : alien.type === "zig" ? 25 : 15;
      const gained = Math.round(base * g.level * g.combo); g.score += gained; addPopup(g, `+${gained}`, alien.x + alien.w / 2, alien.y, alien.type === "boss" ? "#FF4FD8" : "#FFE85C");
      g.combo = clamp(g.combo + 0.15, 1, 5); g.comboTimer = 1.7; g.hitStop = alien.type === "boss" ? 0.1 : 0.03; g.shake = alien.type === "boss" ? 0.55 : 0.16; g.flash = alien.type === "boss" ? 0.24 : 0.06;
      const color = alien.type === "zig" ? "#31F7FF" : alien.type === "diver" ? "#7CFF6B" : alien.type === "elite" ? "#FFFFFF" : alien.type === "boss" ? "#B388FF" : "#FF4FD8";
      addBurst(g, alien.x + alien.w / 2, alien.y + alien.h / 2, alien.type === "boss" ? 66 : alien.type === "tank" ? 24 : 18, color);
      if (alien.type === "splitter") {
        [-12, 12].forEach((dx) => g.aliens.push({ id: `split-${Math.random()}`, type: "diver", x: clamp(alien.x + dx, 18, W - AW - 18), y: alien.y + 12, w: AW, h: AH, hp: 1, maxHp: 1, alive: true, wobble: Math.random() * 9, phase: Math.random() * 9 }));
        addFeed(g, "SPLITTER!", "#FF6B6B");
      }
      if (g.chain > 0 && alien.type !== "boss") {
        const nearby = g.aliens.filter((a: Rect) => a.alive).sort((a: Rect, b: Rect) => Math.hypot(a.x - alien.x, a.y - alien.y) - Math.hypot(b.x - alien.x, b.y - alien.y))[0];
        if (nearby && Math.hypot(nearby.x - alien.x, nearby.y - alien.y) < 100) { addLightning(g, alien.x + alien.w / 2, alien.y + alien.h / 2, nearby.x + nearby.w / 2, nearby.y + nearby.h / 2); nearby.hp -= 1; if (nearby.hp <= 0) killAlien(g, nearby, null); else addBurst(g, nearby.x + nearby.w / 2, nearby.y + nearby.h / 2, 10, "#31F7FF"); }
      }
      const dropRate = alien.type === "boss" ? 1 : g.waveMod === "gold-rush" ? 0.22 : 0.12;
      if (Math.random() < dropRate) {
        const options: PowerType[] = alien.type === "boss" ? ["laser", "overdrive", "wing", "singularity"] : ["shield", "rapid", "spread", "bomb", "laser", "wing", "chain", "magnet", "chrono", "overdrive", "singularity"];
        g.powerups.push({ x: alien.x + alien.w / 2 - 8, y: alien.y + alien.h / 2, w: 16, h: 16, type: pick(options) });
      }
    };
    const damageAlien = (g: any, alien: Rect, amount: number, bullet: Rect | null) => { alien.hp -= amount; if (alien.hp <= 0) killAlien(g, alien, bullet); else { if (bullet) bullet.dead = true; addBurst(g, alien.x + alien.w / 2, alien.y + alien.h / 2, 8, "#FFE85C"); } };

    const loop = (now: number) => {
      const rawDt = Math.min((now - last) / 1000, 0.034); last = now;
      const g = gameRef.current; const dt = g.hitStop > 0 ? 0 : rawDt;
      g.hitStop = Math.max(0, g.hitStop - rawDt); g.flash = Math.max(0, g.flash - rawDt); g.shake = Math.max(0, g.shake - rawDt); g.messageTimer = Math.max(0, g.messageTimer - rawDt);
      g.stars = g.stars.map((s: any) => ({ ...s, y: (s.y + s.speed * rawDt * (g.overdrive > 0 ? 2 : 1)) % H }));
      g.particles = g.particles.map((p: Rect) => ({ ...p, x: p.x + p.vx * rawDt, y: p.y + p.vy * rawDt, vy: p.vy + (p.gravity || 90) * rawDt, life: p.life - rawDt })).filter((p: Rect) => p.life > 0);
      g.shockwaves = g.shockwaves.map((s: Rect) => ({ ...s, size: Math.min(s.maxSize, s.size + 180 * rawDt), life: s.life - rawDt })).filter((s: Rect) => s.life > 0);
      g.popups = g.popups.map((p: Rect) => ({ ...p, y: p.y + p.vy * rawDt, life: p.life - rawDt })).filter((p: Rect) => p.life > 0);
      g.lightning = g.lightning.map((l: Rect) => ({ ...l, life: l.life - rawDt })).filter((l: Rect) => l.life > 0);
      g.singularities = g.singularities.map((s: Rect) => ({ ...s, life: s.life - rawDt, tick: s.tick - rawDt })).filter((s: Rect) => s.life > 0);
      g.beams = g.beams.map((b: Rect) => ({ ...b, charge: b.charge - rawDt, life: b.life - rawDt, fired: b.fired || b.charge <= 0 })).filter((b: Rect) => b.life > 0);
      g.feed = g.feed.map((f: Rect) => ({ ...f, life: f.life - rawDt })).filter((f: Rect) => f.life > 0);

      if (g.status === "playing" && dt > 0) {
        if (g.waveMod === "rift-zone" && Math.random() < dt * 0.055) { g.singularities.push({ x: rand(58, W - 58), y: rand(108, H - 210), radius: rand(18, 30), life: rand(2.4, 3.8), tick: 0.3, seed: Math.random() * 10 }); addFeed(g, "VOID RIFT", "#B388FF"); }
        if (Math.random() < dt * clamp((g.waveMod === "meteor-storm" ? 0.095 : 0.025) + g.level * 0.004, 0.025, 0.14)) g.comets.push({ x: rand(16, W - 16), y: -18, w: 12, h: 12, vx: rand(-25, 25), vy: rand(75, 130), spin: 0 });
        g.comboTimer = Math.max(0, g.comboTimer - dt); if (g.comboTimer <= 0) g.combo = 1;
        ["shield", "rapid", "spread", "laser", "chain", "magnet", "chrono", "overdrive"].forEach((k) => { g[k] = Math.max(0, g[k] - dt); });
        g.charge = clamp(g.charge + dt * 0.12, 0, 1);

        const move = clamp((keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0) + touchDirRef.current, -1, 1);
        g.playerX = clamp(g.playerX + move * (g.overdrive > 0 || g.laser > 0 ? 265 : 230) * dt, 8, W - PW - 8);
        g.playerCooldown = Math.max(0, g.playerCooldown - dt);
        if (keysRef.current.fire && g.playerCooldown <= 0) {
          const base = { x: g.playerX + PW / 2 - 2, y: PY - 10, w: 4, h: 10, vx: 0, power: g.overdrive > 0 ? 3 : g.laser > 0 ? 2 : 1, color: g.overdrive > 0 ? "#FFB347" : g.laser > 0 ? "#31F7FF" : "#FFE85C" };
          const shots = g.spread > 0 || g.overdrive > 0 ? [-90, 0, 90] : [0]; if (g.overdrive > 0) shots.push(-150, 150);
          shots.forEach((vx) => g.bullets.push({ ...base, vx, power: Math.abs(vx) === 150 ? 2 : base.power }));
          if (g.drones > 0) g.bullets.push({ ...base, x: g.playerX - 9, y: PY - 4, vx: -20, power: 1, color: "#DEFCFF" });
          if (g.drones > 1) g.bullets.push({ ...base, x: g.playerX + PW + 5, y: PY - 4, vx: 20, power: 1, color: "#DEFCFF" });
          g.playerCooldown = g.overdrive > 0 ? 0.075 : g.rapid > 0 ? 0.13 : 0.28;
        }
        if (keysRef.current.bomb && g.bombs > 0 && g.charge >= 0.25) {
          keysRef.current.bomb = false; g.bombs -= 1; g.charge = 0; g.enemyBullets = []; g.comets = []; g.flash = 0.38; g.shake = 0.7; g.message = "NOVA BOMB!"; g.messageTimer = 1.2; addFeed(g, "NOVA DETONATED", "#31F7FF");
          [...g.aliens].forEach((a: Rect) => { if (a.alive) damageAlien(g, a, a.type === "boss" ? 8 : 99, null); }); addBurst(g, W / 2, H / 2, 72, "#31F7FF");
        }

        g.bullets = g.bullets.map((b: Rect) => ({ ...b, x: b.x + b.vx * dt, y: b.y - (g.overdrive > 0 || g.laser > 0 ? 430 : 350) * dt })).filter((b: Rect) => b.y > -30 && b.x > -25 && b.x < W + 25 && !b.dead);
        const enemyScale = g.chrono > 0 ? 0.46 : 1;
        g.enemyBullets = g.enemyBullets.map((b: Rect) => ({ ...b, x: b.x + (b.vx || 0) * dt * enemyScale, y: b.y + b.speed * dt * enemyScale })).filter((b: Rect) => b.y < H + 24 && b.x > -32 && b.x < W + 32 && !b.dead);
        g.comets = g.comets.map((c: Rect) => ({ ...c, x: c.x + c.vx * dt * enemyScale, y: c.y + c.vy * dt * enemyScale, spin: c.spin + dt * 8 })).filter((c: Rect) => c.y < H + 30 && c.x > -40 && c.x < W + 40 && !c.dead);
        g.powerups = g.powerups.map((p: Rect) => {
          let nx = p.x, ny = p.y + 75 * dt;
          if (g.magnet > 0) { const dx = g.playerX + PW / 2 - (p.x + p.w / 2); const dy = PY - p.y; const d = Math.max(20, Math.hypot(dx, dy)); nx += (dx / d) * 135 * dt; ny += (dy / d) * 135 * dt; }
          return { ...p, x: nx, y: ny };
        }).filter((p: Rect) => p.y < H + 25 && !p.dead);

        g.singularities.forEach((s: Rect) => {
          const pull = (obj: Rect, strength = 44) => { const dx = s.x - (obj.x + (obj.w || 0) / 2); const dy = s.y - (obj.y + (obj.h || 0) / 2); const d = Math.max(12, Math.hypot(dx, dy)); if (d < s.radius * 4.2) { obj.x += (dx / d) * strength * dt; obj.y += (dy / d) * strength * dt; } return d; };
          g.bullets.forEach((b: Rect) => pull(b, 30)); g.powerups.forEach((p: Rect) => pull(p, 80));
          g.aliens.forEach((a: Rect) => { if (!a.alive) return; const d = pull(a, a.type === "boss" ? 10 : 26); if (d < s.radius && s.tick <= 0) damageAlien(g, a, a.type === "boss" ? 1 : 2, null); });
          if (s.tick <= 0) s.tick = 0.42;
        });

        g.barriers.forEach((barrier: Rect) => {
          if (barrier.hp <= 0) return; const area = { x: barrier.x, y: barrier.y, w: barrier.w, h: barrier.h };
          [...g.bullets, ...g.enemyBullets, ...g.comets].forEach((obj: Rect) => { if (!obj.dead && rectsOverlap(obj, area)) { obj.dead = true; barrier.hp = Math.max(0, barrier.hp - (obj.speed ? 2 : obj.vy ? 4 : 1)); addBurst(g, obj.x, obj.y, obj.vy ? 18 : 6, obj.vy ? "#FF6B6B" : "#7CFF6B"); } });
        });
        g.bullets = g.bullets.filter((b: Rect) => !b.dead); g.enemyBullets = g.enemyBullets.filter((b: Rect) => !b.dead); g.comets = g.comets.filter((c: Rect) => !c.dead);

        g.saucerTimer -= dt;
        if (!g.saucer && g.saucerTimer <= 0) { const left = Math.random() > 0.5; g.saucer = { x: left ? -50 : W + 10, y: 42, w: 44, h: 18, vx: left ? 70 + g.level * 5 : -70 - g.level * 5, hp: 2 }; g.saucerTimer = g.waveMod === "gold-rush" ? rand(5, 8) : rand(10, 16); }
        if (g.saucer) { g.saucer.x += g.saucer.vx * dt; if (g.saucer.x < -70 || g.saucer.x > W + 70) g.saucer = null; }

        const alive = g.aliens.filter((a: Rect) => a.alive); const hasBoss = alive.some((a: Rect) => a.type === "boss");
        g.alienStep += dt; const interval = hasBoss ? 0.02 : clamp(0.55 - g.level * 0.035 - (48 - alive.length) * 0.006 - (g.waveMod === "void-rush" ? 0.1 : 0), 0.11, 0.55);
        if (alive.length > 0 && g.alienStep >= interval) {
          g.alienStep = 0;
          if (hasBoss) g.aliens = g.aliens.map((a: Rect) => a.alive ? { ...a, x: clamp(a.x + Math.sin(now / 600) * 1.6, 18, W - a.w - 18), y: a.y + Math.sin(now / 900) * 0.35, wobble: a.wobble + 0.2 } : a);
          else {
            const minX = Math.min(...alive.map((a: Rect) => a.x)); const maxX = Math.max(...alive.map((a: Rect) => a.x + a.w)); const drop = (maxX >= W - 18 && g.alienDir > 0) || (minX <= 18 && g.alienDir < 0); if (drop) g.alienDir *= -1;
            g.aliens = g.aliens.map((a: Rect) => { if (!a.alive) return a; const zig = a.type === "zig" ? Math.sin(now / 220 + a.phase) * 2 : 0; const dive = a.type === "diver" && Math.random() < 0.018 ? 10 + g.level * 0.8 : 0; return { ...a, x: a.x + (drop ? 0 : g.alienDir * 10) + zig, y: a.y + (drop ? 18 : 0) + dive, wobble: a.wobble + 0.4 }; });
          }
        }

        g.alienShoot += dt; const shootInterval = clamp(hasBoss ? 0.5 : 1.05 - g.level * 0.07 - (g.waveMod === "bullet-hell" ? 0.22 : 0), 0.28, 1.05);
        if (hasBoss) { g.bossBeamTimer -= dt; if (g.bossBeamTimer <= 0) { g.bossBeamTimer = clamp(3.1 - g.level * 0.08, 1.7, 3.1); const targetX = clamp(g.playerX + PW / 2 - 15 + rand(-18, 18), 16, W - 46); g.beams.push({ x: targetX, y: 130, w: 30, h: H - 188, charge: 0.78, life: 1.18, fired: false }); addFeed(g, "BOSS LASER LOCK", "#FF6B6B"); } }
        if (alive.length > 0 && g.alienShoot >= shootInterval) {
          g.alienShoot = 0; const shooter = pick(alive);
          if (shooter.type === "boss") [-70, 0, 70].forEach((vx) => g.enemyBullets.push({ x: shooter.x + shooter.w / 2 - 2, y: shooter.y + shooter.h, w: 4, h: 10, vx, speed: 165 + g.level * 6 }));
          else g.enemyBullets.push({ x: shooter.x + shooter.w / 2 - 2, y: shooter.y + shooter.h, w: 4, h: 10, vx: shooter.type === "zig" || shooter.type === "elite" ? rand(-42, 42) : 0, speed: 180 + g.level * 6 });
        }

        g.bullets.forEach((b: Rect) => {
          if (g.saucer && !b.dead && rectsOverlap(b, g.saucer)) { b.dead = true; g.saucer.hp -= b.power || 1; addBurst(g, b.x, b.y, 8, "#FF6B6B"); if (g.saucer.hp <= 0) { g.score += 250 * g.level; g.powerups.push({ x: g.saucer.x + 14, y: g.saucer.y, w: 16, h: 16, type: pick(["shield", "rapid", "spread", "bomb", "laser", "wing", "chain", "magnet", "chrono", "overdrive", "singularity"]) }); addBurst(g, g.saucer.x + 22, g.saucer.y + 10, 26, "#FF6B6B"); g.saucer = null; } }
          g.aliens.forEach((a: Rect) => { if (a.alive && !b.dead && rectsOverlap(b, a)) damageAlien(g, a, b.power || 1, b); });
        });
        g.bullets = g.bullets.filter((b: Rect) => !b.dead);

        const player = { x: g.playerX, y: PY, w: PW, h: PH };
        g.powerups.forEach((p: Rect) => {
          if (rectsOverlap(p, player)) {
            p.dead = true; g.score += 50; g.messageTimer = 1.1;
            if (p.type === "shield") { g.shield = 8; g.message = "SHIELD ONLINE"; }
            if (p.type === "rapid") { g.rapid = 9; g.message = "RAPID FIRE"; }
            if (p.type === "spread") { g.spread = 9; g.message = "TRIPLE SHOT"; }
            if (p.type === "bomb") { g.bombs = Math.min(3, g.bombs + 1); g.message = "+1 NOVA BOMB"; }
            if (p.type === "laser") { g.laser = 7; g.message = "LASER OVERDRIVE"; }
            if (p.type === "wing") { g.drones = Math.min(2, g.drones + 1); g.message = "DRONE WINGMAN"; addFeed(g, "DRONE ONLINE", "#DEFCFF"); }
            if (p.type === "chain") { g.chain = 9; g.message = "CHAIN LIGHTNING"; addFeed(g, "CHAIN MODE", "#31F7FF"); }
            if (p.type === "magnet") { g.magnet = 10; g.message = "POWER MAGNET"; }
            if (p.type === "chrono") { g.chrono = 7; g.message = "CHRONO FIELD"; addFeed(g, "TIME SLOWED", "#FFFFFF"); }
            if (p.type === "overdrive") { g.overdrive = 6; g.message = "STARFIRE OVERDRIVE"; addFeed(g, "OVERDRIVE!", "#FFB347"); }
            if (p.type === "singularity") { g.singularities.push({ x: W / 2, y: H / 2 - 70, radius: 42, life: 4.2, tick: 0.15, seed: Math.random() * 10 }); g.message = "GRAVITY WELL"; addFeed(g, "SINGULARITY DEPLOYED", "#B388FF"); }
            addBurst(g, p.x + 8, p.y + 8, 18, p.type === "singularity" ? "#FFFFFF" : "#7CFF6B");
          }
        });
        g.powerups = g.powerups.filter((p: Rect) => !p.dead);

        const touched = g.enemyBullets.some((b: Rect) => rectsOverlap(b, player)) || g.comets.some((c: Rect) => rectsOverlap(c, player)) || g.beams.some((beam: Rect) => beam.fired && rectsOverlap(beam, player));
        if (touched) {
          g.enemyBullets = []; g.comets = [];
          if (g.shield > 0) { g.shield = 0; g.message = "SHIELD BROKEN"; g.messageTimer = 1.2; addBurst(g, g.playerX + PW / 2, PY + PH / 2, 26, "#31F7FF"); }
          else { g.lives -= 1; g.combo = 1; g.bullets = []; g.flash = 0.3; g.shake = 0.55; g.message = g.lives > 0 ? "SHIP HIT!" : "SIGNAL LOST"; g.messageTimer = 1.4; addBurst(g, g.playerX + PW / 2, PY + PH / 2, 38, "#7CFF6B"); if (g.lives <= 0) g.status = "gameover"; }
        }
        if (g.aliens.some((a: Rect) => a.alive && a.y + a.h >= H - 80)) { g.status = "gameover"; g.message = "BASE OVERRUN"; g.messageTimer = 2; }
        if (g.aliens.every((a: Rect) => !a.alive)) levelUp(g);
        if (g.score > g.highScore) { g.highScore = g.score; writeHighScore(g.highScore); }
      }

      ctx.save(); ctx.translate(g.shake > 0 ? rand(-4, 4) * g.shake * 2 : 0, g.shake > 0 ? rand(-4, 4) * g.shake * 2 : 0);
      ctx.fillStyle = "#07000E"; ctx.fillRect(-8, -8, W + 16, H + 16);
      g.stars.forEach((s: any) => { ctx.globalAlpha = s.size === 2 ? 0.9 : 0.55; ctx.fillStyle = "#FFFFFF"; ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size); }); ctx.globalAlpha = 1;
      ctx.strokeStyle = "#31F7FF"; ctx.lineWidth = 2; ctx.strokeRect(8, 8, W - 16, H - 16);
      ctx.font = "11px monospace"; ctx.fillStyle = "#31F7FF"; ctx.fillText(`SCORE ${g.score}`, 18, 28); ctx.fillText(`HI ${g.highScore}`, 18, 42); ctx.fillText(`LIVES ${g.lives}`, 145, 28); ctx.fillText(`BOMB ${g.bombs}`, 145, 42); ctx.fillText(`LV ${g.level}`, 288, 28);
      if (g.combo > 1) { ctx.fillStyle = "#FFE85C"; ctx.fillText(`x${g.combo.toFixed(1)}`, 288, 42); }
      ctx.fillStyle = "#310044"; ctx.fillRect(250, 48, 80, 4); ctx.fillStyle = g.charge >= 1 ? "#7CFF6B" : "#FF4FD8"; ctx.fillRect(250, 48, 80 * g.charge, 4);
      const active = [g.chain > 0 && "CHAIN", g.magnet > 0 && "MAG", g.chrono > 0 && "SLOW", g.overdrive > 0 && "OVER", g.drones > 0 && `DRONE${g.drones}`].filter(Boolean).join(" ");
      if (active) { ctx.font = "9px monospace"; ctx.fillStyle = "#7CFF6B"; ctx.fillText(active, 18, 56); }
      if (g.waveMod !== "standard") { ctx.font = "9px monospace"; ctx.fillStyle = g.waveMod === "gold-rush" ? "#FFE85C" : g.waveMod === "bullet-hell" ? "#FF6B6B" : g.waveMod === "rift-zone" ? "#B388FF" : "#31F7FF"; ctx.fillText(g.waveMod.toUpperCase(), 250, 62); }
      if (g.perfectWaves > 0) { ctx.font = "9px monospace"; ctx.fillStyle = "#7CFF6B"; ctx.fillText(`PERFECT ${g.perfectWaves}`, 145, 56); }

      const frame = Math.floor(now / 300) % 2;
      g.aliens.forEach((a: Rect) => { if (a.alive) drawAlien(ctx, { ...a, x: Math.round(a.x), y: Math.round(a.y + Math.sin(a.wobble) * 1) }, frame); });
      drawSaucer(ctx, g.saucer);
      g.barriers.forEach((b: Rect) => { if (b.hp > 0) drawBarrier(ctx, b); });
      g.comets.forEach((c: Rect) => { ctx.save(); ctx.translate(snap(c.x + 6), snap(c.y + 6)); ctx.rotate(c.spin); ctx.fillStyle = "#FF6B6B"; ctx.fillRect(-6, -6, 12, 12); ctx.fillStyle = "#FFE85C"; ctx.fillRect(-3, -3, 6, 6); ctx.restore(); });
      g.singularities.forEach((s: Rect) => drawSingularity(ctx, s, now));
      g.beams.forEach((beam: Rect) => { ctx.globalAlpha = beam.fired ? 0.72 : 0.28 + Math.sin(now / 55) * 0.12; ctx.fillStyle = beam.fired ? "#FF6B6B" : "#FFE85C"; ctx.fillRect(snap(beam.x), snap(beam.y), snap(beam.w), snap(beam.h)); ctx.globalAlpha = 1; });
      g.powerups.forEach((p: Rect) => drawPowerup(ctx, p));
      g.bullets.forEach((b: Rect) => { ctx.fillStyle = b.color; ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h); if (b.power > 1) { ctx.globalAlpha = 0.35; ctx.fillRect(Math.round(b.x - 2), Math.round(b.y), b.w + 4, b.h); ctx.globalAlpha = 1; } });
      ctx.fillStyle = "#FF6B6B"; g.enemyBullets.forEach((b: Rect) => ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h));
      g.lightning.forEach((l: Rect) => { ctx.globalAlpha = clamp(l.life / l.maxLife, 0, 1); ctx.strokeStyle = "#31F7FF"; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 5; i++) { const t = i / 5; const x = l.x1 + (l.x2 - l.x1) * t + (i === 0 || i === 5 ? 0 : Math.sin(l.seed + i * 12.7) * 10); const y = l.y1 + (l.y2 - l.y1) * t + Math.cos(l.seed + i * 9.1) * 6; if (i === 0) ctx.moveTo(snap(x), snap(y)); else ctx.lineTo(snap(x), snap(y)); } ctx.stroke(); }); ctx.globalAlpha = 1;
      g.shockwaves.forEach((s: Rect) => { ctx.globalAlpha = clamp(s.life / s.maxLife, 0, 1); ctx.strokeStyle = s.color; ctx.lineWidth = 3; const r = snap(s.size); ctx.strokeRect(snap(s.x - r), snap(s.y - r), r * 2, r * 2); }); ctx.globalAlpha = 1;
      g.particles.forEach((p: Rect) => { ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1); ctx.fillStyle = p.color; const x = snap(p.x), y = snap(p.y), size = Math.max(3, snap(p.size)); if (p.kind === "spark") { ctx.fillRect(x, y, size, 3); ctx.fillRect(x, y, 3, size); } else ctx.fillRect(x, y, size, size); }); ctx.globalAlpha = 1;
      if (g.drones > 0) { ctx.fillStyle = "#31F7FF"; ctx.fillRect(Math.round(g.playerX - 23), PY + 8, 14, 5); }
      if (g.drones > 1) { ctx.fillStyle = "#31F7FF"; ctx.fillRect(Math.round(g.playerX + PW + 9), PY + 8, 14, 5); }
      drawShip(ctx, Math.round(g.playerX), PY, g.shield, g.laser > 0 || g.overdrive > 0);
      ctx.fillStyle = "#31F7FF"; ctx.fillRect(18, H - 38, W - 36, 2);
      ctx.font = "11px monospace"; ctx.textAlign = "center";
      g.popups.forEach((p: Rect) => { ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1); ctx.fillStyle = p.color; ctx.fillText(p.text, snap(p.x), snap(p.y)); }); ctx.globalAlpha = 1;
      ctx.textAlign = "right"; ctx.font = "10px monospace";
      g.feed.forEach((f: Rect, i: number) => { ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, W - 18, 82 + i * 13); }); ctx.globalAlpha = 1; ctx.textAlign = "left";
      if (g.messageTimer > 0) { ctx.textAlign = "center"; ctx.font = "15px monospace"; ctx.fillStyle = "#FFE85C"; ctx.fillText(g.message, W / 2, H - 102); ctx.textAlign = "left"; }
      if (g.flash > 0) { ctx.globalAlpha = Math.min(0.55, g.flash * 2.2); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(-8, -8, W + 16, H + 16); ctx.globalAlpha = 1; }
      if (g.status !== "playing") {
        ctx.fillStyle = "rgba(7,0,14,0.78)"; ctx.fillRect(-8, -8, W + 16, H + 16); ctx.textAlign = "center";
        ctx.fillStyle = g.status === "paused" ? "#31F7FF" : g.status === "title" ? "#FFE85C" : "#FF4FD8"; ctx.font = g.status === "title" ? "24px monospace" : "28px monospace";
        ctx.fillText(g.status === "paused" ? "PAUSED" : g.status === "title" ? "NEON INVADERS DX" : "GAME OVER", W / 2, H / 2 - 34);
        ctx.fillStyle = "#FFE85C"; ctx.font = "14px monospace"; ctx.fillText(g.status === "title" ? "PIXEL DELUXE EDITION" : `FINAL SCORE ${g.score}`, W / 2, H / 2 - 4);
        ctx.fillStyle = "#31F7FF"; ctx.fillText(g.status === "paused" ? "TAP PAUSE TO RESUME" : g.status === "title" ? "TAP START TO PLAY" : "TAP RESTART", W / 2, H / 2 + 28);
        ctx.fillStyle = "#7CFF6B"; ctx.font = "11px monospace"; if (g.status === "title") ctx.fillText("DRONES - LIGHTNING - METEORS - BOSS WAVES", W / 2, H / 2 + 54); ctx.textAlign = "left";
      }
      ctx.restore();

      uiTimer += rawDt; if (uiTimer > 0.12) { uiTimer = 0; syncUi(); }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="app">
      <main className="cabinet">
        <div className="topbar">
          <span>NEON INVADERS DX</span>
          <span>{ui.status === "playing" ? "LIVE" : ui.status === "paused" ? "PAUSED" : ui.status === "title" ? "INSERT COIN" : "GAME OVER"}</span>
        </div>
        <canvas ref={canvasRef} width={W} height={H} onPointerDown={(e) => {
          if (gameRef.current.status === "gameover" || gameRef.current.status === "title") startGame();
          e.currentTarget.setPointerCapture(e.pointerId);
        }} />
        <section className="stats">
          <div className="stat">Score<span>{ui.score}</span></div>
          <div className="stat">Best<span>{ui.highScore}</span></div>
          <div className="stat">Lives<span>{ui.lives}</span></div>
          <div className="stat">Bombs<span>{ui.bombs}</span></div>
        </section>
        <section className="controls">
          <button onPointerDown={() => (touchDirRef.current = -1)} onPointerUp={() => (touchDirRef.current = 0)} onPointerCancel={() => (touchDirRef.current = 0)} onPointerLeave={() => (touchDirRef.current = 0)}>LEFT</button>
          <button className="fire" onPointerDown={tapFire}>FIRE</button>
          <button className="bomb" onPointerDown={tapBomb}>BOMB</button>
          <button onPointerDown={() => (touchDirRef.current = 1)} onPointerUp={() => (touchDirRef.current = 0)} onPointerCancel={() => (touchDirRef.current = 0)} onPointerLeave={() => (touchDirRef.current = 0)}>RIGHT</button>
        </section>
        <section className="actions">
          <button onClick={togglePause}>{ui.status === "title" ? "Start" : "Pause"}</button>
          <button onClick={startGame}>Restart</button>
        </section>
        <p className="help">Drones, chain lightning, gravity wells, boss laser warnings, rift-zone waves, perfect-wave bonuses, meteors, shields and Nova Bombs. Keyboard: A/D, Space, X/B, P.</p>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<RetroSpaceInvaders />);
