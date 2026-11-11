const http = require('node:http');
const https = require('node:https');

// Only fixture hosts are redirected. Production bundles and TLS settings are unchanged.
https.request = (options, callback) => {
    const host = options.hostname ?? options.host;
    if (!['oidc.actions.test', 'tenant.conductorone.test'].includes(host)) {
        throw new Error(`Unexpected HTTPS request to ${host}`);
    }
    return http.request({
        ...options,
        protocol: 'http:',
        hostname: '127.0.0.1',
        host: '127.0.0.1',
        port: Number(process.env.TEST_HTTP_PORT),
        agent: false,
        headers: { ...options.headers, 'x-fixture-host': host },
    }, callback);
};
