import { parseDiskUsedBytes } from '@/lib/platform/server/supabase-usage';

describe('supabase disk parsing', () => {
	it('accepts the nested metrics envelope and flat figures alike', () => {
		expect(parseDiskUsedBytes({ metrics: { fs_used_bytes: 123, fs_size_bytes: 500 } })).toBe(
			123,
		);
		expect(parseDiskUsedBytes({ fs_used_bytes: 77 })).toBe(77);
	});

	it('blanks the meter instead of guessing an unrecognized payload', () => {
		expect(parseDiskUsedBytes({})).toBeNull();
		expect(parseDiskUsedBytes(null)).toBeNull();
		expect(parseDiskUsedBytes({ metrics: { fs_used_bytes: 'huge' } })).toBeNull();
		expect(parseDiskUsedBytes({ metrics: { fs_used_bytes: -5 } })).toBeNull();
	});
});
