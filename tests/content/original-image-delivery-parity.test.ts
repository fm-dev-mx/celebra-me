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


// Verified original inputs keep their existing per-component delivery transformations.
const transformedSourceCases = [
	{ slug: 'cesar-ramses', key: 'family', sha256: '9da7243bdbcab641687d58120c40085cd909d92a7b8d7dd0956efd84ebaad0be' },
	{ slug: 'cesar-ramses', key: 'reception', sha256: '1c4454857538d1e3689161654b281b1cb1ad34a476f1bb379577c482ca56dc5b' },
	{ slug: 'cesar-ramses', key: 'gallery01', sha256: '20ef33a238fef140a3cda217bb8fa33de2593ed8b1ad8b0a0fc461d2b9d24a2c' },
	{ slug: 'cesar-ramses', key: 'gallery02', sha256: '0d2584921659f79b097b2218c27dc3e7579c57883bb32698f3c4bba92be6406a' },
	{ slug: 'cesar-ramses', key: 'gallery03', sha256: 'ae51c633df5f7b7cab1dcaab74492eefd8e00e0a8bc6a0fbffcbab4dc8ef217e' },
	{ slug: 'cesar-ramses', key: 'gallery04', sha256: '25c3c05679b0deef501c540196514a7679c788b542e8c55f8d75bfbc1af84dc6' },
	{ slug: 'cesar-ramses', key: 'gallery05', sha256: '7f5acd5f704460ba1cbccf3fe8ecd4792eac3e8ff2abbadb7cee643ae4313f5a' },
	{ slug: 'leah-lexa', key: 'hero', sha256: '9017a07e321aba00368daecc29f1cf50bf411b639b259af5a81967e32c8ab653' },
	{ slug: 'leah-lexa', key: 'family', sha256: '9f41838d0e0d4fa1ae5db990cd4e1f43335c2f5047db5afdc8d89076aa244317' },
	{ slug: 'leah-lexa', key: 'gallery01', sha256: '197557250e1b854fdbe6b25830e04f680ee5c3669c30267e2a542934017b67be' },
	{ slug: 'leah-lexa', key: 'gallery03', sha256: '8c1ef8bf56c9140c2708925c355076f7c46198a521f958799d5224a9676b5b4c' },
	{ slug: 'luna-y-estrella', key: 'thankYouPortrait', sha256: 'd244a06f469b72bf705b0353b09f4bd26be6d34856868432d2dcf169a5089bcf' },
 ];

test.each(transformedSourceCases)('$slug $key preserves the verified optimizer input', ({ slug, key, sha256 }) => {
	const definition = getInvitationDefinition(slug);
	const asset = definition.assets.find((entry) => entry.key === key)!;
	expect(asset.sourcePolicy).toBe('preserve');
	expect(asset.delivery).toBeUndefined();
	const bytes = readFileSync(resolve(getInvitationAssetSourceDir(definition), asset.relativePath));
	expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
});
