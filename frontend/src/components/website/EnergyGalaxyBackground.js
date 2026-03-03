import { useEffect, useRef } from 'react';

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

    // Particles
    const PARTICLE_COUNT = 120;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * (W || 1920),
      y: Math.random() * (H || 900),
      r: 0.5 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2,
      alpha: 0.2 + Math.random() * 0.5,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
    }));

    // Neural threads — flowing curves
    const THREAD_COUNT = 9;
    const threads = Array.from({ length: THREAD_COUNT }, (_, i) => ({
      points: Array.from({ length: 5 }, (_, j) => ({
        x: (j / 4) * (W || 1920),
        y: (0.2 + Math.random() * 0.6) * (H || 900),
        baseY: (0.2 + Math.random() * 0.6) * (H || 900),
        phase: Math.random() * Math.PI * 2,
        amp: 20 + Math.random() * 60,
        freq: 0.003 + Math.random() * 0.005,
      })),
      alpha: 0.08 + Math.random() * 0.15,
      width: 0.5 + Math.random() * 1.5,
      hue: 25 + Math.random() * 15, // orange range
    }));

    // Signal pulses traveling along threads
    const pulses = threads.map(() => ({
      t: Math.random(),
      speed: 0.001 + Math.random() * 0.002,
      size: 3 + Math.random() * 4,
      alpha: 0.6 + Math.random() * 0.4,
    }));

    let frame = 0;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // Layer 1: Subtle grid
      ctx.strokeStyle = 'rgba(255,140,40,0.018)';
      ctx.lineWidth = 0.5;
      const gridSize = 72;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Layer 2: Central glow convergence
      const gx = W * 0.5;
      const gy = H * 0.42;
      const breathe = 1 + Math.sin(frame * 0.008) * 0.08;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 500 * breathe);
      grad.addColorStop(0, 'rgba(255,106,0,0.22)');
      grad.addColorStop(0.2, 'rgba(255,80,0,0.14)');
      grad.addColorStop(0.4, 'rgba(200,60,0,0.06)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Secondary glow
      const grad2 = ctx.createRadialGradient(gx, gy, 0, gx, gy, 300 * breathe);
      grad2.addColorStop(0, 'rgba(255,140,40,0.08)');
      grad2.addColorStop(0.5, 'rgba(255,100,0,0.03)');
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, W, H);

      // Layer 3: Neural energy threads
      threads.forEach((thread, ti) => {
        // Update points
        thread.points.forEach(p => {
          p.y = p.baseY + Math.sin(frame * p.freq + p.phase) * p.amp;
          p.x = Math.max(0, Math.min(W, p.x));
        });

        // Draw smooth curve
        ctx.beginPath();
        ctx.moveTo(thread.points[0].x, thread.points[0].y);
        for (let i = 0; i < thread.points.length - 1; i++) {
          const cp1x = thread.points[i].x + (thread.points[i + 1].x - thread.points[i].x) * 0.5;
          const cp1y = thread.points[i].y;
          const cp2x = thread.points[i].x + (thread.points[i + 1].x - thread.points[i].x) * 0.5;
          const cp2y = thread.points[i + 1].y;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, thread.points[i + 1].x, thread.points[i + 1].y);
        }
        ctx.strokeStyle = `hsla(${thread.hue},100%,55%,${thread.alpha})`;
        ctx.lineWidth = thread.width;
        ctx.shadowColor = `hsla(${thread.hue},100%,50%,0.4)`;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Signal pulse along thread
        const pulse = pulses[ti];
        pulse.t = (pulse.t + pulse.speed) % 1;
        const segIdx = Math.floor(pulse.t * (thread.points.length - 1));
        const segT = (pulse.t * (thread.points.length - 1)) - segIdx;
        if (segIdx < thread.points.length - 1) {
          const px = thread.points[segIdx].x + (thread.points[segIdx + 1].x - thread.points[segIdx].x) * segT;
          const py = thread.points[segIdx].y + (thread.points[segIdx + 1].y - thread.points[segIdx].y) * segT;
          const pglow = ctx.createRadialGradient(px, py, 0, px, py, pulse.size * 3);
          pglow.addColorStop(0, `rgba(255,140,40,${pulse.alpha})`);
          pglow.addColorStop(0.5, 'rgba(255,100,0,0.2)');
          pglow.addColorStop(1, 'transparent');
          ctx.fillStyle = pglow;
          ctx.fillRect(px - pulse.size * 3, py - pulse.size * 3, pulse.size * 6, pulse.size * 6);
          ctx.beginPath();
          ctx.arc(px, py, pulse.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,180,80,${pulse.alpha})`;
          ctx.fill();
        }
      });

      // Layer 4: Floating particles with glow
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        const a = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));
        // Particle glow
        const pgr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        pgr.addColorStop(0, `rgba(255,140,40,${a * 0.6})`);
        pgr.addColorStop(1, 'transparent');
        ctx.fillStyle = pgr;
        ctx.fillRect(p.x - p.r * 5, p.y - p.r * 5, p.r * 10, p.r * 10);
        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,${140 + Math.floor(Math.sin(p.pulse) * 40)},40,${a})`;
        ctx.fill();
      });

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const a = (1 - dist / 150) * 0.08;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,120,20,${a})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Horizontal energy wave bands
      const waveTime = frame * 0.003;
      for (let w = 0; w < 3; w++) {
        const waveY = H * (0.22 + w * 0.28);
        ctx.beginPath();
        for (let x = 0; x < W; x += 3) {
          const y = waveY + Math.sin(x * 0.003 + waveTime + w * 2) * 30 + Math.sin(x * 0.008 + waveTime * 1.5) * 10;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(255,${100 + w * 20},${10 + w * 5},${0.06 + w * 0.02})`;
        ctx.lineWidth = 1 + w * 0.5;
        ctx.shadowColor = `rgba(255,120,20,0.3)`;
        ctx.shadowBlur = 10 + w * 5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

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
