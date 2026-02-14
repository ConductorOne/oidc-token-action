import { build } from 'esbuild';

const shared = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: true,
    minify: false,
};

await build({
    ...shared,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
});

await build({
    ...shared,
    entryPoints: ['src/cleanup.ts'],
    outfile: 'dist/cleanup.js',
});
