import { locationSchema } from '@/lib/schemas/content/location.schema';
import { LOCATION_SCENES } from '@/lib/invitation/location-presentation';

const venue = (venueEvent: string, time: string, type: 'ceremony' | 'reception') => ({
	type,
	venueEvent,
	venueName: `${venueEvent} venue`,
	address: '14 Oriente 4215, El Porvenir, Puebla',
	city: 'Puebla',
	date: '2027-01-09',
	time,
	isVisible: true,
});

const programSheet = (scene: string) => ({
	variant: 'program-sheet',
	presentationOptions: { scene },
	venues: [venue('Misa', '17:45', 'ceremony'), venue('Recepción', '19:30', 'reception')],
});

describe('location.presentationOptions.scene', () => {
	it.each(LOCATION_SCENES)('accepts %s on a program sheet with two venues', (scene) => {
		expect(locationSchema.safeParse(programSheet(scene)).success).toBe(true);
	});

	it('rejects the mirror ball route with a single visible venue', () => {
		const location = programSheet('mirror-ball-route');
		const result = locationSchema.safeParse({
			...location,
			venues: [location.venues[0], { ...location.venues[1], isVisible: false }],
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(['presentationOptions', 'scene']);
	});

	it('rejects the mirror ball route outside the program sheet', () => {
		const result = locationSchema.safeParse({
			...programSheet('mirror-ball-route'),
			variant: 'star-route',
		});
		expect(result.success).toBe(false);
	});

	it('rejects an unknown scene', () => {
		expect(locationSchema.safeParse(programSheet('disco-route')).success).toBe(false);
	});
});
