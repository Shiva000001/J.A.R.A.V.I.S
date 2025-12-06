
import React, { useRef, useEffect } from 'react';
import { Emotion } from '../types';

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
  emotion: Emotion;
}

const emotionColors: Record<Emotion, [number, number, number]> = {
  [Emotion.NEUTRAL]: [6, 182, 212], // cyan-500
  [Emotion.HAPPY]: [234, 179, 8], // yellow-500
  [Emotion.SARCASTIC]: [168, 85, 247], // purple-500
  [Emotion.WITTY]: [236, 72, 153], // pink-500
  [Emotion.HELPFUL]: [34, 197, 94], // green-500
  [Emotion.THINKING]: [59, 130, 246], // blue-500
};

const Visualizer: React.FC<VisualizerProps> = ({ analyserNode, emotion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const currentColor = useRef<[number, number, number]>([...emotionColors.NEUTRAL]);
  const targetColor = useRef<[number, number, number]>([...emotionColors.NEUTRAL]);

  useEffect(() => {
    targetColor.current = emotionColors[emotion] || emotionColors.NEUTRAL;
  }, [emotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize 3D Sphere Particles
    const sphereParticles: any[] = [];
    const NUM_SPHERE_PARTICLES = 400;
    for (let i = 0; i < NUM_SPHERE_PARTICLES; i++) {
        // Uniform distribution on sphere surface
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        const r = 100; // Base radius
        sphereParticles.push({
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi),
            baseR: r,
            size: 1 + Math.random(),
        });
    }

    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 0;
    const dataArray = analyserNode ? new Uint8Array(bufferLength) : new Uint8Array(0);

    const resizeCanvas = () => {
        const { devicePixelRatio = 1 } = window;
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let time = 0;

    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);
      time += 0.005;
      
      const { width, height } = canvas.getBoundingClientRect();
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Color transition
      for(let i=0; i<3; i++) {
          currentColor.current[i] += (targetColor.current[i] - currentColor.current[i]) * 0.05;
      }
      const [r, g, b] = currentColor.current.map(Math.round);
      const colorStyle = `rgb(${r}, ${g}, ${b})`;
      const faintColorStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
      const glowStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;

      if (analyserNode) {
        analyserNode.getByteFrequencyData(dataArray);
      }
      
      // Calculate Audio Metrics
      const averageFrequency = dataArray.length > 0 
        ? dataArray.reduce((a, b) => a + b, 0) / dataArray.length 
        : 0;
      const boost = averageFrequency / 255; // 0 to 1
      const scale = 1 + boost * 0.5;

      ctx.save();
      ctx.translate(centerX, centerY);

      // --- LAYER 1: 3D ROTATING SPHERE ---
      const rotationSpeed = time * 2;
      sphereParticles.forEach(p => {
          // Rotate around Y axis
          let x1 = p.x * Math.cos(rotationSpeed) - p.z * Math.sin(rotationSpeed);
          let z1 = p.z * Math.cos(rotationSpeed) + p.x * Math.sin(rotationSpeed);
          
          // Rotate around X axis
          let y1 = p.y * Math.cos(rotationSpeed * 0.5) - z1 * Math.sin(rotationSpeed * 0.5);
          let z2 = z1 * Math.cos(rotationSpeed * 0.5) + p.y * Math.sin(rotationSpeed * 0.5);
          
          // Audio Reactive Expansion
          // Map particle index to frequency bin
          // Use a few bins for this to not look too chaotic
          const freqIndex = Math.floor(Math.abs(p.y) % 50); 
          const freqVal = dataArray.length > 0 ? dataArray[freqIndex] / 255 : 0;
          const currentR = p.baseR * (1 + freqVal * 0.8 * boost); 

          // Re-normalize position to new radius
          const dist = Math.sqrt(x1*x1 + y1*y1 + z2*z2);
          if (dist > 0) {
              x1 = (x1 / dist) * currentR;
              y1 = (y1 / dist) * currentR;
              z2 = (z2 / dist) * currentR;
          }

          // Projection (weak perspective)
          const fov = 300;
          const scaleProj = fov / (fov + z2);
          const x2d = x1 * scaleProj;
          const y2d = y1 * scaleProj;
          const alpha = (z2 + p.baseR) / (2 * p.baseR); // Fade back particles

          if (alpha > 0) {
              ctx.beginPath();
              ctx.arc(x2d, y2d, p.size * scaleProj, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
              ctx.fill();
          }
      });

      // --- LAYER 2: ROTATING TECH RINGS ---
      
      // Ring 1: Fast dashed inner
      ctx.rotate(time);
      ctx.beginPath();
      ctx.arc(0, 0, 140 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = faintColorStyle;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 15]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(-time); // Reset rotation

      // Ring 2: Solid segments counter-rotating
      ctx.rotate(-time * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, 160 * scale, 0, Math.PI * 1.5);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.rotate(time * 0.5);

      // Ring 3: Static outer border with ticks
      ctx.beginPath();
      ctx.arc(0, 0, 220, 0, Math.PI * 2);
      ctx.strokeStyle = faintColorStyle;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ticks around the outer ring
      for (let i = 0; i < 36; i++) {
          const angle = (i / 36) * Math.PI * 2;
          const x1 = Math.cos(angle) * 215;
          const y1 = Math.sin(angle) * 215;
          const x2 = Math.cos(angle) * 225;
          const y2 = Math.sin(angle) * 225;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = colorStyle;
          ctx.lineWidth = 2;
          ctx.stroke();
      }

      // --- LAYER 3: FREQUENCY BARS (Circular) ---
      const bars = 60;
      const radius = 180;
      for (let i = 0; i < bars; i++) {
          const rad = (i / bars) * Math.PI * 2;
          const val = dataArray.length > 0 ? dataArray[i * 2] : 0;
          const barHeight = (val / 255) * 50 * scale;
          
          const xStart = Math.cos(rad) * radius;
          const yStart = Math.sin(rad) * radius;
          const xEnd = Math.cos(rad) * (radius + barHeight);
          const yEnd = Math.sin(rad) * (radius + barHeight);

          ctx.beginPath();
          ctx.moveTo(xStart, yStart);
          ctx.lineTo(xEnd, yEnd);
          ctx.strokeStyle = colorStyle;
          ctx.lineWidth = 2;
          ctx.stroke();
      }

      // --- LAYER 4: CENTRAL CORE GLOW ---
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 80 * scale);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.2)`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 80 * scale, 0, Math.PI * 2);
      ctx.fill();

      // --- LAYER 5: TEXT RING (Optional Fancy Decor) ---
      // Rotate slowly
      ctx.rotate(time * 0.2);
      ctx.font = '10px monospace';
      ctx.fillStyle = faintColorStyle;
      ctx.textAlign = 'center';
      const text = "SYSTEM ONLINE // AWAITING INPUT // AUDIO ANALYSIS // ";
      // Draw text along a circle arc (simplified by just drawing text at intervals)
      // Actually, standard canvas doesn't do circle text easily without loop.
      // Let's just draw 4 labels
      for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillText("/// JARVIS.SYS ///", 0, -240);
      }

      ctx.restore();
    };
    
    draw();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [analyserNode]);


  return (
    <div className={`absolute inset-0 w-full h-full pointer-events-none`}>
        <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default Visualizer;
