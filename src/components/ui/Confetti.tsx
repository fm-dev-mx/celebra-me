import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfettiPiece {
	id: number;
	x: number;
	y: number;
	rotation: number;
	vx: number;
	vy: number;
	colorClass: string;
	sizeClass: string;
	shapeClass: string;
}

const COLOR_CLASSES = [
	'confetti-piece--accent',
	'confetti-piece--surface',
	'confetti-piece--emphasis',
	'confetti-piece--contrast',
	'confetti-piece--neutral',
] as const;

const SIZE_CLASSES = [
	'confetti-piece--xs',
	'confetti-piece--sm',
	'confetti-piece--md',
	'confetti-piece--lg',
] as const;

const SHAPE_CLASSES = ['confetti-piece--round', 'confetti-piece--square'] as const;

const pickRandom = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

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
				rotation: Math.random() * 360,
				vx: (Math.random() - 0.5) * 40,
				vy: (Math.random() - 0.8) * 40,
				colorClass: pickRandom(COLOR_CLASSES),
				sizeClass: pickRandom(SIZE_CLASSES),
				shapeClass: pickRandom(SHAPE_CLASSES),
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
					className={`confetti-piece ${p.colorClass} ${p.sizeClass} ${p.shapeClass}`}
				/>
			))}
		</AnimatePresence>
	);
};
