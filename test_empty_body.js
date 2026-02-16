const fetch = require('node-fetch');

async function testEmptyBody() {
	console.log('Testing POST /api/rsvp with empty body...');

	try {
		const response = await fetch('http://localhost:4321/api/rsvp', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			// Empty body
		});

		console.log('Status:', response.status);
		console.log('Status Text:', response.statusText);

		const text = await response.text();
		console.log('Response:', text);
	} catch (error) {
		console.error('Error:', error.message);
	}
}

testEmptyBody();
