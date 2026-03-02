const { mapSupabaseErrorToApiError } = require('./src/lib/rsvp/supabase-errors.ts');

// Test the error mapper directly
const testError1 = new Error(
	'duplicate key value violates unique constraint "guest_invitations_event_phone_unique"',
);
const result1 = mapSupabaseErrorToApiError(testError1);
console.log('Test 1 - Constraint error:');
console.log('  Status:', result1.status);
console.log('  Code:', result1.code);
console.log('  Message:', result1.message);
console.log('  Details:', result1.details);

const testError2 = new Error('23505: duplicate key value violates unique constraint');
const result2 = mapSupabaseErrorToApiError(testError2);
console.log('\nTest 2 - 23505 error:');
console.log('  Status:', result2.status);
console.log('  Code:', result2.code);
console.log('  Message:', result2.message);
console.log('  Details:', result2.details);

const testError3 = new Error('Some other error');
const result3 = mapSupabaseErrorToApiError(testError3);
console.log('\nTest 3 - Generic error:');
console.log('  Status:', result3.status);
console.log('  Code:', result3.code);
console.log('  Message:', result3.message);
console.log('  Details:', result3.details);
