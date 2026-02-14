import * as core from '@actions/core';
import { HttpClient } from '@actions/http-client';

const GRANT_TYPE_TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange';
const SUBJECT_TOKEN_TYPE_JWT = 'urn:ietf:params:oauth:token-type:jwt';

// Environment variable names — must match conductorone-sdk-go, cone, and terraform-provider-conductorone.
const ENV_ACCESS_TOKEN = 'CONDUCTORONE_ACCESS_TOKEN';
const ENV_CLIENT_ID = 'CONDUCTORONE_CLIENT_ID';

interface TokenResponse {
    access_token: string;
    issued_token_type: string;
    token_type: string;
    expires_in: number;
}

interface TokenErrorResponse {
    error: string;
    error_description?: string;
}

async function run(): Promise<void> {
    try {
        const audience = core.getInput('audience', { required: true });
        const clientId = core.getInput('client_id', { required: true });

        // Step 1: Request GitHub OIDC token
        core.info('Requesting GitHub OIDC token...');
        const oidcToken = await core.getIDToken(audience);
        core.info('GitHub OIDC token obtained successfully');

        // Step 2: Exchange for ConductorOne access token
        core.info('Exchanging OIDC token for ConductorOne access token...');

        const tokenUrl = `https://${audience}/auth/v1/token`;
        const params = new URLSearchParams({
            grant_type: GRANT_TYPE_TOKEN_EXCHANGE,
            subject_token: oidcToken,
            subject_token_type: SUBJECT_TOKEN_TYPE_JWT,
            client_id: clientId,
        });

        const http = new HttpClient('conductorone-oidc-token-action');
        const response = await http.post(tokenUrl, params.toString(), {
            'Content-Type': 'application/x-www-form-urlencoded',
        });

        const statusCode = response.message.statusCode ?? 0;
        const body = await response.readBody();

        if (statusCode !== 200) {
            let errorMsg = `Token exchange failed with status ${statusCode}`;
            try {
                const errorResp: TokenErrorResponse = JSON.parse(body);
                if (errorResp.error_description) {
                    errorMsg += `: ${errorResp.error} - ${errorResp.error_description}`;
                } else if (errorResp.error) {
                    errorMsg += `: ${errorResp.error}`;
                }
            } catch {
                errorMsg += `: ${body}`;
            }
            throw new Error(errorMsg);
        }

        const tokenResp: TokenResponse = JSON.parse(body);

        if (!tokenResp.access_token) {
            throw new Error('Token exchange succeeded but returned empty access token');
        }

        // Step 3: Export credentials
        core.setSecret(tokenResp.access_token);
        core.exportVariable(ENV_ACCESS_TOKEN, tokenResp.access_token);
        core.exportVariable(ENV_CLIENT_ID, clientId);
        core.setOutput('access_token', tokenResp.access_token);

        core.info(`ConductorOne access token obtained (expires in ${tokenResp.expires_in}s)`);
        core.info(`Exported ${ENV_ACCESS_TOKEN} and ${ENV_CLIENT_ID} environment variables`);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed('An unexpected error occurred');
        }
    }
}

run();
