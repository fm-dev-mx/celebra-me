import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';

const PROFILES_DIR = path.join(process.cwd(), 'src/styles/invitation-profiles');
const DEMOS_DIR = path.join(process.cwd(), 'src/content/event-demos');

/**
 * Delivered profiles that predate the token-only rule. Each is a closed deliverable: it is not
 * edited, reused or extended, and it is deleted together with its invitation. Changing a digest
 * is a deliberate, reviewed exception. Never add an entry; new profiles must be token-only.
 */
const FROZEN_PROFILE_SHA256: Record<string, string> = {
	'abril-michelle-becerra-rea':
		'0d9b1d89193c3ac696604d98b7300ffe0c4785a87c66e3036d47a24f70ba8fdc',
	'alba-rosa-quinonez': '3ac7a0b5bc7bb3ea4d2f4b53c8f3db4478f38be7561fb009988e02aa73d61bcc',
	'allison-scarlett': '6d7212a2b87605534c3b11d5901f000f1c1492998edec25d6fdcebd236beda9a',
	'america-johana': '996031dc4049d002ba8d3957111f1a67cccb4bab215e1df85bd08f4cd5e297e5',
	'daniela-y-martin': 'f7981960de0bc93da6458c6938ea809598dda9ead3cd7a9d3aa6118b6b5f7adb',
	'demo-xv-celestial-blue': 'a559289d9e6fffaaa36bea5fe794bdaaa635ca4709b59948473e466122d921b7',
	'destenid-sofia': 'd5b267b22f03db0b7e8fbd20110c5623bb919b60e32e910479a6cfeda8284237',
	'leah-lexa': '111de6c9850ae7bad10045e42cdbf6e17faa42864f22e2f28765fae0e3080ffb',
	'leslie-perez': 'e61995a014b5d74edc09f57c2ade061823e1eacc67a09474a43e717dfcb61afe',
	'luna-y-estrella': 'b20b5b032d972f15c07427a1d8d4746d2e3ffce3b27433e121ddd061e13799a4',
	'melissa-y-luis-osmar': '26facacb79e20a14fc7c8b06577b556ea8a1df3b2a5e7baf9fd6a968df36e7b3',
	'naydelin-paredes': '0ec34ca3c58f968fc4ade0374ae66c3f21eb4f2d2cfa8d95fa9bc228a51ff446',
	'norma-hernandez': '53b57ed8ffbc94cd334d7a0118fb7fdb143c8c557687b3fa18a9e2ef4623dc19',
	renata: '2917c4477be2efb80eae495b08009db0ca0883a6b1d14cff6cbe603b9d90cc9f',
	'romina-rios-chaparro': '017e52614e9ca5f4111ef13d018e1466a2cff33258a61dded61d20c62a9d290f',
	'valentina-hernandez': '22d31e5071b86a5ecddeac75073d98ffbd0c0c768285d956d3597f1a6f4763bc',
	'victoria-y-roberto': 'c136bf2a53fe6e50871f8f4a0a6a269c362cff10c09f4c8dc72c14f8e43d1364',
	'xareni-iyarit': 'af48b689a3d9a0a488fe12c08a3908980264e8ed2052ad1087a27159387341c5',
};

function profileIds(): string[] {
	return fs
		.readdirSync(PROFILES_DIR)
		.filter((name) => name.endsWith('.scss') && !name.startsWith('_'))
		.map((name) => name.replace(/\.scss$/u, ''))
		.sort();
}

function readProfile(id: string): string {
	return fs.readFileSync(path.join(PROFILES_DIR, `${id}.scss`), 'utf8').replace(/\r\n/gu, '\n');
}

function demoProfileIds(): Set<string> {
	const ids = new Set<string>();
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith('.json')) {
				const { visualProfileId } = JSON.parse(fs.readFileSync(full, 'utf8')) as {
					visualProfileId?: string;
				};
				if (visualProfileId) ids.add(visualProfileId);
			}
		}
	};
	walk(DEMOS_DIR);
	return ids;
}

/** Declarations that are not custom properties, ignoring comments and `@use`/`@include` lines. */
function nonTokenDeclarations(source: string): string[] {
	const stripped = source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
	return [...stripped.matchAll(/(?:^|[;{])\s*([a-z-]+)\s*:(?!:)/gimu)]
		.map((match) => match[1])
		.filter((property) => !property.startsWith('--'));
}

describe('invitation profile boundary', () => {
	const ids = profileIds();
	const managedProfiles = new Set(
		listInvitationDefinitions()
			.map((definition) => definition.visualProfileId)
			.filter((id): id is string => typeof id === 'string'),
	);
	const demoProfiles = demoProfileIds();

	it('keeps every frozen profile byte-identical', () => {
		for (const [id, digest] of Object.entries(FROZEN_PROFILE_SHA256)) {
			const actual = createHash('sha256').update(readProfile(id)).digest('hex');
			expect({ id, digest: actual }).toEqual({ id, digest });
		}
	});

	it('restricts every other profile to token declarations', () => {
		for (const id of ids.filter((candidate) => !(candidate in FROZEN_PROFILE_SHA256))) {
			expect({ id, nonToken: nonTokenDeclarations(readProfile(id)) }).toEqual({
				id,
				nonToken: [],
			});
		}
	});

	it('keeps no profile without a consumer', () => {
		for (const id of ids) {
			expect({ id, consumed: managedProfiles.has(id) || demoProfiles.has(id) }).toEqual({
				id,
				consumed: true,
			});
		}
	});

	it('styles demos only with demo-owned profiles', () => {
		for (const id of demoProfiles) {
			expect(id.startsWith('demo-')).toBe(true);
			expect(managedProfiles.has(id)).toBe(false);
		}
	});
});
