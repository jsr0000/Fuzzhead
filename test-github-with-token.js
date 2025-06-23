// test-github-with-token.js
// Test GitHub API search with authentication

import { handler } from './src/lambda-handler.mjs';

async function testGitHubWithToken() {
    console.log('🧪 Testing GitHub API search with authentication...\n');

    // Check if GitHub token is available
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        console.log('⚠️  No GITHUB_TOKEN environment variable found.');
        console.log('To test GitHub API search, set your GitHub token:');
        console.log('export GITHUB_TOKEN=your_github_token_here');
        console.log('\nFor now, testing without authentication...\n');
    } else {
        console.log('✅ GitHub token found in environment variables.\n');
    }

    // Test 1: Search for TypeScript files in o1js repository
    const testEvent1 = {
        body: JSON.stringify({
            mode: 'repo',
            repoUrl: 'https://github.com/o1-labs/o1js',
            branch: 'main'
            // No filePath - should search for TypeScript files
        })
    };

    console.log('📋 Test 1: Searching for TypeScript files in o1js repository');
    console.log('-'.repeat(50));

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
            console.log('Output preview:');
            console.log(body1.output.substring(0, 500) + '...');
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // // Test 2: Search for TypeScript files in a smaller repository
    // const testEvent2 = {
    //     body: JSON.stringify({
    //         mode: 'repo',
    //         repoUrl: 'https://github.com/microsoft/TypeScript',
    //         branch: 'main'
    //         // No filePath - should search for TypeScript files
    //     })
    // };

    // console.log('📋 Test 2: Searching for TypeScript files in TypeScript repository');
    // console.log('-'.repeat(50));

    // try {
    //     const result2 = await handler(testEvent2);
    //     const body2 = JSON.parse(result2.body);

    //     console.log('Status Code:', result2.statusCode);
    //     console.log('Success:', body2.success);

    //     if (body2.error) {
    //         console.log('❌ Error:', body2.error.message);
    //         console.log('Type:', body2.error.type);
    //         console.log('Code:', body2.error.code);
    //     } else {
    //         console.log('✅ Success!');
    //         console.log('Output preview:');
    //         console.log(body2.output.substring(0, 500) + '...');
    //     }
    // } catch (error) {
    //     console.error('❌ Test failed:', error.message);
    // }
}

testGitHubWithToken(); 