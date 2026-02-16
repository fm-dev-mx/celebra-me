// Test para simular diferentes escenarios de error JSON
const testCases = [
	{
		name: 'Body completamente vacío',
		body: '',
		contentType: 'application/json',
	},
	{
		name: 'Body con solo espacios',
		body: '   ',
		contentType: 'application/json',
	},
	{
		name: 'JSON inválido - string incompleta',
		body: '{"test": "unclosed string}',
		contentType: 'application/json',
	},
	{
		name: 'JSON inválido - sin comillas',
		body: '{test: "value"}',
		contentType: 'application/json',
	},
	{
		name: 'Sin Content-Type header',
		body: '{"test": "value"}',
		contentType: null,
	},
	{
		name: 'Content-Type incorrecto',
		body: '{"test": "value"}',
		contentType: 'text/plain',
	},
	{
		name: 'Body null',
		body: null,
		contentType: 'application/json',
	},
	{
		name: 'Body undefined',
		body: undefined,
		contentType: 'application/json',
	},
];

console.log('Simulando diferentes escenarios de error JSON:');
console.log('=============================================\n');

testCases.forEach((testCase, index) => {
	console.log(`Test ${index + 1}: ${testCase.name}`);
	console.log(`Content-Type: ${testCase.contentType}`);
	console.log(`Body: ${JSON.stringify(testCase.body)}`);

	// Simular lo que haría request.json()
	try {
		if (testCase.body === '' || testCase.body === null || testCase.body === undefined) {
			throw new Error('Unexpected end of JSON input');
		}

		if (testCase.body.trim() === '') {
			throw new Error('Unexpected end of JSON input');
		}

		JSON.parse(testCase.body);
		console.log('Resultado: JSON válido');
	} catch (error) {
		console.log(`Resultado: Error - ${error.message}`);
	}

	console.log('---\n');
});
