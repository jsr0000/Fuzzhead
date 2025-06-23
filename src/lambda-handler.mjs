// lambda-handler.mjs

import path from 'path';
import ts from 'typescript';
import fs from 'fs';

// Import our new error handling and logging utilities
import {
    FuzzerError,
    CompilationError,
    ImportError,
    ExecutionError,
    ValidationError,
    ResourceError,
    TimeoutError,
    ErrorCodes,
    createErrorResponse,
    safeExecute
} from './errors.js';

import { logger, log } from './logger.js';
import { validateAndSanitizeInput, validateTypeScriptCode, validateGitHubUrl, validateFilePath } from './validation.js';

// This will hold our fuzzer's output logs to be returned to the user.
let outputLogs = [];
const mockGeneratorRegistry = {};

// Conditional o1js import with proper error handling
let PrivateKey;
try {
    const o1js = await import('o1js');
    PrivateKey = o1js.PrivateKey;
    logger.info('o1js loaded successfully');
} catch (error) {
    logger.warn('o1js not available, some features may be limited', { error: error.message });
    PrivateKey = null;
}

// --- Helper Functions  ---

function registerMockGenerator(typeName, generator) {
    mockGeneratorRegistry[typeName] = generator;
}

function generateMockValue(typeKind, typeName) {
    if (mockGeneratorRegistry[typeName]) {
        return mockGeneratorRegistry[typeName]();
    }
    // Using numeric values for SyntaxKind since we can't use the enum directly
    switch (typeKind) {
        case 152: // StringKeyword
            return Math.random().toString(36).substring(2, 7);
        case 148: // NumberKeyword
            return Math.floor(Math.random() * 1000);
        case 136: // BooleanKeyword
            return Math.random() > 0.5;
        default:
            return null;
    }
}

async function executeFunction(name, func, args) {
    const startTime = Date.now();

    if (args.includes(null)) {
        logger.warn(`Skipping ${name}(...) due to unsupported parameter types`);
        outputLogs.push(`  -> Skipping ${name}(...) due to unsupported parameter types.`);
        return;
    }

    const argsString = args.map(arg => {
        if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
            return `{...${arg.constructor.name}}`;
        }
        return JSON.stringify(arg);
    }).join(', ');

    outputLogs.push(`  -> Calling ${name}(${argsString})... `);

    try {
        logger.methodCall(name.split('.')[0], name.split('.')[1], args);

        const result = await safeExecute(
            () => func(...args),
            { operation: 'method_execution', method: name, args }
        );

        const duration = Date.now() - startTime;
        logger.methodResult(name.split('.')[0], name.split('.')[1], result, duration);

        outputLogs[outputLogs.length - 1] += `✅ Success`;
        if (result !== undefined) {
            outputLogs.push(`     Output: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.methodError(name.split('.')[0], name.split('.')[1], error, args);

        outputLogs[outputLogs.length - 1] += `❌ Error`;
        outputLogs.push(`     Message: ${error.message}`);

        // Re-throw as ExecutionError for proper error handling
        throw new ExecutionError(
            `Method execution failed: ${error.message}`,
            name,
            args
        );
    }
}

// --- GitHub Repository Helper Functions ---

function extractRepoInfo(repoUrl) {
    const match = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (!match) {
        throw new ValidationError('Invalid GitHub repository URL', 'repoUrl', repoUrl);
    }
    return {
        owner: match[1].split('/')[0],
        repo: match[1].split('/')[1]
    };
}

async function fetchFileFromGitHub(repoUrl, filePath, branch = 'main') {
    return await safeExecute(async () => {
        const { owner, repo } = extractRepoInfo(repoUrl);

        logger.info('Fetching file from GitHub', { owner, repo, filePath, branch });
        outputLogs.push(`\n📥 Fetching file from GitHub: ${repoUrl}`);
        outputLogs.push(`   File: ${filePath}`);
        outputLogs.push(`   Branch: ${branch}`);
        outputLogs.push('-'.repeat(50));

        // Use GitHub's raw content API
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;

        const response = await fetch(rawUrl);

        if (!response.ok) {
            if (response.status === 404) {
                throw new ResourceError(
                    `File not found: ${filePath}`,
                    'github_file',
                    'not_found'
                );
            } else {
                throw new ResourceError(
                    `Failed to fetch file: ${response.status} ${response.statusText}`,
                    'github_file',
                    'fetch_error'
                );
            }
        }

        const content = await response.text();
        outputLogs.push(`✅ Successfully fetched file (${content.length} characters)`);

        return content;
    }, { operation: 'github_file_fetch', repoUrl, filePath, branch });
}

async function findTypeScriptFilesInRepo(repoUrl, branch = 'main') {
    return await safeExecute(async () => {
        const { owner, repo } = extractRepoInfo(repoUrl);

        logger.info('Searching for TypeScript files in repository', { owner, repo, branch });
        outputLogs.push(`🔍 Searching for TypeScript files in repository...`);

        // Get GitHub token from environment variable
        const githubToken = process.env.GITHUB_TOKEN;

        // Use GitHub's API to search for TypeScript files
        const searchUrl = `https://api.github.com/search/code?q=repo:${owner}/${repo}+extension:ts+path:/&per_page=100`;

        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Fuzzhead-Fuzzer'
        };

        // Add authorization header if token is available
        if (githubToken) {
            headers['Authorization'] = `token ${githubToken}`;
            outputLogs.push(`🔑 Using GitHub authentication`);
        } else {
            outputLogs.push(`⚠️  No GitHub token found - using unauthenticated API (rate limited)`);
        }

        const response = await fetch(searchUrl, { headers });

        if (!response.ok) {
            if (response.status === 401) {
                throw new ResourceError(
                    'GitHub API authentication required. Please set GITHUB_TOKEN environment variable.',
                    'github_search',
                    'authentication_required'
                );
            } else if (response.status === 403) {
                throw new ResourceError(
                    'GitHub API rate limit exceeded. Please try again later or use authentication.',
                    'github_search',
                    'rate_limit_exceeded'
                );
            } else {
                throw new ResourceError(
                    `Failed to search repository: ${response.status} ${response.statusText}`,
                    'github_search',
                    'api_error'
                );
            }
        }

        const searchResult = await response.json();
        const tsFiles = searchResult.items
            .filter(item => item.name.endsWith('.ts') && !item.name.endsWith('.d.ts'))
            .map(item => item.path);

        if (tsFiles.length === 0) {
            throw new ResourceError(
                'No TypeScript files found in the repository',
                'typescript_files',
                'discovery'
            );
        }

        outputLogs.push(`🔍 Found ${tsFiles.length} TypeScript file(s):`);
        tsFiles.forEach(file => {
            outputLogs.push(`   - ${file}`);
        });

        return tsFiles;
    }, { operation: 'github_file_search', repoUrl, branch });
}

async function processGitHubRepo(repoUrl, branch, filePath) {
    return await safeExecute(async () => {
        let filesToProcess = [];
        let fileContents = {};

        if (filePath) {
            // Process specific file
            const content = await fetchFileFromGitHub(repoUrl, filePath, branch);
            filesToProcess = [filePath];
            fileContents[filePath] = content;
        } else {
            // Find and process all TypeScript files
            filesToProcess = await findTypeScriptFilesInRepo(repoUrl, branch);

            // Fetch content for each file (limit to first 5 files to avoid rate limits)
            const filesToFetch = filesToProcess.slice(0, 5);
            outputLogs.push(`📥 Fetching content for ${filesToFetch.length} files...`);

            for (const file of filesToFetch) {
                try {
                    const content = await fetchFileFromGitHub(repoUrl, file, branch);
                    fileContents[file] = content;
                } catch (error) {
                    logger.warn(`Failed to fetch ${file}`, { error: error.message });
                    outputLogs.push(`⚠️  Warning: Failed to fetch ${file}: ${error.message}`);
                }
            }
        }

        if (Object.keys(fileContents).length === 0) {
            throw new ResourceError(
                'No files could be fetched from the repository',
                'github_files',
                'fetch_failed'
            );
        }

        // Process each file
        for (const [filePath, content] of Object.entries(fileContents)) {
            outputLogs.push(`\n📝 Processing file: ${filePath}`);

            // Create temporary file
            const tempFileName = `fuzz-${path.basename(filePath, '.ts')}-${Date.now()}.ts`;
            const tempFilePath = path.join('/tmp', tempFileName);
            const compiledFilePath = path.join('/tmp', tempFileName.replace('.ts', '.js'));

            // Write content to temporary file
            await safeExecute(
                () => fs.writeFileSync(tempFilePath, content),
                { operation: 'file_write', path: tempFilePath }
            );

            // Compile TypeScript
            const program = ts.createProgram([tempFilePath], {
                outDir: '/tmp',
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.NodeNext,
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                strict: false,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                declaration: false,
                sourceMap: false
            });

            const emitResult = program.emit();
            if (emitResult.emitSkipped) {
                const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
                const diagnostics = allDiagnostics.map(diagnostic => {
                    if (diagnostic.file) {
                        let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
                        let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                        return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
                    } else {
                        return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    }
                });

                logger.warn(`Compilation failed for ${filePath}`, { diagnostics });
                outputLogs.push(`⚠️  Warning: Compilation failed for ${filePath}`);
                outputLogs.push(`   Errors: ${diagnostics.join(', ')}`);
                continue;
            }

            outputLogs.push(`✅ Successfully compiled ${filePath}`);

            // Run fuzzer on the compiled file
            await analyseAndRun(tempFilePath, compiledFilePath);

            // Cleanup temporary files
            try {
                fs.unlinkSync(tempFilePath);
                fs.unlinkSync(compiledFilePath);
            } catch (error) {
                logger.warn('Failed to cleanup temporary files', { error: error.message });
            }
        }
    }, { operation: 'github_repo_processing', repoUrl, branch, filePath });
}

// --- Main Fuzzer Logic ---

async function analyseAndRun(sourceTsPath, compiledJsPath) {
    return await safeExecute(async () => {
        outputLogs.push(`\nFuzzing file: ${path.basename(compiledJsPath)}`);
        outputLogs.push(`   (Source: ${path.basename(sourceTsPath)})`);
        outputLogs.push('-'.repeat(50));

        const program = ts.createProgram([sourceTsPath], {});
        const sourceFileForAst = program.getSourceFile(sourceTsPath);
        if (!sourceFileForAst) {
            throw new ResourceError(
                'Could not get source file AST',
                'typescript_ast',
                'parsing'
            );
        }
        const checker = program.getTypeChecker();

        // Try to dynamically import the user's code that we just compiled
        let targetModule;
        try {
            targetModule = await import(`file://${compiledJsPath}?v=${Date.now()}`);
            logger.info('Successfully imported compiled module');
        } catch (error) {
            logger.warn('Could not import compiled module, continuing with AST analysis only', { error: error.message });
            outputLogs.push(`⚠️  Warning: Could not import compiled module: ${error.message}`);
            outputLogs.push("   Will continue with AST analysis only");
            targetModule = {};
        }

        // Register custom mock generators using the imported module (if available)
        if (targetModule.Sudoku) {
            registerMockGenerator('Sudoku', () => {
                const emptyBoard = Array(9).fill(0).map(() => Array(9).fill(0));
                return targetModule.Sudoku.from(emptyBoard);
            });
            outputLogs.push("   - Registered custom mock generator for type 'Sudoku'.");
        }

        if (targetModule.Player && PrivateKey) {
            registerMockGenerator('Player', () => {
                const mockKey = PrivateKey.random().toPublicKey();
                return new targetModule.Player({ publicKey: mockKey });
            });
            outputLogs.push("   - Registered custom mock generator for type 'Player'.");
        }

        // Main discovery and execution loop
        const moduleSymbol = checker.getSymbolAtLocation(sourceFileForAst);
        if (!moduleSymbol) {
            throw new ResourceError(
                'Could not find module symbol',
                'typescript_symbols',
                'resolution'
            );
        }

        const exports = checker.getExportsOfModule(moduleSymbol);
        for (const exportSymbol of exports) {
            const resolvedSymbol = (exportSymbol.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(exportSymbol) : exportSymbol;
            const declaration = resolvedSymbol.declarations?.[0];
            if (!declaration) continue;

            if (ts.isClassDeclaration(declaration)) {
                const className = resolvedSymbol.name;
                const isSmartContract = declaration.heritageClauses?.some(c => c.types.some(t => t.expression.getText(sourceFileForAst) === 'SmartContract')) ?? false;

                if (isSmartContract) {
                    outputLogs.push(`✅ Found SmartContract: ${className}`);
                    let instance;
                    try {
                        const ClassToRun = targetModule[className];
                        if (ClassToRun) {
                            instance = new ClassToRun();
                            outputLogs.push(`   - Instantiated ${className} successfully.`);
                        } else {
                            outputLogs.push(`   - ⚠️  Class ${className} not found in compiled module, skipping execution`);
                            continue;
                        }
                    } catch (e) {
                        logger.error(`Failed to instantiate ${className}`, { error: e.message });
                        outputLogs.push(`   - ❌ Failed to instantiate ${className}: ${e.message}`);
                        continue;
                    }

                    for (const member of declaration.members) {
                        if (ts.isMethodDeclaration(member)) {
                            const hasMethodDecorator = ts.canHaveDecorators(member) && ts.getDecorators(member)?.some(d => d.expression.getText(sourceFileForAst).startsWith('method'));
                            if (hasMethodDecorator) {
                                const methodName = member.name.getText(sourceFileForAst);
                                const mockArgs = member.parameters.map(p => {
                                    const typeKind = p.type?.kind ?? 131; // AnyKeyword
                                    const typeName = p.type?.getText(sourceFileForAst) || '';
                                    return generateMockValue(typeKind, typeName);
                                });
                                await executeFunction(`${className}.${methodName}`, instance[methodName].bind(instance), mockArgs);
                            }
                        }
                    }
                }
            }
        }
    }, { operation: 'fuzzer_analysis', sourceFile: sourceTsPath, compiledFile: compiledJsPath });
}

// --- Lambda Handler ---
export const handler = async (event) => {
    // Reset logs and logger for each invocation
    outputLogs = [];
    logger.clear();

    logger.info('Lambda handler started', {
        requestId: event.requestContext?.requestId,
        timestamp: new Date().toISOString()
    });

    try {
        // Parse and validate request body
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (error) {
            throw new ValidationError('Invalid JSON in request body', 'body', event.body);
        }

        // Validate and sanitize input
        const validatedBody = validateAndSanitizeInput(body);
        const { mode, code, repoUrl, branch, filePath } = validatedBody;

        logger.info('Request validated successfully', { mode, hasCode: !!code, hasRepoUrl: !!repoUrl });

        if (mode === 'repo') {
            // GitHub repository mode
            validateGitHubUrl(repoUrl);
            validateFilePath(filePath);

            await processGitHubRepo(repoUrl, branch || 'main', filePath);
        } else {
            // Code input mode
            validateTypeScriptCode(code);

            const targetFileName = 'fuzz-target.ts';
            const compiledFileName = 'fuzz-target.js';
            const targetTsPath = path.join('/tmp', targetFileName);
            const compiledJsPath = path.join('/tmp', compiledFileName);

            // Write code to file
            await safeExecute(
                () => fs.writeFileSync(targetTsPath, code),
                { operation: 'file_write', path: targetTsPath }
            );
            outputLogs.push(`Successfully wrote code to ${targetTsPath}`);

            // Compile TypeScript
            const program = ts.createProgram([targetTsPath], {
                outDir: '/tmp',
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.NodeNext,
                esModuleInterop: true,
            });

            const emitResult = program.emit();
            if (emitResult.emitSkipped) {
                const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
                const diagnostics = allDiagnostics.map(diagnostic => {
                    if (diagnostic.file) {
                        let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
                        let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                        return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
                    } else {
                        return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    }
                });

                throw new CompilationError("TypeScript compilation failed", diagnostics);
            }
            outputLogs.push(`Successfully compiled to ${compiledJsPath}`);

            // Call the main fuzzer logic
            await analyseAndRun(targetTsPath, compiledJsPath);
        }

        // Return success response
        const summary = logger.getSummary();
        logger.info('Fuzzing completed successfully', summary);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
                success: true,
                message: "Fuzzing complete.",
                output: outputLogs.join('\n'),
                summary: {
                    totalLogs: summary.total,
                    errors: summary.errors,
                    warnings: summary.warnings
                }
            }),
        };

    } catch (error) {
        // Log the error with full context
        logger.error('Lambda handler failed', {
            error: error.message,
            stack: error.stack,
            requestBody: event.body
        });

        // Return structured error response
        return createErrorResponse(error, outputLogs);
    }
};
