import {build} from 'esbuild';
import ts from 'typescript';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function generateBundle() {
    await build({
        entryPoints: ['src/index.ts'],
        bundle: true,
        platform: 'node',
        format: 'esm',
        outfile: 'dist/index.mjs',
        external: [
            '@mattermost/loadtest-browser-lib',
            '@mattermost/playwright-lib',
            '@playwright/test',
        ],
    });
}

function generateTypes() {
    const configPath = path.join(rootDir, 'tsconfig.json');
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, rootDir);

    const program = ts.createProgram(parsedConfig.fileNames, {
        ...parsedConfig.options,
        declaration: true,
        emitDeclarationOnly: true,
        outDir: path.join(rootDir, 'dist'),
    });

    const emitResult = program.emit();
    const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    if (diagnostics.length > 0) {
        const formatHost = {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getNewLine: () => ts.sys.newLine,
        };
        console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
        process.exit(1);
    }
}

await generateBundle();
generateTypes();
