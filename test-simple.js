// test-simple.js
// Simple test to debug error handling

import { handler } from './src/lambda-handler.mjs';

async function testSimple() {
    console.log('🧪 Testing simple request...\n');

    const testEvent = {
        body: JSON.stringify({
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
        })
    };

    try {
        console.log('📤 Sending request...');
        const result = await handler(testEvent);

        console.log('📥 Response received:');
        console.log('Status Code:', result.statusCode);
        console.log('Headers:', result.headers);

        const body = JSON.parse(result.body);
        console.log('Success:', body.success);

        if (body.error) {
            console.log('❌ Error Details:');
            console.log('  Message:', body.error.message);
            console.log('  Type:', body.error.type);
            console.log('  Code:', body.error.code);
            console.log('  Timestamp:', body.error.timestamp);
            console.log('  Details:', body.error.details);
        }

        if (body.output) {
            console.log('\n📋 Output (first 500 chars):');
            console.log(body.output.substring(0, 500));
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('Stack:', error.stack);
    }
}

testSimple(); 