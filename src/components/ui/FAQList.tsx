import React, { useState } from 'react';

interface FAQ {
	question: string;
	answer: string;
}

interface Props {
	faqs: FAQ[];
	color?: string;
}

const FAQList: React.FC<Props> = ({ faqs = [] }) => {
	const [activeIndexes, setActiveIndexes] = useState<number[]>([]);

	const toggleAccordion = (index: number) => {
		setActiveIndexes((prev) =>
			prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
		);
	};

	if (!faqs || faqs.length === 0) return null;

	return (
		<div className="faq-list-container">
			{faqs.map((faq, i) => {
				const isOpen = activeIndexes.includes(i);
				return (
					<div key={i} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
						<button
							className="faq-question-btn"
							onClick={() => toggleAccordion(i)}
							aria-expanded={isOpen}
						>
							<span className="question-text">{faq.question}</span>
							<span className="chevron-icon">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<polyline points="6 9 12 15 18 9"></polyline>
								</svg>
							</span>
						</button>
						<div className="faq-answer-wrapper">
							<div className="faq-answer-content">
								<p className="answer-text">{faq.answer}</p>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default FAQList;
