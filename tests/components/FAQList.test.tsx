// tests/components/FAQList.test.tsx
// Component tests for FAQList (Accordion Version)

import { render, screen, fireEvent } from '@testing-library/react';
import FAQList from '@/components/ui/FAQList';
import '@testing-library/jest-dom';

describe('FAQList Component (Accordion)', () => {
	const sampleFaqs = [
		{ question: '¿Cuánto cuesta el servicio?', answer: 'Los precios varían según el paquete.' },
		{ question: '¿Cuánto tiempo tarda?', answer: 'Aproximadamente 5-7 días hábiles.' },
	];

	describe('Rendering', () => {
		it('should render all FAQ questions', () => {
			render(<FAQList faqs={sampleFaqs} />);
			sampleFaqs.forEach((faq) => {
				expect(screen.getByText(faq.question)).toBeInTheDocument();
			});
		});

		it('should render answers as part of the document', () => {
			render(<FAQList faqs={sampleFaqs} />);
			sampleFaqs.forEach((faq) => {
				expect(screen.getByText(faq.answer)).toBeInTheDocument();
			});
		});

		it('should have aria-expanded="false" initially', () => {
			render(<FAQList faqs={sampleFaqs} />);
			const buttons = screen.getAllByRole('button');
			buttons.forEach((button) => {
				expect(button).toHaveAttribute('aria-expanded', 'false');
			});
		});
	});

	describe('Interactions', () => {
		it('should toggle aria-expanded when clicked', () => {
			render(<FAQList faqs={sampleFaqs} />);
			const firstQuestion = screen.getByText(sampleFaqs[0].question);
			const button = firstQuestion.closest('button');

			if (!button) throw new Error('Button not found');

			// Click to open
			fireEvent.click(button);
			expect(button).toHaveAttribute('aria-expanded', 'true');

			// Click to close
			fireEvent.click(button);
			expect(button).toHaveAttribute('aria-expanded', 'false');
		});

		it('should only allow one item to be open at once', () => {
			render(<FAQList faqs={sampleFaqs} />);
			const buttons = screen.getAllByRole('button');

			fireEvent.click(buttons[0]);
			expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');

			fireEvent.click(buttons[1]);
			expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
			expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
		});
	});

	describe('Empty State', () => {
		it('should render nothing when faqs array is empty', () => {
			const { container } = render(<FAQList faqs={[]} />);
			expect(container.firstChild).toBeNull();
		});

		it('should handle undefined faqs gracefully', () => {
			// @ts-expect-error - Testing edge case with undefined
			const { container } = render(<FAQList />);
			expect(container).toBeTruthy();
		});
	});

	describe('Styling', () => {
		it('should apply correct container classes', () => {
			const { container } = render(<FAQList faqs={sampleFaqs} />);
			const wrapper = container.firstChild;
			expect(wrapper).toHaveClass('faq-list-container');
		});
	});
});
