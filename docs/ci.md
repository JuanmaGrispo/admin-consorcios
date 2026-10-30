# Integración continua de versiones

El workflow `.github/workflows/ci.yml` se ejecuta únicamente al subir un tag
cuyo nombre empiece con `v`, por ejemplo `v1.0.0`. No se ejecuta por pushes
a ramas ni por pull requests. Publicar una Release para un tag que ya existe
no dispara otra ejecución: el disparador es el push del tag.

Cada ejecución descarga el commit del tag, instala las dependencias con el
lockfile y ejecuta cuatro verificaciones independientes:

| Verificación | Comando |
|---|---|
| Tipos del backend y frontend | `pnpm typecheck` |
| ESLint del frontend | `pnpm front lint` |
| Todas las pruebas automatizadas disponibles | `pnpm test` |
| Compilación del backend y frontend | `pnpm build` |

Actualmente las pruebas automatizadas están en el backend. El frontend no
tiene un script `test`; al incorporarlo, `pnpm test` también lo ejecutará.
El backend se analiza con TypeScript; no tiene ESLint configurado.

Se usa Node.js 22 y la versión de pnpm declarada en `package.json`.
Las verificaciones no despliegan la aplicación ni requieren secretos de
producción. La compilación del frontend necesita acceso a Google Fonts.
`db:verify` sigue siendo una comprobación previa al commit según `AGENTS.md`;
no forma parte de este workflow porque consulta la base compartida.

## Publicar una versión

1. Incorporar el workflow mediante PR a `develop` y promover la versión estable
   a `main` mediante PR.
2. Crear un tag sobre el SHA del commit de entrega que incluya el workflow:

   ```bash
   git tag -a v1.0.0 <SHA_DEL_COMMIT> -m "Entrega v1.0.0"
   git push origin v1.0.0
   ```

3. En GitHub → Actions, abrir `CI de versión` y comprobar que los cuatro jobs
   estén en verde para ese tag. Guardar el enlace de la ejecución como evidencia.
4. Opcionalmente publicar una GitHub Release seleccionando ese mismo tag.

La trazabilidad queda como versión → commit → ejecución de CI → resultados.
El tag por sí solo no garantiza que las verificaciones hayan aprobado. Si hay
fallas de código, corregirlas mediante el flujo de PR y crear una nueva versión,
sin mover el tag de una entrega anterior.
