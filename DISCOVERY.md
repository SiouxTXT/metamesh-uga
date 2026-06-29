# MetaMesh-UGA — MCP Discoverability Tracker

Goal: maximum discoverability for **AI agents** across the MCP ecosystem.

Canonical identity:
- **Registry name:** `dev.metamesh-uga/metamesh-uga` (DNS-verified via `metamesh-uga.dev`)
- **MCP endpoint (remote, streamable-http):** `https://api.metamesh-uga.dev/mcp`
- **Repo:** https://github.com/SiouxTXT/metamesh-uga
- **Website:** https://metamesh-uga.dev
- **llms.txt:** https://metamesh-uga.dev/llms.txt

> Most directories (Glama, PulseMCP, mcp.so) **auto-sync from the MCP Official
> Registry**. Because we are published & `isLatest` there, we get crawled
> automatically — the only remaining work is to **claim** each listing so the
> title/description/links read the way we want and we get the "verified owner"
> badge.

## Status

| Directory | Method | Status | Action |
|---|---|---|---|
| **MCP Official Registry** | `server.json` + DNS auth (`scripts/mcp-publish.js`) | ✅ Published v2.0.1, `isLatest` | Re-run publisher on each version bump |
| **GitHub** | Public repo + topics | ✅ Live, topics set | — |
| **Glama** (glama.ai/mcp) | Auto-crawl from registry/GitHub | ⏳ Auto-indexed | Claim & verify owner: https://glama.ai/mcp/servers |
| **PulseMCP** (pulsemcp.com) | Auto-index from registry | ⏳ Auto-indexed | Claim listing: https://www.pulsemcp.com/ |
| **mcp.so** | Auto-index from registry / submit | ⏳ Auto-indexed | Submit/claim: https://mcp.so/submit |
| **Smithery** (smithery.ai) | `smithery` CLI publish | ☐ TODO (needs Smithery login) | `smithery mcp publish https://api.metamesh-uga.dev/mcp -n metamesh-uga/metamesh-uga` |
| **Awesome MCP Servers** (punkpeye/awesome-mcp-servers) | GitHub PR | ☐ TODO | PR adding entry under a relevant category |
| **Cline MCP Marketplace** (cline/mcp-marketplace) | GitHub issue/PR | ☐ TODO | Open submission issue with repo + endpoint |
| **modelcontextprotocol/servers** (community list) | GitHub PR | ☐ TODO | PR to the community servers README |

## One-line pitch (reuse in every submission)

> MetaMesh-UGA — a serverless edge control plane (MCP Operating System) to
> discover, route and monetize 13,000+ MCP tools through a single remote
> endpoint, with a free monthly quota then pay-as-you-go billing (Stripe + x402).

## Claim checklist (per directory)

1. Search for `metamesh-uga` (or the registry name `dev.metamesh-uga/metamesh-uga`).
2. Sign in, click "Claim"/"I'm the author", verify via GitHub/domain.
3. Set title `MetaMesh-UGA`, paste the one-line pitch, set website + repo links.
4. Confirm the remote endpoint is `https://api.metamesh-uga.dev/mcp` (streamable-http).

## Re-publish to the official registry (after any change)

```bash
# bump "version" in server.json first, then:
node scripts/mcp-publish.js
```
