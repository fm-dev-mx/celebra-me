import { sendEmail } from '../src/utils/email';

/**
 * Script to test the Gmail/Nodemailer configuration
 */
async function test() {
	console.log('--- Email Configuration Test ---');
	console.log('GMAIL_USER:', process.env.GMAIL_USER ? 'SET (length: ' + process.env.GMAIL_USER.length + ')' : 'NOT SET');
	console.log('GMAIL_PASS:', process.env.GMAIL_PASS ? 'SET (length: ' + process.env.GMAIL_PASS.length + ')' : 'NOT SET');
	console.log('RECIPIENT:', process.env.CONTACT_FORM_RECIPIENT_EMAIL || 'Will use GMAIL_USER');
	console.log('--------------------------------');

	if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
		console.error('❌ ERROR: Missing GMAIL_USER or GMAIL_PASS in .env file');
		process.exit(1);
	}

	console.log('Attempting to send test email...');

	const success = await sendEmail({
		name: 'Test Runner',
		email: 'tester@celebra-me.com',
		message: 'Este es un mensaje de prueba para verificar la configuración de Gmail/Nodemailer.',
		type: 'contact'
	});

	if (success) {
		console.log('✅ SUCCESS: Email sent successfully!');
	} else {
		console.log('❌ FAILURE: Failed to send email. Check logs above.');
	}
}

test().catch(console.error);
