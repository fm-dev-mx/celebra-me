import crypto from 'node:crypto';

function base64UrlEncode(value) {
	return Buffer.from(value, 'utf8')
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function createGuestToken(payload, secret) {
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
	return `${encodedPayload}.${signature}`;
}

const [eventSlug, guestId, expDaysRaw] = process.argv.slice(2);

if (!eventSlug || !guestId) {
	console.error('Usage: node scripts/generate-rsvp-token.mjs <eventSlug> <guestId> [expDays]');
	process.exit(1);
}

const secret = process.env.RSVP_TOKEN_SECRET || 'dev-rsvp-secret-change-me';
const expDays = Number(expDaysRaw || '30');
const exp = Number.isFinite(expDays) && expDays > 0
	? Math.floor(Date.now() / 1000) + expDays * 24 * 60 * 60
	: undefined;

const token = createGuestToken({ eventSlug, guestId, exp }, secret);
console.log(token);
