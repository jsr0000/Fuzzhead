// test-error-handling.js
// Test script to verify error handling improvements

import { handler } from './src/lambda-handler.mjs';

// Test cases for different error scenarios
const testCases = [
    {
        name: 'Valid Code Input',
        event: {
            body: JSON.stringify({
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
        },
        expectedStatus: 200
    },
    {
        name: 'Invalid JSON',
        event: {
            body: 'invalid json'
        },
        expectedStatus: 400
    },
    {
        name: 'Missing Code',
        event: {
            body: JSON.stringify({})
        },
        expectedStatus: 400
    },
    {
        name: 'Empty Code',
        event: {
            body: JSON.stringify({
                code: ''
            })
        },
        expectedStatus: 400
    },
    {
        name: 'Code Too Short',
        event: {
            body: JSON.stringify({
                code: 'test'
            })
        },
        expectedStatus: 400
    },
    {
        name: 'Compilation Error',
        event: {
            body: JSON.stringify({
                code: `
import { SmartContract, method, Field } from 'o1js';

export class TestContract extends SmartContract {
    @method
    add(a: Field, b: Field): Field {
        return a.add(b; // Missing closing parenthesis
    }
}
`
            })
        },
        expectedStatus: 422
    }
];

async function runTests() {
    console.log('🧪 Testing Error Handling Improvements\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log('-'.repeat(40));

        try {
            const result = await handler(testCase.event);
            const response = JSON.parse(result.body);

            console.log(`Status Code: ${result.statusCode} (Expected: ${testCase.expectedStatus})`);
            console.log(`Success: ${response.success}`);

            if (response.error) {
                console.log(`Error Type: ${response.error.type}`);
                console.log(`Error Code: ${response.error.code}`);
                console.log(`Error Message: ${response.error.message}`);
            }

            if (result.statusCode === testCase.expectedStatus) {
                console.log('✅ PASSED');
                passed++;
            } else {
                console.log('❌ FAILED - Wrong status code');
                failed++;
            }

            // Show first few lines of output for debugging
            if (response.output) {
                const outputLines = response.output.split('\n').slice(0, 5);
                console.log('Output preview:');
                outputLines.forEach(line => console.log(`  ${line}`));
                if (response.output.split('\n').length > 5) {
                    console.log('  ...');
                }
            }

        } catch (error) {
            console.log(`❌ FAILED - Test execution error: ${error.message}`);
            failed++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All tests passed! Error handling is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Check the implementation.');
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
}); 