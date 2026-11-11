import assert from 'node:assert/strict';
import { relative } from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';

test('lint tooling discovers both TypeScript entry points and enforces rules', async () => {
    const eslint = new ESLint();
    const results = await eslint.lintFiles(['src/**/*.ts']);
    assert.deepEqual(results.map(({ filePath }) => relative(process.cwd(), filePath).replaceAll('\\', '/')).sort(), [
        'src/cleanup.ts',
        'src/index.ts',
    ]);
    assert.ok(results.every(({ errorCount }) => errorCount === 0));
    assert.equal(await eslint.isPathIgnored('dist/index.js'), true);

    const [invalid] = await eslint.lintText('const unused: string = "unused";\n', { filePath: 'src/lint-fixture.ts' });
    assert.ok(invalid.messages.some(({ ruleId }) => ruleId === '@typescript-eslint/no-unused-vars'));
});
