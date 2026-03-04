import { useEffect, useRef } from 'react';

/*
 * Compact 2D Simplex Noise — adapted from Stefan Gustavson's implementation.
 * Used for noise-based particle drift and neural thread distortion.
 */
const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
const PERM = new Uint8Array(512);
const PERM_MOD = new Uint8Array(512);
(() => {
  const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255];
    PERM_MOD[i] = PERM[i] % 8;
  }
})();

function noise2D(x, y) {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const X0 = i - t, Y0 = j - t;
  const x0 = x - X0, y0 = y - Y0;
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) { t0 *= t0; const g = GRAD[PERM_MOD[ii + PERM[jj]]]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) { t1 *= t1; const g = GRAD[PERM_MOD[ii + i1 + PERM[jj + j1]]]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) { t2 *= t2; const g = GRAD[PERM_MOD[ii + 1 + PERM[jj + 1]]]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
  return 70 * (n0 + n1 + n2);
}

const EnergyGalaxyBackground = () => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;

    const resize = () => {
      W = canvas.width = canvas.parentElement.offsetWidth;
      H = canvas.height = canvas.parentElement.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ═══ LAYER 1: AMBIENT INTELLIGENCE FIELD ═══
    // Noise-based drift particles, 80-120 count, 1-3px, fade in/out
    const PARTICLE_COUNT = 100;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * (W || 1920),
      y: Math.random() * (H || 900),
      r: 1 + Math.random() * 2,                   // 1-3px
      noiseOffsetX: Math.random() * 1000,
      noiseOffsetY: Math.random() * 1000,
      noiseSpeed: 0.0003 + Math.random() * 0.0004, // 20-30 second cycle
      alpha: 0.2 + Math.random() * 0.4,            // 0.2-0.6
      fadePhase: Math.random() * Math.PI * 2,
      fadeSpeed: 0.008 + Math.random() * 0.012,     // gradual fade in/out
      blur: 2 + Math.random() * 4,                  // gaussian 2-6px
    }));

    // ═══ LAYER 2: NEURAL SIGNAL NETWORK ═══
    // Perlin noise distorted threads with travelling light pulses
    const THREAD_COUNT = 7;
    const threads = Array.from({ length: THREAD_COUNT }, (_, ti) => ({
      // Each thread: 8 control points across the width
      points: Array.from({ length: 8 }, (_, j) => ({
        baseX: (j / 7) * (W || 1920),
        baseY: (0.15 + (ti / (THREAD_COUNT - 1)) * 0.7) * (H || 900),
        noiseOffset: Math.random() * 500 + ti * 100,
      })),
      alpha: 0.08 + Math.random() * 0.12,
    }));

    // Signal pulses: 6-10 second travel time, rgba(255,180,80) colour
    const pulses = threads.map(() => ({
      t: Math.random(),
      speed: 1 / (360 + Math.random() * 240), // 6-10 second cycle at 60fps
      size: 4 + Math.random() * 3,
      alpha: 0.6 + Math.random() * 0.4,
    }));

    // ═══ LAYER 3: PLATFORM CONVERGENCE FIELD ═══
    // Radial glow behind BIQc node, 500px radius, 8 second pulse
    const CONVERGENCE_RADIUS = 500;

    let time = 0;

    const draw = () => {
      time++;
      const t = time / 60; // seconds
      ctx.clearRect(0, 0, W, H);

      // ── LAYER 3: CONVERGENCE GLOW (drawn first, behind everything) ──
      const gx = W * 0.5;
      const gy = H * 0.42;
      // 8-second pulse cycle: scale 1.0 → 1.05
      const pulsePhase = Math.sin((t / 8) * Math.PI * 2);
      const scale = 1 + pulsePhase * 0.05;
      const glowAlpha = 0.15 + pulsePhase * 0.03;

      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, CONVERGENCE_RADIUS * scale);
      grad.addColorStop(0, `rgba(255,140,40,${glowAlpha})`);
      grad.addColorStop(0.3, `rgba(255,106,0,${glowAlpha * 0.6})`);
      grad.addColorStop(0.6, `rgba(200,70,0,${glowAlpha * 0.2})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── LAYER 2: NEURAL SIGNAL THREADS ──
      threads.forEach((thread, ti) => {
        // Compute distorted points using Perlin noise
        const distortedPoints = thread.points.map((p, pi) => {
          const nx = noise2D(
            p.noiseOffset + t * 0.15,
            pi * 0.5 + ti * 3
          );
          const ny = noise2D(
            p.noiseOffset + 100 + t * 0.12,
            pi * 0.5 + ti * 3 + 50
          );
          return {
            x: p.baseX + nx * 40,
            y: p.baseY + ny * 50,
          };
        });

        // Draw smooth bezier curve through distorted points
        ctx.beginPath();
        ctx.moveTo(distortedPoints[0].x, distortedPoints[0].y);
        for (let i = 0; i < distortedPoints.length - 1; i++) {
          const curr = distortedPoints[i];
          const next = distortedPoints[i + 1];
          const cpx = (curr.x + next.x) / 2;
          const cpy = (curr.y + next.y) / 2;
          ctx.quadraticCurveTo(curr.x, curr.y, cpx, cpy);
        }
        const last = distortedPoints[distortedPoints.length - 1];
        ctx.lineTo(last.x, last.y);

        // Stroke: gradient #FF7A18 → #FF9C45 with outer glow
        ctx.strokeStyle = `rgba(255,122,24,${thread.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(255,140,40,0.25)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw gradient overlay for colour variation
        const gradLine = ctx.createLinearGradient(0, 0, W, 0);
        gradLine.addColorStop(0, `rgba(255,122,24,${thread.alpha * 0.8})`);
        gradLine.addColorStop(0.5, `rgba(255,156,69,${thread.alpha})`);
        gradLine.addColorStop(1, `rgba(255,122,24,${thread.alpha * 0.8})`);
        ctx.strokeStyle = gradLine;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(255,140,40,0.25)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Travelling light pulse along the thread (6-10 second cycle)
        const pulse = pulses[ti];
        pulse.t = (pulse.t + pulse.speed) % 1;
        // Interpolate position along the distorted path
        const totalPoints = distortedPoints.length - 1;
        const segFloat = pulse.t * totalPoints;
        const segIdx = Math.floor(segFloat);
        const segT = segFloat - segIdx;
        if (segIdx < totalPoints) {
          const px = distortedPoints[segIdx].x + (distortedPoints[segIdx + 1].x - distortedPoints[segIdx].x) * segT;
          const py = distortedPoints[segIdx].y + (distortedPoints[segIdx + 1].y - distortedPoints[segIdx].y) * segT;
          // Pulse glow
          const pg = ctx.createRadialGradient(px, py, 0, px, py, pulse.size * 4);
          pg.addColorStop(0, `rgba(255,180,80,${pulse.alpha})`);
          pg.addColorStop(0.4, `rgba(255,140,40,${pulse.alpha * 0.4})`);
          pg.addColorStop(1, 'transparent');
          ctx.fillStyle = pg;
          ctx.fillRect(px - pulse.size * 4, py - pulse.size * 4, pulse.size * 8, pulse.size * 8);
          // Bright core dot
          ctx.beginPath();
          ctx.arc(px, py, pulse.size * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,200,120,${pulse.alpha})`;
          ctx.fill();
        }
      });

      // ── LAYER 1: AMBIENT PARTICLES ──
      particles.forEach(p => {
        // Noise-based drift: extremely slow, 20-30 second cycle
        const noiseX = noise2D(p.noiseOffsetX + t * p.noiseSpeed * 60, 0);
        const noiseY = noise2D(0, p.noiseOffsetY + t * p.noiseSpeed * 60);
        p.x += noiseX * 0.3;
        p.y += noiseY * 0.25;

        // Wrap around
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;

        // Gradual fade in/out
        p.fadePhase += p.fadeSpeed;
        const fadeAlpha = p.alpha * (0.3 + 0.7 * Math.max(0, Math.sin(p.fadePhase)));

        if (fadeAlpha < 0.02) return; // skip invisible particles

        // Gaussian blur glow (simulated with radial gradient)
        const blurSize = p.r + p.blur;
        const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, blurSize);
        pg.addColorStop(0, `rgba(255,140,40,${fadeAlpha * 0.7})`);
        pg.addColorStop(0.3, `rgba(255,140,40,${fadeAlpha * 0.3})`);
        pg.addColorStop(1, 'transparent');
        ctx.fillStyle = pg;
        ctx.fillRect(p.x - blurSize, p.y - blurSize, blurSize * 2, blurSize * 2);

        // Core particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,140,40,${fadeAlpha})`;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none', zIndex: 0 }}
      data-testid="energy-galaxy-bg"
    />
  );
};

export default EnergyGalaxyBackground;
