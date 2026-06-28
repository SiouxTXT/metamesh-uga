# MetaMesh-UGA — Security Model

> Version 1.0 — 2026-06-25

---

## Overview

MetaMesh-UGA is designed to be a secure control plane for the MCP ecosystem. Every MCP server is treated as untrusted by default until validated, scanned, and ranked.

---

## Authentication

| Method | Usage |
|--------|-------|
| **API Key** | `X-API-Key` header for REST API and CLI |
| **JWT** | `Authorization: Bearer <token>` for dashboard and user sessions |
| **Admin Key** | `X-Admin-Key` header for administrative operations |
| **OAuth** | Enterprise integration (planned) |

---

## Authorization

### RBAC

| Role | Permissions |
|------|-------------|
| **read** | List tools, call tools, view own usage |
| **write** | Register agents, configure tools |
| **admin** | Manage policies, trigger discovery, view all data |

### Policy Engine

- Policies are written in **Rego** (Open Policy Agent)
- Evaluated per request based on user, server, and request context
- Deny-by-default with explicit allow rules

Example policies:

```rego
package metamesh.policy

# Deny low-security servers
deny[msg] {
    input.server.security_score < 0.5
    msg = sprintf("Server %v has low security score", [input.server.name])
}

# Deny untrusted providers
deny[msg] {
    input.server.provider == "untrusted-provider"
    msg = "Provider not allowed by organization policy"
}
```

---

## Data Protection

| Layer | Mechanism |
|-------|-----------|
| **Encryption at rest** | AES-256-GCM for sensitive configs |
| **Encryption in transit** | TLS 1.3 |
| **Secret management** | Cloudflare Secrets / Wrangler secrets |
| **Config encryption** | User tool configs encrypted in `configs` table |

---

## MCP Server Security

### Security Scanner

Every MCP server is scanned automatically:

- **Dependency scan**: identify known vulnerable dependencies
- **CVE lookup**: cross-reference with NVD
- **Malware detection**: scan binaries and WASM modules
- **Permission analysis**: detect excessive permissions
- **Network analysis**: detect suspicious outbound calls
- **Filesystem analysis**: detect unsafe filesystem access

### Security Score

The security score is a normalized value between 0 and 1:

```
score = 1.0
- 0.3 per critical CVE
- 0.2 per high CVE
- 0.1 per excessive permission set
- 0.1 per suspicious network behavior
- 0.1 per suspicious filesystem behavior
- 0.0 if malware detected
```

Servers with `security_score < 0.5` are blocked by default unless explicitly allowed.

---

## Audit

All security-relevant events are logged:

- Authentication attempts
- Authorization decisions
- Policy changes
- Security scan results
- Admin actions
- Tool lifecycle transitions

---

## Compliance

- GDPR ready
- SOC2 planned
- ISO 27001 planned

---

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Malicious MCP server | Security scanner + policy engine + sandboxed WASM |
| Data exfiltration | Encrypted configs, per-tenant isolation, permission analysis |
| Abuse / overload | Rate limiting, bulkhead isolation, budget controls |
| Unauthorized admin access | Admin key, audit logging, least privilege |
| Registry poisoning | Federation validation, trust score, source verification |

---

*Last updated: 2026-06-25*
