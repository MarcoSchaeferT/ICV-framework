# Working in this repository

## Reuse the existing structure

- Before adding UI or documentation markup, search for the same pattern in the repository and read the component or renderer that implements it. Extend the existing pattern when it fits instead of creating a parallel version.
- The localized quick documentation lives in `messages/markdown/pages/FullDocu/fullDocu_en.mdx` and `fullDocu_de.mdx`. It is selected through `messages/markdown/MDXContentProvider.tsx` and rendered by `src/app/[locale]/docs/page.tsx`. Keep page content in MDX and the page component focused on its layout.
- The larger Fumadocs user and developer guides live in `content/docs`. Check which documentation surface a change belongs to before editing.
- `src/mdx-components.tsx` defines the MDX renderers, including localized links and GitHub-style callouts; `source.config.ts` defines the MDX compiler setup. Check these files before adding custom MDX presentation code.

## Writing MDX

- Use Markdown for headings, prose, lists, and links. In the localized quick documentation (`messages/markdown`), use GitHub-style callouts as in `messages/markdown/cheatSheet.mdx`:

  ```md
  > [!NOTE]
  > A short message with a [link](/en/docs/user-guide).
  ```

- In the Fumadocs portal (`content/docs`), use its registered `<Callout type="info">` or `<Callout type="warn">` component for notes and warnings. GitHub-style alerts also render there, but the native component matches the portal design.
- Do not recreate an existing callout with `<aside>`, `<div>`, an icon, or Tailwind classes inside MDX. Use JSX in MDX for registered components or behavior that Markdown cannot express.
- When editing localized quick documentation, update both `_en.mdx` and `_de.mdx`. Keep documentation prose in those files rather than adding duplicate translation keys to `messages/en.json` and `messages/de.json`.
- Use normal Markdown links in MDX. For links that intentionally switch language, specify the locale in the path and verify the rendered destination through `src/cutomMDXlink.js`.

## Verify documentation changes

- Review the rendered `/en/docs` and `/de/docs` output after changing shared MDX content or link handling. Run `npx next build` for MDX compiler or renderer changes (`npx.cmd next build` in PowerShell).
- Keep unrelated local changes intact.
