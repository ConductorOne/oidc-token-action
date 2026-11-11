import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const audience = 'tenant.conductorone.test';
const clientId = `trust@${audience}/wfe`;
const oidcToken = 'fixture-oidc-token';
const accessToken = 'fixture-access-token';

async function runBundle(t, { entry = 'index', status = 200, body, oidcStatus = 200, inputs = {} } = {}) {
    const directory = await mkdtemp(join(tmpdir(), 'oidc-action-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    // Run a copy outside the checkout: consumers have no node_modules installation.
    const bundle = join(directory, `${entry}.js`);
    await copyFile(new URL(`../dist/${entry}.js`, import.meta.url), bundle);
    const preload = join(directory, 'redirect-https.cjs');
    await copyFile(new URL('./fixtures/redirect-https.cjs', import.meta.url), preload);
    const envFile = join(directory, 'env');
    const outputFile = join(directory, 'output');
    await writeFile(envFile, '');
    await writeFile(outputFile, '');

    const requests = [];
    const server = createServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        requests.push({
            method: request.method,
            url: request.url,
            headers: request.headers,
            body: Buffer.concat(chunks).toString(),
        });
        response.setHeader('Content-Type', 'application/json');
        if (request.headers['x-fixture-host'] === 'oidc.actions.test') {
            response.statusCode = oidcStatus;
            response.end(JSON.stringify(oidcStatus === 200 ? { value: oidcToken } : { message: 'OIDC denied' }));
        } else {
            response.statusCode = status;
            response.end(body ?? JSON.stringify({ access_token: accessToken, expires_in: 1800 }));
        }
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    let result;
    try {
        result = { ...await execFileAsync(process.execPath, ['--require', preload, bundle], {
            cwd: directory,
            timeout: 10_000,
            // Do not inherit real credentials, proxy settings, or NODE_OPTIONS.
            env: {
                INPUT_AUDIENCE: audience,
                INPUT_CLIENT_ID: clientId,
                ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.actions.test/token?api-version=2.0',
                ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-request-token',
                GITHUB_ENV: envFile,
                GITHUB_OUTPUT: outputFile,
                TEST_HTTP_PORT: String(server.address().port),
                ...inputs,
            },
        }), code: 0 };
    } catch (error) {
        // Timeouts and spawn errors are test failures, not expected action failures.
        assert.equal(typeof error.code, 'number', error.message);
        assert.equal(error.killed, false, error.message);
        result = error;
    }
    return {
        ...result,
        requests,
        environment: await readFile(envFile, 'utf8'),
        output: await readFile(outputFile, 'utf8'),
    };
}

function commandValue(commands, name) {
    const match = commands.match(new RegExp(`(?:^|\\n)${name}<<([^\\r\\n]+)\\r?\\n([\\s\\S]*?)\\r?\\n\\1(?:\\r?\\n|$)`));
    assert.ok(match, `Missing ${name} command`);
    return match[2];
}

function assertNoCredentials(result) {
    assert.equal(result.environment, '');
    assert.equal(result.output, '');
}

test('standalone bundle exchanges OIDC token and masks and exports credentials', async (t) => {
    const result = await runBundle(t);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.requests.length, 2);
    const [oidc, exchange] = result.requests;
    assert.equal(oidc.method, 'GET');
    assert.equal(new URL(oidc.url, 'https://oidc.actions.test').searchParams.get('audience'), audience);
    assert.equal(oidc.headers.authorization, 'Bearer fixture-request-token');
    assert.equal(exchange.method, 'POST');
    assert.equal(exchange.url, '/auth/v1/token');
    assert.equal(exchange.headers['x-fixture-host'], audience);
    assert.equal(exchange.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(exchange.headers.authorization, undefined);
    assert.deepEqual(Object.fromEntries(new URLSearchParams(exchange.body)), {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: oidcToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        client_id: clientId,
    });
    assert.ok(result.stdout.includes(`::add-mask::${oidcToken}`));
    assert.ok(result.stdout.includes(`::add-mask::${accessToken}`));
    assert.equal(commandValue(result.environment, 'CONDUCTORONE_ACCESS_TOKEN'), accessToken);
    assert.equal(commandValue(result.environment, 'CONDUCTORONE_CLIENT_ID'), clientId);
    assert.equal(commandValue(result.output, 'access_token'), accessToken);
});

for (const name of ['AUDIENCE', 'CLIENT_ID']) {
    test(`missing ${name.toLowerCase()} fails before requesting credentials`, async (t) => {
        const result = await runBundle(t, { inputs: { [`INPUT_${name}`]: '' } });
        assert.equal(result.code, 1);
        assert.equal(result.requests.length, 0);
        assert.match(result.stdout, /::error::Input required and not supplied/);
        assertNoCredentials(result);
    });
}

test('missing OIDC permissions fail without exchanging or exporting credentials', async (t) => {
    const result = await runBundle(t, { inputs: { ACTIONS_ID_TOKEN_REQUEST_TOKEN: '' } });
    assert.equal(result.code, 1);
    assert.equal(result.requests.length, 0);
    assert.match(result.stdout, /::error::.*ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
    assertNoCredentials(result);
});

test('OIDC endpoint rejection fails without exchanging credentials', async (t) => {
    const result = await runBundle(t, { oidcStatus: 403 });
    assert.equal(result.code, 1);
    assert.equal(result.requests.length, 1);
    assert.match(result.stdout, /::error::.*Failed to get ID Token/);
    assertNoCredentials(result);
});

for (const fixture of [
    { name: 'rejected exchange', status: 401, body: JSON.stringify({ error: 'invalid_grant', error_description: 'Trust rejected' }), error: /Token exchange failed with status 401: invalid_grant - Trust rejected/ },
    { name: 'non-JSON rejection', status: 400, body: 'Bad request', error: /Token exchange failed with status 400: Bad request/ },
    { name: 'malformed success', body: 'not JSON', error: /::error::/ },
    { name: 'empty access token', body: JSON.stringify({ access_token: '' }), error: /Token exchange succeeded but returned empty access token/ },
]) {
    test(`${fixture.name} fails without exporting credentials`, async (t) => {
        const result = await runBundle(t, fixture);
        assert.equal(result.code, 1);
        assert.equal(result.requests.length, 2);
        assert.match(result.stdout, fixture.error);
        assertNoCredentials(result);
    });
}

test('standalone post-action bundle clears both credential variables', async (t) => {
    const result = await runBundle(t, {
        entry: 'cleanup',
        inputs: { CONDUCTORONE_ACCESS_TOKEN: accessToken, CONDUCTORONE_CLIENT_ID: clientId },
    });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.requests.length, 0);
    assert.equal(commandValue(result.environment, 'CONDUCTORONE_ACCESS_TOKEN'), '');
    assert.equal(commandValue(result.environment, 'CONDUCTORONE_CLIENT_ID'), '');
    assert.equal(result.output, '');
    assert.ok(!result.stdout.includes(accessToken));
});

test('cleanup command failure warns without failing the job', async (t) => {
    const result = await runBundle(t, { entry: 'cleanup', inputs: { GITHUB_ENV: '/nonexistent-oidc-action-fixture/env' } });
    assert.equal(result.code, 0);
    assert.equal(result.requests.length, 0);
    assert.match(result.stdout, /::warning::Cleanup warning:/);
});
