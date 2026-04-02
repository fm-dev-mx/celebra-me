import {
	buildMfaQrImageSrc,
	pickLatestVerifiedTotpFactor,
	pickUnverifiedTotpFactors,
	renderMfaPanel,
	syncMfaSession,
} from '@/lib/client/mfa-setup';

describe('mfa setup client helpers', () => {
	it('builds a data url for raw svg QR payloads', () => {
		expect(buildMfaQrImageSrc('<svg viewBox="0 0 1 1"></svg>')).toBe(
			'data:image/svg+xml;utf-8,%3Csvg%20viewBox%3D%220%200%201%201%22%3E%3C%2Fsvg%3E',
		);
	});

	it('sorts verified and unverified totp factors by newest first', () => {
		const factors = [
			{
				id: 'old-verified',
				status: 'verified' as const,
				factor_type: 'totp',
				created_at: '2026-03-01T12:00:00.000Z',
			},
			{
				id: 'new-verified',
				status: 'verified' as const,
				factor_type: 'totp',
				created_at: '2026-03-20T12:00:00.000Z',
			},
			{
				id: 'stale-unverified',
				status: 'unverified' as const,
				factor_type: 'totp',
				created_at: '2026-03-05T12:00:00.000Z',
			},
			{
				id: 'fresh-unverified',
				status: 'unverified' as const,
				factor_type: 'totp',
				created_at: '2026-03-25T12:00:00.000Z',
			},
		];

		expect(pickLatestVerifiedTotpFactor(factors)?.id).toBe('new-verified');
		expect(pickUnverifiedTotpFactors(factors).map((factor) => factor.id)).toEqual([
			'fresh-unverified',
			'stale-unverified',
		]);
	});

	it('renders an enroll panel with QR and manual secret fallback', () => {
		document.body.innerHTML = `
			<div id="qr"></div>
			<button id="verify">Verificar</button>
			<h1 id="title"></h1>
			<p id="description"></p>
			<p id="hint"></p>
		`;

		const qrContainer = document.getElementById('qr') as HTMLElement;
		const verifyButton = document.getElementById('verify') as HTMLButtonElement;
		const titleEl = document.getElementById('title');
		const descriptionEl = document.getElementById('description');
		const hintEl = document.getElementById('hint');

		renderMfaPanel(
			{
				qrContainer,
				verifyButton,
				titleEl,
				descriptionEl,
				hintEl,
			},
			'enroll',
			'<svg viewBox="0 0 1 1"></svg>',
			'SECRET-123',
		);

		const image = qrContainer.querySelector('img');
		expect(image?.getAttribute('src')).toContain('data:image/svg+xml;utf-8,');
		expect(qrContainer).toHaveTextContent('SECRET-123');
		expect(verifyButton).toHaveTextContent('Verificar y activar');
	});

	it('posts elevated tokens to sync the verified mfa session', async () => {
		const fetchMock = global.fetch as jest.Mock;
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ ok: true }),
		} as Response);

		await syncMfaSession('access-token', 'refresh-token');

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/auth/sync-session',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					accessToken: 'access-token',
					refreshToken: 'refresh-token',
				}),
			}),
		);
	});

	it('surfaces backend sync-session errors', async () => {
		const fetchMock = global.fetch as jest.Mock;
		fetchMock.mockResolvedValueOnce({
			ok: false,
			json: async () => ({ message: 'Sync failed.' }),
		} as Response);

		await expect(syncMfaSession('access-token')).rejects.toThrow('Sync failed.');
	});
});
