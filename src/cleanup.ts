import * as core from '@actions/core';

// Environment variable names — must match conductorone-sdk-go, cone, and terraform-provider-conductorone.
const ENV_ACCESS_TOKEN = 'CONDUCTORONE_ACCESS_TOKEN';
const ENV_CLIENT_ID = 'CONDUCTORONE_CLIENT_ID';

/**
 * Post-action cleanup: unset environment variables to prevent leaking
 * credentials to subsequent job steps or other workflows.
 */
function cleanup(): void {
    try {
        core.exportVariable(ENV_ACCESS_TOKEN, '');
        core.exportVariable(ENV_CLIENT_ID, '');
        core.info('ConductorOne credentials cleaned up');
    } catch (error) {
        // Cleanup errors should not fail the overall job
        if (error instanceof Error) {
            core.warning(`Cleanup warning: ${error.message}`);
        }
    }
}

cleanup();
