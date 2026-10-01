import type { MemoriesWindowState } from '@/lib/memories/contract/catalog';
import {
	buildMemoriesPageCopy,
	buildMemoriesUploadLimitsCopy,
	buildMemoriesWindowCopy,
} from '@/lib/memories/copy';
import { buildSpace } from './fixtures';

const space = buildSpace();

function windowCopy(windowState: MemoriesWindowState): string | null {
	return buildMemoriesWindowCopy({
		windowState,
		timeZone: space.timeZone,
		uploadStartsAt: space.uploadStartsAt,
		uploadEndsAt: space.uploadEndsAt,
		retentionEndsAt: space.retentionEndsAt,
	});
}

describe('buildMemoriesWindowCopy', () => {
	it('returns null while the upload window is open', () => {
		expect(windowCopy('open')).toBeNull();
	});

	it.each<MemoriesWindowState>(['before', 'closed', 'expired', 'disabled'])(
		'returns a non-empty Spanish message for the %s state',
		(state) => {
			const copy = windowCopy(state);
			expect(typeof copy).toBe('string');
			expect((copy ?? '').trim().length).toBeGreaterThan(0);
		},
	);

	it('announces the opening date in the event time zone before the window opens', () => {
		const copy = windowCopy('before') ?? '';
		expect(copy).toContain('abre el');
		expect(copy).toContain('16 de octubre de 2026');
	});

	it('explains the closing and retention dates after the window closes', () => {
		const copy = windowCopy('closed') ?? '';
		expect(copy).toContain('cerró el');
		expect(copy).toContain('31 de octubre de 2026');
		expect(copy).toContain('30 de diciembre de 2026');
	});

	it('uses fixed messages for expired and disabled spaces', () => {
		expect(windowCopy('expired')).toBe('Los recuerdos de este evento ya no están disponibles.');
		expect(windowCopy('disabled')).toBe(
			'La carga de recuerdos no está disponible en este momento.',
		);
	});
});

describe('buildMemoriesPageCopy', () => {
	it('includes the event title in the title, subtitle and description', () => {
		const copy = buildMemoriesPageCopy({ eventTitle: 'Victoria y Roberto' });
		expect(copy.title).toBe('Recuerdos · Victoria y Roberto | Celebra-me');
		expect(copy.subtitle).toContain('Victoria y Roberto');
		expect(copy.description).toContain('Victoria y Roberto');
		expect(copy.robots).toBe('noindex');
	});
});

describe('buildMemoriesUploadLimitsCopy', () => {
	it('states the global video limits and the per-session video quota', () => {
		const copy = buildMemoriesUploadLimitsCopy(5);
		expect(copy).toContain('80 MiB');
		expect(copy).toContain('60 segundos');
		expect(copy).toContain('5 videos');
		expect(copy).toContain('20 MiB');
	});

	it('reflects a different per-session quota', () => {
		expect(buildMemoriesUploadLimitsCopy(10)).toContain('10 videos');
	});
});
