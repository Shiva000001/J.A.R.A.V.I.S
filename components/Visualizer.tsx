
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

    const sphereParticles: any[] = [];
    const NUM_SPHERE_PARTICLES = 300;
    for (let i = 0; i < NUM_SPHERE_PARTICLES; i++) {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        const r = 120;
        sphereParticles.push({
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi),
            baseR: r,
            size: 0.5 + Math.random() * 1.5,
        });
    }

    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const resizeCanvas = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let time = 0;

    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);
      time += 0.006;
      
      const { width, height } = canvas.getBoundingClientRect();
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Smooth Color Interpolation
      for(let i=0; i<3; i++) {
          currentColor.current[i] += (targetColor.current[i] - currentColor.current[i]) * 0.04;
      }
      const [r, g, b] = currentColor.current.map(Math.round);
      const colorMain = `rgb(${r}, ${g}, ${b})`;
      const colorFaint = `rgba(${r}, ${g}, ${b}, 0.15)`;
      const colorGlow = `rgba(${r}, ${g}, ${b}, 0.6)`;

      if (analyserNode) {
        analyserNode.getByteFrequencyData(dataArray);
      } else {
        dataArray.fill(0);
      }
      
      const averageFreq = dataArray.reduce((acc, v) => acc + v, 0) / dataArray.length;
      const boost = averageFreq / 255; 
      const scale = 1 + boost * 0.7;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Core Particle Sphere
      const rotationY = time * 1.2;
      const rotationX = time * 0.4;
      
      sphereParticles.forEach((p, i) => {
          // 3D Rotations
          let x1 = p.x * Math.cos(rotationY) - p.z * Math.sin(rotationY);
          let z1 = p.z * Math.cos(rotationY) + p.x * Math.sin(rotationY);
          
          let y1 = p.y * Math.cos(rotationX) - z1 * Math.sin(rotationX);
          let z2 = z1 * Math.cos(rotationX) + p.y * Math.sin(rotationX);
          
          // Frequency-based pulsation
          const fIdx = i % 32;
          const fVal = dataArray[fIdx] / 255;
          const currentR = p.baseR * (1 + fVal * 0.6 * boost);

          const dist = Math.sqrt(x1*x1 + y1*y1 + z2*z2);
          if (dist > 0) {
              x1 = (x1 / dist) * currentR;
              y1 = (y1 / dist) * currentR;
              z2 = (z2 / dist) * currentR;
          }

          const fov = 400;
          const proj = fov / (fov + z2);
          const x2d = x1 * proj;
          const y2d = y1 * proj;
          const opacity = Math.max(0.1, (z2 + p.baseR) / (2 * p.baseR));

          ctx.beginPath();
          ctx.arc(x2d, y2d, p.size * proj * (1 + boost), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          ctx.fill();
      });

      // Arc Rings
      ctx.lineWidth = 1.5;
      
      // Ring 1 (Inner Rotating)
      ctx.rotate(time);
      ctx.beginPath();
      ctx.arc(0, 0, 150 * scale, 0, Math.PI * 0.8);
      ctx.strokeStyle = colorGlow;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(0, 0, 150 * scale, Math.PI, Math.PI * 1.8);
      ctx.strokeStyle = colorGlow;
      ctx.stroke();
      ctx.rotate(-time);

      // Ring 2 (Outer Counter-Rotating)
      ctx.rotate(-time * 0.5);
      ctx.beginPath();
      ctx.setLineDash([10, 20]);
      ctx.arc(0, 0, 190 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = colorFaint;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(time * 0.5);

      // Frequency Bars
      const bars = 72;
      const baseRadius = 210;
      for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2;
          const val = dataArray[Math.floor((i / bars) * (dataArray.length / 2))];
          const len = (val / 255) * 60 * scale;
          
          const xS = Math.cos(angle) * baseRadius;
          const yS = Math.sin(angle) * baseRadius;
          const xE = Math.cos(angle) * (baseRadius + len);
          const yE = Math.sin(angle) * (baseRadius + len);

          ctx.beginPath();
          ctx.moveTo(xS, yS);
          ctx.lineTo(xE, yE);
          ctx.strokeStyle = colorMain;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
      }

      // Center Core Glow
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 100 * scale);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
      grad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.1)`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 100 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };
    
    draw();

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [analyserNode]);


  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full max-w-[800px] max-h-[800px]" />
    </div>
  );
};

export default Visualizer;
