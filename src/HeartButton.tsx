import { createEffect, createSignal, type VoidComponent } from "solid-js";
import { xorshift32 } from "./utils/xor-shift";

const particleCount = 50; // Each click produce 50 particles
const particleSpeed = 0.4; // 0.4 pixels per millisecond
const cleanupTime = 4500; // In millisecond

export const HeartButton: VoidComponent = () => {
  let canvas!: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  let canvasWidth: number;
  let canvasHeight: number;
  let particleStartX: number;
  let particleStartY: number;

  type Particle = {
    createdAt: number;
    size: number;
    hue: number;
    cosAngle: number;
    sinAngle: number;
    distance: number;
    twinkleFrequency: number;
    twinkleStartTime: number;
    drag: number;
  };

  let particles: Particle[] = [];

  const addParticles = () => {
    const now = performance.now();

    for (let i = 0; i < particleCount; i++) {
      const randomInt = xorshift32();
      particles.push({
        createdAt: now,
        size: 4 + (randomInt & 3), // 4 + Math.round(Math.random() * 3)
        hue: randomInt % 360, // Math.round(Math.random()) % 360
        cosAngle: Math.cos(randomInt), // Math.cos(angle) (pre-calculate this to avoid calculate over and over again the requestAnimationFrame)
        sinAngle: Math.sin(randomInt), // Math.cos(angle)
        distance: 0,
        twinkleFrequency: 4 + ((randomInt >> 3) & 3), // 4 + Math.round(Math.random() * 3)
        twinkleStartTime: now + 500 + (randomInt & 1023), // now + 500 + Math.round(Math.random() * 1023)
        drag: -0.00012 * (50 + (randomInt & 31)), // -0.00012 * (50 + Math.round(Math.random() * 31))
      });
    }
  };

  createEffect(function periodicallyCleanParticles(intervalId?: number) {
    if (isDrawing()) {
      if (intervalId) {
        clearInterval(intervalId);
      }

      return window.setInterval(() => {
        particles = particles.filter(
          (particle) => performance.now() - particle.createdAt < cleanupTime,
        );
      }, cleanupTime);
    }
  });

  // Make sure only call draw one time
  const [isDrawing, setIsDrawing] = createSignal<boolean>(false);

  const draw = () => {
    if (isDrawing()) return;
    if (particles.length === 0) return;

    setIsDrawing(true);
    _draw();
  };

  // Draw
  const endAngle = Math.PI * 2;

  let lastTimestamp = performance.now();

  const _draw = () => {
    if (particles.length === 0) {
      setIsDrawing(false);
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      return;
    }

    const now = performance.now();
    const deltaTime = now - lastTimestamp; // In millisecond
    lastTimestamp = now;

    const deltaDistance = particleSpeed * deltaTime;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];

      // Set distance
      const drag = Math.exp(particle.drag * deltaTime);
      particle.distance = (particle.distance + deltaDistance) * drag;

      // Convert angle and distance into (x, y) coordinate
      const x = particle.cosAngle * particle.distance;
      const y = particle.sinAngle * particle.distance;

      // Opacity
      let opacity = 1;
      const twinkleTime = (now - particle.twinkleStartTime) / 1000;
      if (twinkleTime > 0) {
        // Here's the twinkle function f(t) = -1/4 * t + cos(5t) / 2 + 0.5
        // -1/4 * t as the "base" function to move downward toward 0
        // cos(5 * t) is for fluctuation
        // the "/ 2 + 0.5" is to force cos(5t) fluctuate between 0 and 1
        opacity =
          -0.25 * twinkleTime +
          Math.cos(particle.twinkleFrequency * twinkleTime) / 2 +
          0.5;
      }

      ctx.beginPath();
      ctx.arc(
        particleStartX + x,
        particleStartY + y,
        particle.size,
        0,
        endAngle,
      );
      ctx.fillStyle = `hsl(${particle.hue}deg 55% 50% / ${opacity})`;
      ctx.fill();
    }

    window.requestAnimationFrame(_draw);
  };

  createEffect(function setupCanvas() {
    const dpr = window.devicePixelRatio;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(dpr, dpr);

    ctx = context;
    canvasWidth = width;
    canvasHeight = height;
    particleStartX = width / 2;
    particleStartY = height / 2;
  });

  return (
    <div class="relative size-max flex flex-wrap items-center justify-center">
      <button
        type="button"
        class="relative z-10 group bg-white/5 hover:bg-white/10 backdrop-blur-xs rounded-full p-4 cursor-pointer duration-200"
        onClick={() => {
          addParticles();
          draw();
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="42"
          height="42"
          viewBox="0 0 24 24"
          fill="#ff0000"
          stroke="#ff0000"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="translate-y-0.5 group-hover:scale-115 group-active:scale-95 ease-in-out duration-200"
        >
          <title>Heart</title>
          <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
        </svg>
      </button>

      <canvas ref={canvas} class="absolute z-0 w-96 h-96 bg-transparent" />
    </div>
  );
};
