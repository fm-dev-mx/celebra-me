import { render, screen } from '@testing-library/react';
import ContactForm from '../../src/components/ui/ContactForm';

describe('ContactForm Component', () => {
	it('should render all form fields', () => {
		render(<ContactForm />);

		expect(screen.getByText('Nombre')).toBeInTheDocument();
		expect(screen.getByText('Email')).toBeInTheDocument();
		expect(screen.getByText('Mensaje')).toBeInTheDocument();

		expect(screen.getByRole('button', { name: /Enviar/i })).toBeInTheDocument();
	});

	it('should render inputs with correct types', () => {
		const { container } = render(<ContactForm />);

		expect(container.querySelector('input[type="text"]')).toBeInTheDocument();
		expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
		expect(container.querySelector('textarea')).toBeInTheDocument();
	});
});
