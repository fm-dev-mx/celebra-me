import {
	buildAddStorageColumnsSql,
	findMissingStorageColumns,
	parseStorageCopyColumns,
} from '../../scripts/db/storage-metadata-columns';

const DUMP = `
SET row_security = off;

COPY storage.buckets (id, name, owner, public, "type", versioning_status) FROM stdin;
assets\tassets\t\\N\tt\tSTANDARD\tdisabled
\\.

COPY storage.objects (id, bucket_id, name, metadata) FROM stdin;
\\.
`;

describe('Storage metadata column alignment', () => {
	it('reads the column list of every Storage COPY block', () => {
		const columns = parseStorageCopyColumns(DUMP);
		expect(columns.get('buckets')).toEqual([
			'id',
			'name',
			'owner',
			'public',
			'type',
			'versioning_status',
		]);
		expect(columns.get('objects')).toEqual(['id', 'bucket_id', 'name', 'metadata']);
	});

	it('lists only columns the target table lacks', () => {
		const missing = findMissingStorageColumns(
			parseStorageCopyColumns(DUMP),
			new Map([
				['buckets', new Set(['id', 'name', 'owner', 'public', 'type'])],
				['objects', new Set(['id', 'bucket_id', 'name', 'metadata'])],
			]),
		);
		expect(missing).toEqual([{ table: 'buckets', column: 'versioning_status' }]);
		expect(buildAddStorageColumnsSql(missing)).toBe(
			'alter table storage."buckets" add column if not exists "versioning_status" text;',
		);
	});

	it('uses Supabase Storage types so row fingerprints match the source', () => {
		expect(
			buildAddStorageColumnsSql([
				{ table: 'objects', column: 'is_versioned' },
				{ table: 'buckets', column: 'lifecycle_configuration' },
				{ table: 'objects', column: 'future_column' },
			]),
		).toBe(
			[
				'alter table storage."objects" add column if not exists "is_versioned" boolean;',
				'alter table storage."buckets" add column if not exists "lifecycle_configuration" jsonb;',
				'alter table storage."objects" add column if not exists "future_column" text;',
			].join('\n'),
		);
	});

	it('fails closed when the dump names an unknown Storage table', () => {
		expect(() =>
			findMissingStorageColumns(
				parseStorageCopyColumns(DUMP),
				new Map([['buckets', new Set()]]),
			),
		).toThrow('storage.objects');
	});
});
