import { build } from 'esbuild';

const shared = {
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
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
