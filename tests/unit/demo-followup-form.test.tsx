jest.mock('@/lib/dashboard/api-client', () => ({ DashboardApiClient: jest.fn() }));
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardApiClient } from '@/lib/dashboard/api-client';
import DemoFollowupForm from '@/components/dashboard/commercial/DemoFollowupForm';

it('announces failure and retries with the same request identity before reporting success', async () => {
	const post = jest
		.fn()
		.mockRejectedValueOnce(new Error('offline'))
		.mockResolvedValueOnce({ ok: true });
	(DashboardApiClient as jest.Mock).mockImplementation(() => ({ post }));
	const { container } = render(
		<DemoFollowupForm
			inventory={[
				{ slug: 'demo-xv-celestial-blue', title: 'Celestial Blue', eventType: 'xv' },
			]}
		/>,
	);
	fireEvent.change(screen.getByLabelText('Código de oportunidad'), {
		target: { value: 'CM-ABC123' },
	});
	fireEvent.submit(container.querySelector('form')!);
	await waitFor(() =>
		expect(screen.getByRole('alert')).toHaveTextContent('No se pudo confirmar'),
	);
	fireEvent.submit(container.querySelector('form')!);
	await waitFor(() =>
		expect(screen.getByRole('status')).toHaveTextContent('Registro confirmado'),
	);
	expect(post).toHaveBeenCalledTimes(2);
	expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
	expect(post.mock.calls[0][1]).not.toHaveProperty('phone');
});
