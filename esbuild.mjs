// Bundles the extension and its background indexer into dist/. `web-tree-sitter` stays external:
// it loads its WASM runtime from its own package folder, which ships in the .vsix.
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const context = await esbuild.context({
    entryPoints: { extension: 'src/extension.ts', worker: 'src/indexer/worker.ts' },
    outdir: 'dist',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: ['vscode', 'web-tree-sitter'],
    // ESM builds first: the UMD build of vscode-html-languageservice loads its parts with dynamic
    // require() calls that a bundle can't resolve.
    mainFields: ['module', 'main'],
    minify: production,
    sourcemap: !production,
    logLevel: 'warning',
});

if (watch) {
    await context.watch();
} else {
    await context.rebuild();
    await context.dispose();
}
