# Plan 018: Testing Utility & Dead-Weight Audit

**Objetivo**: Depurar la suite de pruebas eliminando archivos obsoletos y optimizando los existentes
bajo los estándares de **Lean Governance 2.0**.

## Proposed Changes

### [Component] Tests Cleanup

#### [DELETE] [sanity.test.ts](file:///c:/Code/celebra-me/tests/unit/sanity.test.ts)

- Eliminar por falta de utilidad (peso muerto).

#### [MODIFY] [FAQList.test.tsx](file:///c:/Code/celebra-me/tests/components/FAQList.test.tsx)

- Refactorizar para usar `@testing-library/user-event` en lugar de `fireEvent`.
- Asegurar que no genera advertencias de consola.

#### [MODIFY] [setup.ts](file:///c:/Code/celebra-me/tests/setup.ts)

- Revisar y limpiar mocks obsoletos o duplicados.
- Asegurar que los mocks de `import.meta.env` y Audio API estén actualizados.

## Verification Plan

### Automated Tests

- Ejecutar la suite completa: `pnpm test`
- Verificar cobertura: `pnpm test -- --coverage`
- Validar que no hay errores de linting en los tests refactorizados: `pnpm lint`

### Manual Verification

- Revisar los reportes de consola de Jest para asegurar que no hay warnings de "deprecated" o "not
  wrapped in act".
