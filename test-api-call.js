// test-api-call.js
// Test the actual API endpoint

async function testAPICall() {
    console.log('🧪 Testing actual API endpoint...\n');

    const API_ENDPOINT = 'https://mriak6j5zf.execute-api.eu-west-2.amazonaws.com/dev/fuzz';

    const requestBody = {
        mode: 'code',
        code: `
import { SmartContract, method, Field } from 'o1js';

export class TestContract extends SmartContract {
    @method
    add(a: Field, b: Field): Field {
        return a.add(b);
    }
}
`
    };

    try {
        console.log('📤 Sending request to API...');
        console.log('URL:', API_ENDPOINT);
        console.log('Body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        console.log('\n📥 Response received:');
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        const result = await response.json();
        console.log('\n📋 Response Body:');
        console.log('Success:', result.success);

        if (result.error) {
            console.log('\n❌ Error Details:');
            console.log('  Message:', result.error.message);
            console.log('  Type:', result.error.type);
            console.log('  Code:', result.error.code);
            console.log('  Timestamp:', result.error.timestamp);
            console.log('  Details:', result.error.details);
        }

        if (result.output) {
            console.log('\n📋 Output (first 500 chars):');
            console.log(result.output.substring(0, 500));
        }

    } catch (error) {
        console.error('❌ API call failed:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack:', error.stack);
    }
}

testAPICall(); 