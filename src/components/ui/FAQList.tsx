import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDownIcon } from '@/components/common/icons/ui';

interface FAQ {
	question: string;
	answer: string;
}

interface Props {
	faqs: FAQ[];
	color?: string;
}

const FAQList: React.FC<Props> = ({ faqs = [] }) => {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	const toggleAccordion = (index: number) => {
		setActiveIndex(activeIndex === index ? null : index);
	};

	if (!faqs || faqs.length === 0) return null;

	return (
		<div className="faq-list-container">
			{faqs.map((faq, i) => {
				const isOpen = activeIndex === i;
				return (
					<div key={i} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
						<button
							className="faq-question-btn"
							type="button"
							onClick={() => toggleAccordion(i)}
							aria-expanded={isOpen}
						>
							<span className="question-text">{faq.question}</span>
							<motion.span
								className="chevron-icon"
								animate={{
									rotate: isOpen ? 180 : 0,
									scale: isOpen ? 1.2 : 1,
								}}
								transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
							>
								<ChevronDownIcon size={24} />
							</motion.span>
						</button>
						<motion.div
							initial={false}
							animate={isOpen ? 'open' : 'collapsed'}
							variants={{
								open: {
									opacity: 1,
									height: 'auto',
									marginTop: 0,
									transition: {
										height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
										opacity: { duration: 0.3, delay: 0.1 },
									},
								},
								collapsed: {
									opacity: 0,
									height: 0,
									marginTop: 0,
									transition: {
										height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
										opacity: { duration: 0.2 },
									},
								},
							}}
							className="faq-answer-wrapper"
						>
							<div className="faq-answer-content">
								<p className="answer-text">{faq.answer}</p>
							</div>
						</motion.div>
					</div>
				);
			})}
		</div>
	);
};

export default FAQList;
