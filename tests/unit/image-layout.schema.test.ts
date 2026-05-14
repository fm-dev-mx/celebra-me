import { focalPointSchema } from '@/lib/schemas/content/shared.schema';

describe('focalPointSchema', () => {
	const validCases = [
		'50% 50%',
		'10% 90%',
		'0% 0%',
		'100% 100%',
		'50.5% 20.2%',
		'center center',
		'left top',
		'right bottom',
		'center 20%',
		'10% top',
		'center',
		'left',
		'right',
		'10%',
	];

	const invalidCases = [
		'broken',
		'100 100',
		'50% 50% extra',
		'top left center',
		'',
		'10%% 20%',
		'-10% 50%',
		'50%center',
		'centerbottom',
		'top left',
	];

	it('accepts valid CSS object-position strings', () => {
		const failures: string[] = [];
		for (const val of validCases) {
			const result = focalPointSchema.safeParse(val);
			if (!result.success) {
				failures.push(`"${val}" should be valid but failed: ${result.error.message}`);
			}
		}
		expect(failures).toHaveLength(0);
		if (failures.length > 0) {
			throw new Error(`Valid cases failed:\n${failures.join('\n')}`);
		}
	});

	it('rejects invalid strings', () => {
		const failures: string[] = [];
		for (const val of invalidCases) {
			const result = focalPointSchema.safeParse(val);
			if (result.success) {
				failures.push(`"${val}" should be invalid but passed`);
			}
		}
		expect(failures).toHaveLength(0);
		if (failures.length > 0) {
			throw new Error(`Invalid cases failed:\n${failures.join('\n')}`);
		}
	});
});
