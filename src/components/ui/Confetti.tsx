import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfettiPiece {
	id: number;
	x: number;
	y: number;
	color: string;
	size: number;
	rotation: number;
	vx: number;
	vy: number;
}

const COLORS = [
	'var(--color-action-accent)',
	'var(--color-surface-primary)',
	'var(--color-text-emphasis)',
	'var(--color-text-on-dark)',
	'var(--color-neutral-subtle)',
];

export const Confetti: React.FC<{ active: boolean; onComplete: () => void }> = ({
	active,
	onComplete,
}) => {
	const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

	useEffect(() => {
		if (active) {
			const newPieces = Array.from({ length: 50 }).map(() => ({
				id: Math.random(),
				x: 50, // Center
				y: 50,
				color: COLORS[Math.floor(Math.random() * COLORS.length)],
				size: Math.random() * 8 + 4,
				rotation: Math.random() * 360,
				vx: (Math.random() - 0.5) * 40,
				vy: (Math.random() - 0.8) * 40,
			}));
			setPieces(newPieces);
			const timer = setTimeout(() => {
				setPieces([]);
				onComplete();
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [active, onComplete]);

	return (
		<AnimatePresence>
			{pieces.map((p) => (
				<motion.div
					key={p.id}
					initial={{
						x: `${p.x}vw`,
						y: `${p.y}vh`,
						opacity: 1,
						scale: 1,
						rotate: p.rotation,
					}}
					animate={{
						x: `${p.x + p.vx}vw`,
						y: `${p.y + p.vy + 50}vh`,
						opacity: 0,
						scale: 0.5,
						rotate: p.rotation + 720,
					}}
					exit={{ opacity: 0 }}
					transition={{ duration: 2, ease: 'easeOut' }}
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						width: p.size,
						height: p.size,
						backgroundColor: p.color,
						zIndex: 9999,
						pointerEvents: 'none',
						borderRadius: Math.random() > 0.5 ? '50%' : '2px',
					}}
				/>
			))}
		</AnimatePresence>
	);
};
