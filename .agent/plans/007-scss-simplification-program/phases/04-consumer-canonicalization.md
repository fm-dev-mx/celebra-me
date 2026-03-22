# 04 Consumer Canonicalization

## Goal

Normalize component consumption and document the simplified rules contributors should follow.

## Scope

- migrate consumers away from `--color-primary`, `--color-secondary`, `--color-bg-primary`, and similar legacy aliases
- standardize import style and namespaces
- document `reuse vs new token vs local value` decision rules
- record final compatibility notes before any gatekeeper-ready review

## Work Items

- update touched consumers to use canonical semantic variables
- remove wildcard Sass usage and normalize import namespaces
- document when a value should remain local instead of being promoted into the token system
- record compatibility bridges that remain so later cleanup is explicit and bounded

## Acceptance Criteria

- touched consumers use canonical semantic variables
- import patterns are consistent
- plan docs reflect any intentional compatibility bridges left in place
