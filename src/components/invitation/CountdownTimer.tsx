import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
	eventDate: string;
}

interface TimeLeft {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

const calculateTimeLeft = (eventDate: string) => {
	const difference = +new Date(eventDate) - +new Date();
	if (difference > 0) {
		return {
			days: Math.floor(difference / (1000 * 60 * 60 * 24)),
			hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
			minutes: Math.floor((difference / 1000 / 60) % 60),
			seconds: Math.floor((difference / 1000) % 60),
		};
	}
	return { days: 0, hours: 0, minutes: 0, seconds: 0 };
};

const CountdownTimer: React.FC<Props> = ({ eventDate }) => {
	const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft(eventDate));

	useEffect(() => {
		const timer = setInterval(() => {
			setTimeLeft(calculateTimeLeft(eventDate));
		}, 1000);

		return () => clearInterval(timer);
	}, [eventDate]);

	const segments = [
		{ label: 'Días', value: timeLeft.days },
		{ label: 'Horas', value: timeLeft.hours },
		{ label: 'Minutos', value: timeLeft.minutes },
		{ label: 'Segundos', value: timeLeft.seconds },
	];

	return (
		<div className="countdown__timer">
			{segments.map((segment, index) => (
				<div
					key={segment.label}
					className="countdown__segment"
					style={{ '--index': index } as React.CSSProperties}
				>
					<div className="countdown__value-wrapper">
						<span className="rivet rivet--tl"></span>
						<span className="rivet rivet--tr"></span>
						<span className="rivet rivet--bl"></span>
						<span className="rivet rivet--br"></span>
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.span
								key={segment.value}
								initial={{ y: 20, opacity: 0 }}
								animate={{ y: 0, opacity: 1 }}
								exit={{ y: -20, opacity: 0 }}
								transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
								className="countdown__value"
								data-value={segment.value.toString().padStart(2, '0')}
							>
								{segment.value.toString().padStart(2, '0')}
							</motion.span>
						</AnimatePresence>
					</div>
					<span className="countdown__label">{segment.label}</span>
				</div>
			))}
		</div>
	);
};

export default CountdownTimer;
