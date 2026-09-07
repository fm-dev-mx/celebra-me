import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry';
import { getInvitationAssetSourceDir } from '../../scripts/provision/invitations/invitation-definition';

// Verified Production originals at 6081525e, observed with the 7c499aba Preview comparison.
const cases = [
	{
		slug: 'america-johana',
		key: 'heroDesktop',
		width: 1920,
		height: 1200,
		sha256: '1238c788d8d00f36c1ca86e67130f73e9886f5723fa1b843a873822b94fdc3c9',
	},
	{
		slug: 'ayrin-samantha-lerma-castro',
		key: 'hero',
		width: 1672,
		height: 941,
		sha256: '0a3775eab780aa321061e44124ded85a17fa7d10455a0d3c72900ed783861265',
	},
	{
		slug: 'ayrin-samantha-lerma-castro',
		key: 'heroMobile',
		width: 1365,
		height: 2048,
		sha256: '4a72428cd31e8953d3ce62e2617a8ba39af9d4d416dd4facba5ca576305692ab',
	},
	{
		slug: 'luna-y-estrella',
		key: 'hero',
		width: 1536,
		height: 2304,
		sha256: '03bd46e4ad32caca001d1ca9c50e1839e6d02191859feeb561bbfbcace21832d',
	},
	{
		slug: 'luna-y-estrella',
		key: 'heroMobile',
		width: 1536,
		height: 2304,
		sha256: '03bd46e4ad32caca001d1ca9c50e1839e6d02191859feeb561bbfbcace21832d',
	},
	{
		slug: 'luna-y-estrella',
		key: 'family',
		width: 1664,
		height: 2080,
		sha256: 'e14676140bccb14232bb2679d60b85e87a232e719038f258c475a0a1ef1b3123',
	},
	{
		slug: 'xareni-iyarit',
		key: 'hero',
		width: 941,
		height: 1672,
		sha256: '85a3c27546c12c2ecfc6826a66312fb7a3d91b09485da212a11a5423ef1aae73',
	},
	{
		slug: 'xareni-iyarit',
		key: 'heroMobile',
		width: 941,
		height: 1672,
		sha256: '85a3c27546c12c2ecfc6826a66312fb7a3d91b09485da212a11a5423ef1aae73',
	},
	{
		slug: 'xareni-iyarit',
		key: 'heroDesktop',
		width: 1672,
		height: 941,
		sha256: '21d3c5e1d383fa3b107ba876ec4f1e8df00be86030b2dd6ad6539fefcc017540',
	},
	{
		slug: 'cesar-ramses',
		key: 'thankYouPortrait',
		width: 1600,
		height: 2000,
		sha256: '8546d886151a750b63dbb4a1955b5b1ee38fc84908d152d01c2931ab16215672',
	},
];

test.each(cases)(
	'$slug keeps the verified $key original',
	({ slug, key, width, height, sha256 }) => {
		const definition = getInvitationDefinition(slug);
		const asset = definition.assets.find((entry) => entry.key === key);
		expect(asset).toBeDefined();
		if (!asset) throw new Error('Missing canonical original image');
		expect(asset.sourcePolicy).toBe('preserve');
		expect(asset.delivery).toEqual({ mode: 'original', width, height });
		const bytes = readFileSync(
			resolve(getInvitationAssetSourceDir(definition), asset.relativePath),
		);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
	},
);

test('Leah keeps the verified source shared by gallery and thank-you without changing renderer transforms', () => {
	const definition = getInvitationDefinition('leah-lexa');
	const asset = definition.assets.find((entry) => entry.key === 'gallery02');
	if (!asset) throw new Error('Missing shared gallery and thank-you source');
	expect(asset.sourcePolicy).toBe('preserve');
	expect(asset.delivery).toBeUndefined();
	const bytes = readFileSync(
		resolve(getInvitationAssetSourceDir(definition), asset.relativePath),
	);
	expect(createHash('sha256').update(bytes).digest('hex')).toBe(
		'04d072e6f9c25ac218580ad037700f82e3978aa11c76f40449e3558a3b8c6759',
	);
});
