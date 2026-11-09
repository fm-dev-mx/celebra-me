import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import { isDevEnvironment } from '@/lib/environment';

describe('dashboard ErrorBoundary', () => {
	afterEach(() => jest.restoreAllMocks());

	it.each([false, true])('restricts error details to DEV (%s)', (dev) => {
		jest.mocked(isDevEnvironment).mockReturnValue(dev);
		const error = new Error('sensitive error message');
		error.stack = 'sensitive stack trace';
		const boundary = new ErrorBoundary({ children: null });
		boundary.state = {
			hasError: true,
			error,
			errorInfo: { componentStack: 'sensitive component stack' },
		};
		const { container } = render(boundary.render());
		expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
		for (const detail of [error.message, error.stack, 'sensitive component stack']) {
			if (dev) expect(container.textContent).toContain(detail);
			else expect(container.textContent).not.toContain(detail);
		}
		expect(container.querySelector('details') !== null).toBe(dev);
	});

	it('does not log technical details outside DEV', () => {
		jest.mocked(isDevEnvironment).mockReturnValue(false);
		const log = jest.spyOn(console, 'error').mockImplementation(() => {});
		const boundary = new ErrorBoundary({ children: null });
		jest.spyOn(boundary, 'setState').mockImplementation(() => {});
		boundary.componentDidCatch(new Error('sensitive'), { componentStack: 'private' });
		expect(log).not.toHaveBeenCalled();
	});
});
