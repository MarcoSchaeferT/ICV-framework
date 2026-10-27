# ICV development and documentation rules

These rules guide changes to the ICV repository. Check the current source before documenting a contract: implementation, route registration, configuration, and tests take precedence over an older guide. If they disagree, correct the guide or report the implementation gap; do not turn an assumption into a guarantee.

## Architecture and supported scope

- The application uses Next.js App Router, React, TypeScript, Flask, PostgreSQL, Redis, Leaflet, D3, and localized UI text. Read `package.json`, `backend/requirements.txt`, and the lockfile for current versions instead of repeating version numbers here.
- Leaflet is the map container for production dashboards. `LeafD3Map.tsx` combines Leaflet with D3 and a WebGL canvas overlay for spatial grids; do not describe it as a canvas-tile-only implementation.
- Keep application routes and composition under `src/app`, visualization code under `src/components/plots`, and cross-view state under the relevant context. `src/framework/index.ts` catalogues documented exports for TypeDoc; application modules import contracts from their owning files.
- Use `next-intl` for application labels. `content/docs` is the Fumadocs portal; `messages/markdown` supplies legacy in-app help and localized content. Do not conflate these surfaces.

## Data access, API, and state

- Build frontend Flask URLs through `apiRoutes` where a builder exists. The Next.js rewrite proxies `/api/*` to Flask. The database read endpoint is `/api/getDataFromDB` (see `backend/index.py` and `src/app/api_routes.ts`). The route requires `relationName`; other parameters and response shapes vary by task. Check the route, validation model, and matching `backend/API_docs` YAML before documenting them.
- Use `useGetJSONData(url, isAllowed)` for cacheable JSON reads that follow its contract. Mutations, streams, assets, and other specialized requests may use their own request path. The hook shares in-flight requests and aborts the underlying request after the final subscriber releases it; its browser cache currently has a five-minute TTL and LRU limits of 32 entries or an estimated 256 MiB. Confirm these values in `src/app/hooks/useFetchAndCache.tsx` before repeating them in documentation.
- Distinguish the ordinary `dbDATA` response envelope from task-specific payloads. In particular, `responseFormat=map-grid-v1` is column-oriented with aligned arrays; document coordinate order from its producer and consumer. Never promise a row-array response for every task.
- Use parameterized SQL values and `psycopg.sql.Identifier` for dynamic identifiers. Distinguish process-local caches and pools from Redis coordination across workers. Follow `backend/rules.md` for Python docstrings and Flasgger YAML contracts.
- Keep transient pointer movement out of shared React context. Use `InterfaceContext` for selections that coordinate views, with explicit opt-in props where the component defines them. Check the current synchronization and debounce implementation rather than prescribing a fixed delay or legacy internal variable names.

## Visual and interaction quality

- Keep data units, provenance, missing-value meaning, and scale domains visible where users interpret charts and maps. Do not equate missing data with zero.
- Provide keyboard access, discernible focus, meaningful labels, and a non-color route to essential information. Test map controls and overlay pointer behavior in the actual component rather than applying one CSS rule to every overlay.
- Bound expensive requests and rendering work where the API supports limits. Explain any intentionally unbounded request and its operational cost.

## Documentation ownership and structure

- Write task-oriented end-user guidance in `content/docs/user-guide` in English and German. Write architecture, setup, integration examples, troubleshooting for contributors, and maintenance procedures in `content/docs/developer-guide` in English. German technical routes fall back to English through `src/lib/docs-i18n.ts`. Preserve the legacy `/[locale]/docs` help page unless a task explicitly changes it.
- Use MDX frontmatter with a specific `title` and `description`. Keep one reader goal per page; separate procedures from explanations and reference. State prerequisites, executable steps, expected results, and failure recovery for a procedure. Use relative links for nearby portal pages and verify targets and anchors.
- Keep navigation in the relevant `meta.json` file; update `meta.de.json` for translated navigation. Preserve parity between English and German user pages. Do not manually edit `content/docs/developer-guide/api/typescript`: TypeDoc generates it from the framework entry point and TSDoc.
- Treat TSDoc as the source for symbol-level TypeScript contracts and `backend/API_docs/*.yml` as the source for public Flask HTTP descriptions. MDX explains how to use and maintain those contracts; link to generated or live reference instead of duplicating long signatures or schemas.
- Code examples must use real exported names, valid syntax, safe sample data, and imports sufficient to understand the snippet. Mark partial snippets as partial. Do not include secrets or imply sample datasets exist in every deployment.

## Inline TypeScript API documentation

- Document observable contracts on declarations re-exported by `src/framework/index.ts`. Explain units, coordinate order, nullable values, sentinels, mutation, ownership, network or cache effects, and failure behavior where a type signature does not convey them. Keep internal helpers concise unless they carry a contract needed to maintain a public export.
- Use standard TSDoc tags such as `@remarks`, `@param`, `@returns`, `@typeParam`, `@example`, `@see`, and `@deprecated` when they add information. Prefer the standard `@defaultValue` for optional properties and configuration; retain existing `@default` only where migration has not yet been reviewed. Do not state a parameter default that the signature or implementation does not provide.
- Make examples self-contained when presented as copyable. Hand-written application examples should import each symbol from its owning module and group symbols from the same module. Generated TypeDoc symbol examples may import from `@/framework` to demonstrate the barrel's documented exports; that resolvable in-repository barrel is not the application's general import path or a published package. Avoid cycles through the barrel and keep server/client boundaries narrow. Include any necessary React context and explain deployment-specific sample relations. The TypeDoc example checker parses syntax; it does not prove type correctness or that a service exists.
- Generate TypeDoc after editing TSDoc, then inspect the affected pages. Do not edit generated MDX by hand.

## Review and verification

- For documentation-only work, change comments, MDX, navigation, and documentation configuration without changing runtime behavior. Report implementation gaps separately.
- Regenerate the TypeScript reference with `npm run docs:api` after TSDoc or barrel changes. Run `npm run docs:check` for TypeDoc, TypeScript, and TSDoc validation. The example checker parses snippets but does not typecheck each example as a standalone program; review imports and behavior manually.
- Compile the portal with the project build for MDX changes, inspect navigation and links, and test both `/en/docs/developer-guide` and the German fallback route when relevant. Check the final diff for generated-file churn and unintended application changes.
