# Installing MetaMesh-UGA (for Cline / AI agents)

MetaMesh-UGA is a **remote, hosted MCP server** (no local build required). It is
a single endpoint that proxies and routes 13,000+ MCP tools, with a free monthly
call quota and pay-as-you-go billing after that.

## One-step install (recommended): add the remote MCP server

Add this entry to your MCP settings (e.g. Cline `cline_mcp_settings.json`,
Claude Desktop `claude_desktop_config.json`, or any MCP client):

```json
{
  "mcpServers": {
    "metamesh-uga": {
      "type": "streamableHttp",
      "url": "https://api.metamesh-uga.dev/mcp"
    }
  }
}
```

No API key is required to start: every caller gets a free monthly quota.
Discovery (`tools/list`) is always free.

## Optional: authenticate for higher limits and billing

1. Register an agent to receive an `agent_id` + `agent_key`:

   ```bash
   curl -X POST https://api.metamesh-uga.dev/v1/agent/register \
     -H "Content-Type: application/json" \
     -d '{"name":"my-agent"}'
   ```

2. Send these headers with MCP/HTTP requests once the free quota is used up:

   ```
   X-Agent-Id: <agent_id>
   X-Agent-Key: <agent_key>
   ```

3. Add prepaid credit (real Stripe Checkout) when you need pay-as-you-go:

   ```bash
   curl -X POST https://api.metamesh-uga.dev/v1/agent/topup \
     -H "Content-Type: application/json" \
     -H "X-Agent-Id: <agent_id>" -H "X-Agent-Key: <agent_key>" \
     -d '{"amount_usd": 10}'
   ```

## Optional: install the CLI

```bash
curl -s https://metamesh-uga.dev/install | bash
metamesh connect
metamesh call example.echo --message "hello"
```

## Verify

```bash
curl https://api.metamesh-uga.dev/health
curl "https://api.metamesh-uga.dev/v1/tools?limit=5"
```

- Website: https://metamesh-uga.dev
- Official MCP Registry: `dev.metamesh-uga/metamesh-uga`
- Repo: https://github.com/SiouxTXT/metamesh-uga
