# ConductorOne OIDC Token Action

Exchange a GitHub Actions OIDC token for a ConductorOne access token via [workload federation](https://www.conductorone.com/docs/workload-federation).

This enables secretless authentication from GitHub Actions to ConductorOne — no stored API keys required.

## Prerequisites

1. A ConductorOne service principal with a workload federation trust configured for GitHub Actions
2. The workflow must have `id-token: write` permission

## Usage

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: conductorone/oidc-token-action@v1
        with:
          audience: acme.conductorone.com
          client_id: clever-fox@acme.conductorone.com/wfe

      # The following environment variables are now set:
      #   CONDUCTORONE_ACCESS_TOKEN - Bearer token for API calls
      #   CONDUCTORONE_CLIENT_ID    - Trust client ID

      # Use with cone CLI
      - run: cone whoami

      # Use with Terraform
      - uses: hashicorp/setup-terraform@v3
      - run: terraform apply

      # Use with curl
      - run: |
          curl -H "Authorization: Bearer $CONDUCTORONE_ACCESS_TOKEN" \
            https://acme.conductorone.com/api/v1/auth/introspect
```

## Inputs

| Name | Required | Description |
|------|----------|-------------|
| `audience` | Yes | ConductorOne tenant domain (e.g. `acme.conductorone.com`) |
| `client_id` | Yes | Workload federation trust client ID (e.g. `clever-fox@acme.conductorone.com/wfe`) |

## Outputs

| Name | Description |
|------|-------------|
| `access_token` | ConductorOne access token |

## Environment Variables

The action sets the following environment variables for subsequent steps:

| Variable | Description |
|----------|-------------|
| `CONDUCTORONE_ACCESS_TOKEN` | Bearer token for authenticating to ConductorOne APIs |
| `CONDUCTORONE_CLIENT_ID` | The trust client ID used for authentication |

These variables are automatically cleaned up in the post-action step.

## How It Works

1. The action requests a GitHub OIDC token with the ConductorOne tenant domain as the audience
2. It exchanges the OIDC token for a ConductorOne access token via [RFC 8693 token exchange](https://datatracker.ietf.org/doc/html/rfc8693)
3. The access token is exported as `CONDUCTORONE_ACCESS_TOKEN` for downstream tools (cone, Terraform provider, SDK, curl)
4. All tokens are masked in GitHub Actions logs via `core.setSecret()`
5. Credentials are cleaned up automatically when the job completes

## Security

- The GitHub OIDC token is short-lived and scoped to the workflow run
- The ConductorOne access token is short-lived (~30 minutes)
- All tokens are masked in logs to prevent accidental exposure
- The trust's CEL conditions, CIDR allowlists, and scoped roles are enforced server-side
- Credentials are unset in the post-action cleanup step

## License

Apache-2.0
