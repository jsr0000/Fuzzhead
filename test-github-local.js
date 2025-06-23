// test-github-local.js
// Test GitHub integration and run fuzzer locally

import { handler } from './src/lambda-handler.mjs';

async function testGitHubLocal() {
    console.log('🧪 Testing GitHub integration and fuzzer locally...\n');

    // Check if GitHub token is available
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        console.log('⚠️  No GITHUB_TOKEN environment variable found.');
        console.log('To test with authentication:');
        console.log('export GITHUB_TOKEN=your_github_token_here');
        console.log('\nTesting without authentication (rate limited)...\n');
    } else {
        console.log('✅ GitHub token found!');
        console.log('Token preview:', githubToken.substring(0, 8) + '...\n');
    }

    // Test 1: Search for TypeScript files in a repository
    const testEvent1 = {
        body: JSON.stringify({
            mode: 'repo',
            repoUrl: 'https://github.com/jsr0000/mina-add',
            branch: 'main'
            // No filePath - will search for TypeScript files
        })
    };

    console.log('📋 Test 1: Searching and fuzzing TypeScript files in repository');
    console.log('='.repeat(60));

    try {
        const result1 = await handler(testEvent1);
        const body1 = JSON.parse(result1.body);

        console.log('Status Code:', result1.statusCode);
        console.log('Success:', body1.success);

        if (body1.error) {
            console.log('❌ Error:', body1.error.message);
            console.log('Type:', body1.error.type);
            console.log('Code:', body1.error.code);
        } else {
            console.log('✅ Success!');
            console.log('\nFuzzer Output:');
            console.log('-'.repeat(40));
            console.log(body1.output);
            console.log('-'.repeat(40));

            if (body1.summary) {
                console.log('\n📈 Summary:');
                console.log(`Total Logs: ${body1.summary.totalLogs}`);
                console.log(`Errors: ${body1.summary.errors}`);
                console.log(`Warnings: ${body1.summary.warnings}`);
            }
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Test 2: Test with a specific file path
    const testEvent2 = {
        body: JSON.stringify({
            mode: 'repo',
            repoUrl: 'https://github.com/jsr0000/mina-add',
            branch: 'main',
            filePath: 'src/Add.ts' // Specific file
        })
    };

    console.log('📋 Test 2: Fuzzing specific file from repository');
    console.log('='.repeat(60));

    try {
        const result2 = await handler(testEvent2);
        const body2 = JSON.parse(result2.body);

        console.log('Status Code:', result2.statusCode);
        console.log('Success:', body2.success);

        if (body2.error) {
            console.log('❌ Error:', body2.error.message);
            console.log('Type:', body2.error.type);
            console.log('Code:', body2.error.code);
        } else {
            console.log('✅ Success!');
            console.log('\n�� Fuzzer Output:');
            console.log('-'.repeat(40));
            console.log(body2.output);
            console.log('-'.repeat(40));

            if (body2.summary) {
                console.log('\n📈 Summary:');
                console.log(`Total Logs: ${body2.summary.totalLogs}`);
                console.log(`Errors: ${body2.summary.errors}`);
                console.log(`Warnings: ${body2.summary.warnings}`);
            }
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testGitHubLocal();