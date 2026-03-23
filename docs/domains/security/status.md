# Security Domain Status

This document tracks the security posture, authentication contracts, and data-protection rules for the Celebra-me platform.

## Current Posture

| Feature | Protection | Status | Notes |
| :--- | :--- | :--- | :--- |
| RSVP Tokens | JWT + HMAC-SHA256 | 🟢 Verified | Secure unique links for guests |
| Multi-Domain CORS | Strict Origin Control | 🟢 Verified | Prevents malicious cross-site requests |
| Data Isolation | Sub-document scoping | 🟢 Verified | Guests cannot access other guest data |
| Admin Access | Supabase Auth + RLS | 🟢 Active | Secure management interface |

## Roadmap

- [ ] Rate limiting on RSVP submissions.
- [ ] End-to-end audit logs for admin actions.
- [ ] Automated security scanning in CI/CD pipeline.
