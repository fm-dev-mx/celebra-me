import React from 'react';
import { motion } from 'framer-motion';

interface Testimonial {
	name: string;
	text: string;
	role?: string;
}

interface Props {
	title: string;
	testimonials: Testimonial[];
}

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.2,
		},
	},
} as const;

const itemVariants = {
	hidden: { opacity: 0, y: 30 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.8,
			ease: [0.22, 1, 0.36, 1] as const,
		},
	},
} as const;

const TestimonialsCarousel: React.FC<Props> = ({ testimonials = [] }) => {
	if (!testimonials || testimonials.length === 0) return null;

	return (
		<div className="testimonials">
			<motion.div
				className="testimonials__grid"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: '-100px' }}
			>
				{testimonials.map((t, i) => (
					<motion.div key={i} className="testimonials__card" variants={itemVariants}>
						<span className="testimonials__quote-icon">“</span>
						<p className="testimonials__text">“{t.text}”</p>
						<div className="testimonials__footer">
							<span className="testimonials__name">{t.name}</span>
							{t.role && <span className="testimonials__role">{t.role}</span>}
						</div>
					</motion.div>
				))}
			</motion.div>
		</div>
	);
};

export default TestimonialsCarousel;
