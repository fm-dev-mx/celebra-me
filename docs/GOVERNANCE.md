# System Governance: The Vault Architecture

> **Status**: ACTIVE — Integrated with `gatekeeper` and `S0 Signature`. **Last Updated**: 2026-03-04

## Overview

The Governance Vault (`.agent/governance/`) is the central intelligence unit for maintaining the
integrity, naming standards, and documentation alignment of the `celebra-me` project. It
consolidates scattered scripts and configurations into a single, deterministic architecture.

---

## Directory Structure

| Path                        | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `.agent/governance/bin/`    | **The Brain**: Core scripts (`governance.js`, `gatekeeper.js`). |
| `.agent/governance/config/` | **The Law**: Policy, Baseline, and Domain Mapping.              |
| `.agent/governance/state/`  | **The Truth**: Current S0 Signature and system state.           |

---

## The Governance Micro-CLI (`governance.js`)

A lean, high-performance tool for audit and signing.

### Commands

| Command                     | Action                                                                            |
| --------------------------- | --------------------------------------------------------------------------------- |
| `pnpm governance audit`     | Runs full naming convention and intent drift checks.                              |
| `pnpm governance sign-s0`   | Generates a new `system-s0.json` signature based on all tracked files.            |
| `pnpm governance drift`     | Specifically checks for broken file references in documentation.                  |
| `pnpm governance verify-s0` | Verifies the current state against the stored signature (enforced by Gatekeeper). |

---

## Core Pillars

### 1. S0 Signature Integrity (A-4)

Every file's SHA-1 is included in a global payload, which is then hashed (SHA-256). This creates a
deterministic "fingerprint" of the entire repository. If the fingerprint changes without a re-sign,
the Gatekeeper blocks the commit, preventing unverified state changes.

### 2. Intent Drift Detection (A-3)

The system regularly scans `docs/` and `.agent/workflows/` for file path references. If a document
refers to a file that does not exist in the repository, it's flagged as "Intent Drift" (Block
severity).

### 3. Strict Naming Conventions (B-7)

Enforces `kebab-case` naming based on the domain mapping.

- **Rule**: `^[a-z0-9.-]+$`
- **Exemptions**: `README.md`, `CHANGELOG.md`.

---

## Operational Workflow

1. **Modify Code**: Do your development.
2. **Audit**: Run `pnpm governance audit`.
3. **Fix Drift**: If a file was renamed, update the corresponding documentation.
4. **Sign**: Once all findings are resolved, run `pnpm governance sign-s0`.
5. **Commit**: The `gatekeeper` will verify the signature and allow the commit.

---

> [!IMPORTANT] Never manually edit `system-s0.json`. Always use the `sign-s0` command to ensure the
> signature is mathematically correct.
