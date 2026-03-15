# Agent Markdown Style Guide

To prevent recurring linting errors and ensure consistency, all agent-generated documentation must
adhere to these rules:

## 1. List Indentation (MD007)

- Use **2 spaces** for nested lists.
- Avoid 4-space indentation for sub-items unless required by specific syntax.

## 2. Blank Lines (MD022, MD032, MD031)

- This is the main source of the current errors in the repo.
- **Headings:** Always surround headings with at least one blank line.
- **Lists:** Surround lists with blank lines (before the first item and after the last).
- **Code Fences:** Always surround fenced code blocks (```) with blank lines.

## 3. Tables (MD060)

- Ensure table pipes have consistent spacing.
- **Correct:** `| Header |`
- **Incorrect:** `|Header|`

## 4. Trailing Punctuation (MD026)

- Avoid trailing punctuation in headings (e.g., colons at the end of `## Step 1:`).

## 5. Bare URLs (MD034)

- Never use bare URLs. Always wrap them in brackets or link syntax.
- **Correct:** `<https://example.com>` or `[Link](https://example.com)`
- **Incorrect:** `https://example.com`
