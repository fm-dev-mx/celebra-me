#!/usr/bin/env python3
"""
Apply RGB -> var(--color-*) token replacements to _product-proof.scss.
Also collapse consecutive blank lines afterward.
"""
import re

FILEPATH = '/d/code/celebra-me/src/styles/home/_product-proof.scss'

# Mapping: rgb_color_value -> replacement
# Order matters: do alpha-containing values first to avoid partial matches.
REPLACEMENTS = [
    # --- champagne with alpha ---
    (r'rgb\(216\s+167\s+58\s*/\s*(\d+%)\)',  r'color-mix(in srgb, var(--color-champagne) \1, transparent)'),
    (r'rgb\(211\s+167\s+71\s*/\s*(\d+%)\)',  r'color-mix(in srgb, var(--color-champagne) \1, transparent)'),
    # --- champagne solid ---
    (r'rgb\(211\s+167\s+71\)',               r'var(--color-champagne)'),
    (r'rgb\(216\s+167\s+58\)',               r'var(--color-champagne)'),

    # --- ivory with alpha ---
    (r'rgb\(255\s+248\s+236\s*/\s*(\d+%)\)', r'color-mix(in srgb, var(--color-ivory) \1, transparent)'),
    (r'rgb\(255\s+246\s+230\s*/\s*(\d+%)\)', r'color-mix(in srgb, var(--color-ivory) \1, transparent)'),
    # --- ivory solid ---
    (r'rgb\(255\s+246\s+230\)',              r'var(--color-ivory)'),
    (r'rgb\(255\s+248\s+236\)',              r'var(--color-ivory)'),

    # --- soft-black with alpha ---
    (r'rgb\(8\s+7\s+6\s*/\s*(\d+%)\)',      r'color-mix(in srgb, var(--color-soft-black) \1, transparent)'),
    (r'rgb\(0\s+0\s+0\s*/\s*(\d+%)\)',       r'color-mix(in srgb, var(--color-soft-black) \1, transparent)'),
    # --- soft-black solid ---
    (r'rgb\(8\s+7\s+6\)',                    r'var(--color-soft-black)'),
    (r'rgb\(0\s+0\s+0\)',                    r'var(--color-soft-black)'),

    # --- forest with alpha ---
    (r'rgb\(7\s+31\s+27\s*/\s*(\d+%)\)',     r'color-mix(in srgb, var(--color-forest) \1, transparent)'),
    (r'rgb\(12\s+42\s+36\s*/\s*(\d+%)\)',    r'color-mix(in srgb, var(--color-forest) \1, transparent)'),
    # --- forest solid ---
    (r'rgb\(7\s+31\s+27\)',                  r'var(--color-forest)'),
    (r'rgb\(12\s+42\s+36\)',                 r'var(--color-forest)'),

    # --- forest-deep with alpha ---
    (r'rgb\(18\s+56\s+47\s*/\s*(\d+%)\)',    r'color-mix(in srgb, var(--color-forest-deep) \1, transparent)'),
    (r'rgb\(3\s+15\s+13\s*/\s*(\d+%)\)',     r'color-mix(in srgb, var(--color-forest-deep) \1, transparent)'),
    # --- forest-deep solid ---
    (r'rgb\(18\s+56\s+47\)',                 r'var(--color-forest-deep)'),
    (r'rgb\(3\s+15\s+13\)',                  r'var(--color-forest-deep)'),
]

def apply_replacements(content):
    count = 0
    for pattern, replacement in REPLACEMENTS:
        new_content, n = re.subn(pattern, replacement, content)
        count += n
        content = new_content
    return content, count

def collapse_blank_lines(content):
    """Collapse 3+ consecutive blank lines to max 2."""
    return re.sub(r'\n\s*\n\s*\n\s*\n', '\n\n\n', content)

def main():
    with open(FILEPATH, 'r', encoding='utf-8') as f:
        original = f.read()

    content, count = apply_replacements(original)
    content = collapse_blank_lines(content)

    with open(FILEPATH, 'w', encoding='utf-8', newline='') as f:
        f.write(content)

    print(f'{FILEPATH}: {count} replacements applied')

if __name__ == '__main__':
    main()
