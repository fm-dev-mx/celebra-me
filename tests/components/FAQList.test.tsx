// tests/components/FAQList.test.tsx
// Component tests for FAQList

import { render, screen } from '@testing-library/react';
import FAQList from '@/components/ui/FAQList';

describe('FAQList Component', () => {
	const sampleFaqs = [
		{ question: '¿Cuánto cuesta el servicio?', answer: 'Los precios varían según el paquete.' },
		{ question: '¿Cuánto tiempo tarda?', answer: 'Aproximadamente 5-7 días hábiles.' },
		{ question: '¿Puedo personalizar todo?', answer: 'Sí, todo es 100% personalizable.' },
	];

	describe('Rendering', () => {
		it('should render all FAQ items', () => {
			render(<FAQList faqs={sampleFaqs} />);

			sampleFaqs.forEach((faq) => {
				expect(screen.getByText(faq.question)).toBeInTheDocument();
				expect(screen.getByText(faq.answer)).toBeInTheDocument();
			});
		});

		it('should render questions as headings', () => {
			render(<FAQList faqs={sampleFaqs} />);

			const headings = screen.getAllByRole('heading', { level: 4 });
			expect(headings).toHaveLength(sampleFaqs.length);
		});

		it('should render answers as paragraphs', () => {
			render(<FAQList faqs={sampleFaqs} />);

			sampleFaqs.forEach((faq) => {
				const answer = screen.getByText(faq.answer);
				expect(answer.tagName).toBe('P');
			});
		});
	});

	describe('Empty State', () => {
		it('should render nothing when faqs array is empty', () => {
			const { container } = render(<FAQList faqs={[]} />);

			// Should have the wrapper div but no FAQ items
			expect(container.querySelectorAll('.mb-6')).toHaveLength(0);
		});

		it('should handle undefined faqs gracefully', () => {
			// @ts-expect-error - Testing edge case with undefined
			const { container } = render(<FAQList />);

			// Should not crash, render empty
			expect(container).toBeTruthy();
		});
	});

	describe('Single FAQ', () => {
		it('should render correctly with single FAQ item', () => {
			const singleFaq = [{ question: 'Only question?', answer: 'Only answer.' }];

			render(<FAQList faqs={singleFaq} />);

			expect(screen.getByText('Only question?')).toBeInTheDocument();
			expect(screen.getByText('Only answer.')).toBeInTheDocument();
		});
	});

	describe('Styling', () => {
		it('should apply correct container classes', () => {
			const { container } = render(<FAQList faqs={sampleFaqs} />);

			const wrapper = container.firstChild;
			expect(wrapper).toHaveClass('max-w-3xl', 'mx-auto', 'py-8');
		});

		it('should apply border styling to FAQ items', () => {
			const { container } = render(<FAQList faqs={sampleFaqs} />);

			const items = container.querySelectorAll('.border-b');
			expect(items.length).toBeGreaterThan(0);
		});
	});

	describe('Content Integrity', () => {
		it('should preserve special characters in questions', () => {
			const specialFaqs = [
				{ question: '¿Cómo funciona el pago?', answer: 'Aceptamos tarjetas.' },
			];

			render(<FAQList faqs={specialFaqs} />);

			expect(screen.getByText('¿Cómo funciona el pago?')).toBeInTheDocument();
		});

		it('should preserve HTML entities in answers', () => {
			const entityFaqs = [
				{ question: 'Legal', answer: '© 2025 Celebra-me. Todos los derechos reservados.' },
			];

			render(<FAQList faqs={entityFaqs} />);

			expect(screen.getByText(/© 2025 Celebra-me/)).toBeInTheDocument();
		});
	});
});
