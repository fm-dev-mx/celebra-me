import {
	deletedNoteSlugs,
	findUnretiredNotes,
	retroLogSlugs,
} from '../../scripts/validate-invitation-note-retirement.ts';

const standards = `# Invitation Standards

## Avoid

| Id  | Avoid | Example            |
| --- | ----- | ------------------ |
| A1  | Cards | \`naydelin-paredes\` |

## Retro log

| Slug                 | Event date | Retro date | Entries |
| -------------------- | ---------- | ---------- | ------- |
| \`melissa-y-luis-osmar\` | 2026-09-20 | 2026-10-20 | R1, R2  |
| america              | 2026-10-25 | 2026-11-25 | None new |
`;

describe('deletedNoteSlugs', () => {
	it('keeps only invitation notes', () => {
		expect(
			deletedNoteSlugs([
				'docs/invitations/naydelin-paredes.md',
				'docs/invitations/README.md',
				'docs/invitations/assets/photo.md',
				'docs/core/architecture.md',
			]),
		).toEqual(['naydelin-paredes']);
	});
});

describe('retroLogSlugs', () => {
	it('reads slugs from the retro log only', () => {
		expect([...retroLogSlugs(standards)].sort()).toEqual(['america', 'melissa-y-luis-osmar']);
	});

	it('returns nothing when the section is missing', () => {
		expect(retroLogSlugs('# Invitation Standards\n').size).toBe(0);
	});
});

describe('findUnretiredNotes', () => {
	it('blocks a deleted note without a retro row', () => {
		expect(
			findUnretiredNotes(
				['docs/invitations/naydelin-paredes.md', 'docs/invitations/america.md'],
				standards,
			),
		).toEqual(['naydelin-paredes']);
	});

	it('passes when every deleted note has a retro row', () => {
		expect(findUnretiredNotes(['docs/invitations/melissa-y-luis-osmar.md'], standards)).toEqual(
			[],
		);
	});
});
