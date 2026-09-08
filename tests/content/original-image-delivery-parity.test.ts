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
	{ slug: 'america-johana', key: 'family', sha256: '8df8be6646ccb9d167065d0bbfc506dc923b24fec2249aceceffdb199a282141' },
	{ slug: 'america-johana', key: 'gallery01', sha256: 'e4359efa176932228a12864c2b81909625a2ac78b3197a401c59c9555e5d2154' },
	{ slug: 'america-johana', key: 'gallery02', sha256: '6eed484d2c70440a7911e2a218341f92f8cee792c837b65b2ad6250c8c77378a' },
	{ slug: 'america-johana', key: 'gallery04', sha256: '543bb4a36ae7877a84f2edd7aafdb85a1d7ec26952281ce37fe08839077a0078' },
	{ slug: 'america-johana', key: 'gallery05', sha256: '307632e5ad281f3e7acdfd5584996a868303b2680f690a8a5c9db2753ed67830' },
	{ slug: 'america-johana', key: 'gallery07', sha256: '9b4aca7c481e0972a5446186abfcdd763831e60dfebfb9785503da85e5d3bde6' },
	{ slug: 'america-johana', key: 'gallery08', sha256: '57f06bfe7db4315b132e7a411e5b15562767a8d9901cc40e5a52eb4b8ea26de8' },
	{ slug: 'america-johana', key: 'gallery09', sha256: '371880301c456f4f625107a791cebba398f3a264e23ef3e01b5eb5c2df5ad680' },
	{ slug: 'america-johana', key: 'gallery10', sha256: '096f7a8bb3bfddb703cfe5a454f2f3502a1c1787ac2cbd1a2026676afd95a234' },
	{ slug: 'america-johana', key: 'interlude01', sha256: '38d5375d22d589aa7fe3c80b21ae791e421d093930451c4d0128cfbdd1e559e5' },
	{ slug: 'america-johana', key: 'interlude02', sha256: 'f3b9ebc2f1535a7a4ce7f719ea07dcc57f94d58074ccbf683ddaff213db56a0e' },
	{ slug: 'america-johana', key: 'interlude03', sha256: 'bb078dc72b62374547154b9d71659a2e9d2ba9f41436012b9fb3da466d21abfb' },
	{ slug: 'america-johana', key: 'interlude04', sha256: '627b0df32d753ebbb05981dddc52b08e8df58043e8931b778c5835677dc94dbf' },
	{ slug: 'america-johana', key: 'thankYouPortrait', sha256: '92aa4c46802e7be1c81a289c5048c504733bdf3383f62597c9bd3b73b00c70ce' },
	{ slug: 'ana-sofia-cota-guillen', key: 'ceremony', sha256: '86c24affe51fa39291e948d6d25c9bcdc85035e5d9d61e3e4f472563af6a77d4' },
	{ slug: 'ana-sofia-cota-guillen', key: 'family', sha256: 'cea5068862986fec51a10e1d13e9bb7e3eec1889ba5d98e7fcb3bb6be86c13e6' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery01', sha256: '275f69741a2da30ac1a3260e5188cf185c67ddf2633b58f391d3522e88f67992' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery02', sha256: 'cea5068862986fec51a10e1d13e9bb7e3eec1889ba5d98e7fcb3bb6be86c13e6' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery03', sha256: '82dd912ba25d1a5bb634470a49bf52df91f7f635c2e8883580cc065bf90617b9' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery04', sha256: 'a909a195c26f0cb43a420523509570c02a3c0ae8616a70d385dba9a07d6ec0ed' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery05', sha256: '278be4befc376c8cb95a5ea283d7b394462db209e1740439f0150904a730aa36' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery06', sha256: '9d37ecdee91da5038b307b46b8a49c74c8557b63fa8bfc8e43f90eec648e63d9' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery07', sha256: 'c3c069b4de057b25ef1b76ca2cb68fbe5a0dad30b42d7a9066bb9513959828f5' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery08', sha256: 'd04b25dde4776c7ff1b123f8bdfc710e1377301712849e580a9152233c31a9c8' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery09', sha256: '45ceb6603e91e5eb638529c09c91540f1aa9a72908753b2d4ae77c8c774f0cfb' },
	{ slug: 'ana-sofia-cota-guillen', key: 'gallery10', sha256: '0c027d77ca80fe050454a5b1830ca02ec5234045c2031cb79b696850965ef3b9' },
	{ slug: 'ana-sofia-cota-guillen', key: 'hero', sha256: 'dc566ff95615da1cf1f4c59ed63a3e2c5d6fc8cddff93502160c44a8daa9f747' },
	{ slug: 'ana-sofia-cota-guillen', key: 'interlude01', sha256: '1b72b0ca99f223b2899a290d2488c79ef9b67cbfd163052e6506441870e95081' },
	{ slug: 'ana-sofia-cota-guillen', key: 'interlude02', sha256: '6f7d8ee13014fbf4af57922ca2fae61f3cb2524e87bc3a321dbe35241f19e7b3' },
	{ slug: 'ana-sofia-cota-guillen', key: 'interlude03', sha256: '99a57b50ac78904f56e98c84b3f50af32f199284f9a6aad7e82f968d4f1f0b5b' },
	{ slug: 'ana-sofia-cota-guillen', key: 'interlude04', sha256: '50399280706af05fc57fe6785cc6fe0fc7bdd86655844be42084157a085ee537' },
	{ slug: 'ana-sofia-cota-guillen', key: 'portrait', sha256: 'a909a195c26f0cb43a420523509570c02a3c0ae8616a70d385dba9a07d6ec0ed' },
	{ slug: 'ana-sofia-cota-guillen', key: 'reception', sha256: '9daf81bd934954cbc6e995e7dcee919fb82ad1601f8fa913a9050453a5d6fdaf' },
	{ slug: 'ana-sofia-cota-guillen', key: 'thankYouPortrait', sha256: '8a798752f0b1c46d57de6f3a3f2420af0670d3f9215b3b0b15de90418aa88227' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'gallery02', sha256: '54ff161a7084bb7434f000a6a891dbb285c3c3314a1e26affdfa1682d1b4ae4a' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'gallery03', sha256: 'f506d234cdd63cdc47d41ace094a4a33c241a41fdb205b35fdda208cf4ec32de' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'gallery04', sha256: '1ee160ff9fd460ab6cc222b4a4c0359f101226045821ae8f42c4bc79c830892e' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'gallery06', sha256: '0e6f023176c7ac7061a8ab9fa2e65bd351c0b23dfe35b01b737f904cde35d2a6' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'gallery08', sha256: '97e4c9244424369a25920e202b24c9cd803e62f12f1f535ad400a4fc243cc051' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'gallery10', sha256: '85a15f345b828d072e974aa3a3066accf9ff388385aa015f4b7196419b6b9d7a' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'interlude01', sha256: '33d8d201ea69c70687ced8d4d41a404a10d2784b12df5926f88023a70310e764' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'interlude02', sha256: 'ab8754c1d79261c32dfbf17f18306a2a6fed984e2dc220500b560e7a3b0d6e02' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'interlude03', sha256: '3c4af59dc04e6173e3c7aea147931bd691a3e312e3e4d79259cb9ab9fa70dbe1' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'mapCeremony', sha256: '7bc1cb3a133a7938e6ee39e317fdccad6fd8b890e6c06436dbe2f8e336cda862' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'mapReception', sha256: 'c618453d1fbf4489d7d019b27315d535bf68ec1b09af73944a8d69a3d88d0380' },
	{ slug: 'ayrin-samantha-lerma-castro', key: 'thankYouPortrait', sha256: '91145738d1b5453bbb403bf66629f26a0c01f6babe3c74cf60d60bf6a897e2d7' },
	{ slug: 'gerardo-sesenta', key: 'hero', sha256: 'bee548193bbbf71f57dff2d37f69e3ab9d6ed5c7617b0138cc1d3f9e7b01aac5' },
	{ slug: 'gerardo-sesenta', key: 'jardin', sha256: '54550a74098991340f446f57bda5e5b147a005f1f436142818b56ed98b97ae51' },
	{ slug: 'gerardo-sesenta', key: 'gallery01', sha256: 'b72ca5fc37c7e24f12c3f39d5f70cdb26e658ebd7981a157c09fc078d326169d' },
	{ slug: 'gerardo-sesenta', key: 'gallery02', sha256: '4ea4720731f10e2946f614aa23dc54855669d30797a65b5444797b06fbb04fc1' },
	{ slug: 'gerardo-sesenta', key: 'gallery03', sha256: '29690b2cdf460d3b4ae99c889779f7be60d2cb16abd6e29cf139bbe6af2f3038' },
	{ slug: 'gerardo-sesenta', key: 'gallery04', sha256: '69b4ded734dd6794f2a8893acd296c166f15c05e2ced5f59c90782f067846de6' },
	{ slug: 'gerardo-sesenta', key: 'gallery05', sha256: '482ec9a662cd9753a36d1bd94c8035e4af413fa150b0cbc6321a8a8b4ff8bc64' },
	{ slug: 'gerardo-sesenta', key: 'gallery06', sha256: '97e613a9b29f74a5a6d4e429cc56013b4c8f226553da7218d72bb1cfd5644cfb' },
	{ slug: 'gerardo-sesenta', key: 'interlude01', sha256: 'b72ca5fc37c7e24f12c3f39d5f70cdb26e658ebd7981a157c09fc078d326169d' },
	{ slug: 'gerardo-sesenta', key: 'interlude02', sha256: '4ea4720731f10e2946f614aa23dc54855669d30797a65b5444797b06fbb04fc1' },
	{ slug: 'xareni-iyarit', key: 'thankYouPortrait', sha256: '74050336f7b8b8e52f4152026ecb0efa44afdba67e80d92c919146d211325098' },
	{ slug: 'xareni-iyarit', key: 'gallery01', sha256: '7e6cc22f4a9f168212e8142565ad9da46f134caf7b336a18f5555d1b2e922c31' },
	{ slug: 'xareni-iyarit', key: 'gallery02', sha256: '6e79d1c5f640858735f2ad470dc5f4f7f4872e29a9448f2d1c45014a35bf3864' },
	{ slug: 'xareni-iyarit', key: 'gallery03', sha256: '8bdc5b783b9d0899063bd49bc9947b5b36856ec07c547e27bba3e9659f530fb4' },
	{ slug: 'xareni-iyarit', key: 'gallery04', sha256: '762ab17db34f8f7710a44ea5ef56e10d776f070f8bfe7ddfcd8f99751e80b2d1' },
	{ slug: 'xareni-iyarit', key: 'gallery05', sha256: '781bc44010c0a898dcc3688e3baa9ff5084ace02cd4d5646a584e18adbbde292' },
	{ slug: 'xareni-iyarit', key: 'gallery06', sha256: '8995e7deaae8a9bdb88146edcab2f724a4d90ce7da1fd6ececfe6a94db5bb225' },
	{ slug: 'xareni-iyarit', key: 'interlude01', sha256: 'cdf200a825eb784d1f8de39805f5cc31ba8e1613176710c3ebb84656e3af30f9' },
	{ slug: 'xareni-iyarit', key: 'interlude02', sha256: '4a370e4784fd7a7b909b2a6d26f0757956d4113fd635e8d42ffedc3801c42846' },
	{ slug: 'xareni-iyarit', key: 'interlude03', sha256: '7a43e8e74aad90d1337cf665ab7a46bf367ecc68d9192c2ed678e109407a571e' },
	{ slug: 'xareni-iyarit', key: 'interlude04', sha256: '14849f6970976de64dec1bc8c7cad23c5c6f0921945bcff5017372cbb3ee6e40' },
	{ slug: 'ximena-meza-trasvina', key: 'hero', sha256: '2e65b4cfca60b1d2dd41a41d89ce5356858efaf1f72609df8b533df64ef711f8' },
	{ slug: 'ximena-meza-trasvina', key: 'portrait', sha256: '679e2911fe0d7b299f94a0dcebe95d7c993495c790224d4baa5802f4166a9525' },
	{ slug: 'ximena-meza-trasvina', key: 'family', sha256: '7c183313fb79f5116eb4ce06005bebc9af9e92860919c3b5b124db7b346a2274' },
	{ slug: 'ximena-meza-trasvina', key: 'jardin', sha256: '66d50b7dbe5a2bac1ee761abe6290d755716d9e48b3bfebfbb9207e808e1f420' },
	{ slug: 'ximena-meza-trasvina', key: 'gallery01', sha256: '679e2911fe0d7b299f94a0dcebe95d7c993495c790224d4baa5802f4166a9525' },
	{ slug: 'ximena-meza-trasvina', key: 'gallery02', sha256: '1b68930e276815d62c851afc335a664fbb57794435a7eb5ae24d92dbb9ebdc01' },
	{ slug: 'ximena-meza-trasvina', key: 'gallery03', sha256: '66d50b7dbe5a2bac1ee761abe6290d755716d9e48b3bfebfbb9207e808e1f420' },
	{ slug: 'ximena-meza-trasvina', key: 'gallery04', sha256: 'e2458e57adb244b5e1aa373b6ac615dd9ac9f0f540045ea87e0c7b9615c46ccf' },
	{ slug: 'ximena-meza-trasvina', key: 'gallery05', sha256: '7d63b9d1592386694bb923425d299947f385229185ebd0020cdf17f6166f1351' },
	{ slug: 'ximena-meza-trasvina', key: 'gallery07', sha256: '2434cddd55d13e976e815e18d139d44b0f4a132201943cec2b9c1b33cb3ff5b1' },
	{ slug: 'ximena-meza-trasvina', key: 'gallery09', sha256: 'c819e9f7c050594774e5d277eb6bb5cf418f1419aae043389e16fb500528cd72' },
	{ slug: 'ximena-meza-trasvina', key: 'gallery10', sha256: 'e8ca9e0bb046a0191ce71aac22cb04742e8fd1b0ad5ca8ce1e70c0c08c6c86da' },
	{ slug: 'ximena-meza-trasvina', key: 'interlude01', sha256: '2c724faf5fc6fdcdd10b7b670cd362ee6c9d68b24748f1cb1ced4a075e244ba8' },
	{ slug: 'ximena-meza-trasvina', key: 'interlude02', sha256: 'c819e9f7c050594774e5d277eb6bb5cf418f1419aae043389e16fb500528cd72' },
	{ slug: 'ximena-meza-trasvina', key: 'interlude03', sha256: 'e8ca9e0bb046a0191ce71aac22cb04742e8fd1b0ad5ca8ce1e70c0c08c6c86da' },
	{ slug: 'ximena-meza-trasvina', key: 'interlude04', sha256: 'e2458e57adb244b5e1aa373b6ac615dd9ac9f0f540045ea87e0c7b9615c46ccf' },
	{ slug: 'ximena-meza-trasvina', key: 'interlude05', sha256: '2909a524f7229d8858e2b228d98e85dd9697c131d1e78841a7fd29e3fd7aef5b' },
	{ slug: 'ximena-meza-trasvina', key: 'interlude06', sha256: '66aae77f58304c2320b1048b295ecf3dbd35c3a85bb8e6f0bc1ebf620df77967' },
	{ slug: 'ximena-meza-trasvina', key: 'thankYouPortrait', sha256: '3c05d3e482f3abd4dda641830af13392589503664725e21cf961b60fc1be5aec' },
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
