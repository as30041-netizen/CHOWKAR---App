import React, { useEffect, useRef } from 'react';

export const Confetti: React.FC<{ duration?: number }> = ({ duration = 3000 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: any[] = [];
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

        for (let i = 0; i < 150; i++) {
            particles.push({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                w: Math.random() * 10 + 5,
                h: Math.random() * 5 + 5,
                bg: colors[Math.floor(Math.random() * colors.length)],
                dx: (Math.random() - 0.5) * 10,
                dy: (Math.random() - 0.5) * 10 - 5, // Upward bias
                rotation: Math.random() * 360,
                spin: (Math.random() - 0.5) * 10
            });
        }

        let animationId: number;
        let startTime = Date.now();

        const animate = () => {
            if (Date.now() - startTime > duration) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.x += p.dx;
                p.y += p.dy;
                p.dy += 0.2; // Gravity
                p.rotation += p.spin;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.bg;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [duration]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[100]"
        />
    );
};
