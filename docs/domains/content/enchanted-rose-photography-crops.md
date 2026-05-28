# Enchanted Rose Photography Crop Implementation

## Resumen

Se implementaron los ajustes de fotografia para el demo `demo-xv-enchanted-rose`, con foco en
mantener visible el rostro de la quinceanera en hero, interludios y galeria, y en reforzar la
direccion visual de castillo encantado, lujo romantico, luz de velas, oro antiguo, burgundy y rosa
blush.

El cambio se mantuvo acotado al demo y al tema `enchanted-rose`. No se agrego una arquitectura nueva
de imagenes ni variantes adicionales de crop; la solucion usa datos existentes, variables CSS y
overrides SCSS puntuales.

## Archivos Modificados

- `src/content/event-demos/xv/demo-xv-enchanted-rose.json`
- `src/styles/themes/sections/hero/_enchanted-rose.scss`
- `src/styles/themes/sections/gallery/_enchanted-rose.scss`
- `tests/unit/invitation.presenter.test.ts`
- `tests/unit/theme-presets.test.ts`

## Cambios Implementados

### Hero

Se mantuvo `hero.webp` como imagen principal porque es la foto mas fuerte para el mood editorial y
romantico del demo.

Antes, el SCSS de Enchanted Rose usaba solamente `--hero-focal-point-default`, lo que anulaba los
focal points responsivos definidos en datos. Eso provocaba que en desktop el rostro quedara mal
encuadrado.

Ahora el hero usa:

```scss
object-position: var(--hero-focal-point, var(--hero-focal-point-default, center 32%));
```

Tambien se actualizaron los focal points del demo:

- Mobile: `50% 32%`
- Tablet: `50% 24%`
- Desktop: `50% 21%`

Resultado: el rostro, ojos y tiara permanecen visibles en mobile, tablet y desktop.

### Ubicacion / Recepcion

La imagen de recepcion cambio de `reception.webp` a `interlude02`.

Motivo: `reception.webp` tenia un tono mas casual y no funcionaba como foto de venue/recepcion
premium. `interlude02` comunica mejor mesa de gala, velas, rosas y lujo editorial.

### Galeria

Se curo el orden de la galeria para reforzar una narrativa mas premium:

- Se conservaron imagenes editoriales y cinematicas fuertes.
- Se removieron `gallery05`, `gallery08` y `gallery09` del set principal por ser menos consistentes
  con la direccion luxury fairytale.
- Se agrego `interlude01` como cierre/decorativo tematico de la rosa encantada.

Para `gallery07`, que era el mayor riesgo de crop en thumbnails, se agrego un override especifico:

```scss
--gallery-item-aspect-ratio-gallery-07: 2 / 3;
--gallery-item-position-gallery-07: 50% 18%;
```

Y se aplica al item actual mediante:

```scss
.gallery-grid__item[data-gallery-index='6'] {
  aspect-ratio: var(--gallery-item-aspect-ratio-gallery-07);

  img {
    object-position: var(--gallery-item-position-gallery-07);
  }
}
```

Resultado: la miniatura conserva rostro, tiara y cuerpo de forma mas intencional.

### Interludio Despues De Galeria

Se mantuvo `interlude03`, pero se cambio su focal point de `54% 62%` a `54% 22%`.

Motivo: en desktop el crop anterior perdia el rostro. El nuevo focal point ancla el encuadre hacia
la parte superior, manteniendo el rostro y la tiara visibles.

## Estrategia Tecnica

La implementacion usa la opcion menos invasiva:

1. Ajustar `object-position`.
2. Ajustar focal points en datos.
3. Agregar un override SCSS puntual para una miniatura de galeria.

No se crearon variantes Cloudinary/locales adicionales porque CSS fue suficiente para resolver los
riesgos de rostro.

## Cobertura Agregada

Se agregaron pruebas unitarias para evitar regresiones:

- El hero de Enchanted Rose debe usar `--hero-focal-point`.
- El hero debe conservar los focal points responsivos esperados.
- La recepcion debe usar `interlude02`.
- El segundo interludio debe usar `54% 22%`.
- La galeria no debe incluir `gallery08` ni `gallery09`.
- La galeria debe incluir `interlude01`.
- `gallery07` debe tener reglas especificas de aspect ratio y object position.

## QA Visual

Se verifico el demo en render fresco con Playwright en los anchos:

- `360px`
- `390px`
- `430px`
- `768px`
- `1024px`
- `1440px`

Checklist validado:

- Hero con rostro, ojos y tiara visibles.
- Recepcion usando imagen de mesa/venue.
- `gallery07` con rostro visible en thumbnail.
- Lightbox usando imagen completa con `object-fit: contain`.
- Interludio despues de galeria con rostro visible en mobile y desktop.

## Verificacion

Comandos ejecutados:

```bash
pnpm astro check
pnpm build
pnpm test
```

Resultado:

- `pnpm astro check`: paso sin errores.
- `pnpm build`: paso sin errores.
- `pnpm test`: paso con 96 suites aprobadas, 1 omitida, 1010 tests aprobados y 2 omitidos.

## Notas

- El cambio queda acotado a `demo-xv-enchanted-rose` y estilos `enchanted-rose`.
- `tsconfig.json` tenia un cambio local no relacionado antes de esta implementacion; no forma parte
  del trabajo fotografico.
- Aun existe una oportunidad futura de optimizar `srcset`/dimensiones responsive para algunas
  imagenes, pero no fue necesario para resolver el requerimiento de crop y visibilidad facial.
