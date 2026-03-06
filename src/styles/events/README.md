# Event Override Styles

Use this folder for invitation-specific overrides scoped by slug.

- File name pattern: `<event-slug>.scss`
- Runtime loading: only imported for the matching route `/[eventType]/[slug]`
- Scope selector: `.event--<event-slug>`

Example:

```scss
.event--xv-ana-2026 {
	.hero-section {
		letter-spacing: 0.03em;
	}
}
```
