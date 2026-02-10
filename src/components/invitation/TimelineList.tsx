import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import {
	WaltzIcon,
	DinnerIcon,
	ToastIcon,
	ChurchIcon,
	ReceptionIcon,
	PartyIcon,
	CakeIcon,
	PhotoIcon,
} from '@/components/common/icons/invitation';

// Types (should match internal TimelineItem logic or be shared)
type IconType =
	| 'waltz'
	| 'dinner'
	| 'toast'
	| 'cake'
	| 'party'
	| 'church'
	| 'reception'
	| 'music'
	| 'photo';

interface TimelineItemData {
	icon: IconType;
	label: string;
	description?: string;
	time: string;
}

interface TimelineListProps {
	items: TimelineItemData[];
}

// Icon Mapping
const Icons: Record<string, React.FC<{ size?: number | string }>> = {
	waltz: WaltzIcon,
	dinner: DinnerIcon,
	toast: ToastIcon,
	church: ChurchIcon,
	reception: ReceptionIcon,
	party: PartyIcon,
	cake: CakeIcon,
	music: WaltzIcon,
	photo: PhotoIcon,
};

import type { Variants } from 'framer-motion';

const listVariants: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.15,
		},
	},
};

const itemVariants: Variants = {
	hidden: { opacity: 0, scale: 0.9, y: 20 },
	visible: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: {
			duration: 0.6,
			ease: 'easeOut',
		},
	},
};

const TimelineList: React.FC<TimelineListProps> = ({ items }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ['start end', 'end end'],
	});

	const scaleY = useSpring(scrollYProgress, {
		stiffness: 100,
		damping: 30,
		restDelta: 0.001,
	});

	return (
		<div ref={containerRef} className="itinerary__items-wrapper">
			{/* Animated SVG Line */}
			<div className="itinerary__animated-line-container" aria-hidden="true">
				<svg width="2" height="100%" viewBox="0 0 2 100" preserveAspectRatio="none">
					<motion.path
						d="M 1 0 L 1 100"
						stroke="var(--color-primary, #d4af37)"
						strokeWidth="2"
						strokeDasharray="100"
						style={{
							pathLength: scaleY,
							filter: 'drop-shadow(0 0 8px var(--color-primary))',
						}}
					/>
				</svg>
			</div>

			<motion.div
				className="itinerary__items"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: '-100px' }}
				variants={listVariants}
			>
				{items.map((item, index) => {
					const align = index % 2 === 0 ? 'left' : 'right';
					return (
						<motion.div
							key={index}
							className={`itinerary__item itinerary__item--${align}`}
							variants={itemVariants}
						>
							<div className="itinerary__item-content">
								<div className="itinerary__item-time font-body">{item.time}</div>
								<h4 className="itinerary__item-label font-heading-formal">
									{item.label}
								</h4>
								{item.description && (
									<p className="itinerary__item-description font-body">
										{item.description}
									</p>
								)}
							</div>

							<div className="itinerary__item-icon-wrapper">
								<div className="itinerary__item-icon-inner">
									{React.createElement(Icons[item.icon] || Icons.reception, {
										size: 24,
									})}
								</div>
							</div>

							<div className="itinerary__item-dot" aria-hidden="true"></div>
						</motion.div>
					);
				})}
			</motion.div>
		</div>
	);
};

export default TimelineList;
