
/**
 * Applies the standard readable typography used by full-page MDX documentation.
 *
 * @param props - Compiled localized MDX children.
 * @returns A responsive prose container for documentation pages.
 */
export default function MdxLayout({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
      <div className="legacy-mdx not-fumadocs-codeblock not-fumadocs-code dark:legacy-mdx-invert max-w-none
        legacy-mdx-headings:font-semibold legacy-mdx-headings:tracking-tight
        legacy-mdx-h1:text-5xl legacy-mdx-h2:text-4xl legacy-mdx-h3:text-3xl legacy-mdx-h4:text-2xl legacy-mdx-h5:text-xl legacy-mdx-h6:text-lg
        legacy-mdx-p:leading-relaxed legacy-mdx-p:text-base
        legacy-mdx-a:text-blue-600 dark:legacy-mdx-a:text-blue-400 hover:legacy-mdx-a:underline
        legacy-mdx-code:text-pink-600 dark:legacy-mdx-code:text-pink-400 legacy-mdx-code:before:content-[''] legacy-mdx-code:after:content-['']
        legacy-mdx-pre:bg-gray-900 legacy-mdx-pre:text-gray-100 legacy-mdx-pre:rounded-xl legacy-mdx-pre:p-4
        legacy-mdx-img:rounded-xl legacy-mdx-img:shadow-md
        legacy-mdx-th:border-r legacy-mdx-th:border-gray-300 dark:legacy-mdx-th:border-gray-700
        legacy-mdx-td:border-r legacy-mdx-td:border-gray-300 dark:legacy-mdx-td:border-gray-600
      "
      >
        {children}
      </div>
  )
}


/**
 * Applies compact, high-contrast typography to MDX rendered inside visualization tooltips.
 *
 * @param props - Compiled localized MDX children.
 * @returns A dark tooltip-safe prose container.
 */
export function MdxLayoutTooltip({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
      <div
        className="
          legacy-mdx legacy-mdx-tooltip legacy-mdx-invert not-fumadocs-codeblock not-fumadocs-code
          legacy-mdx-headings:font-semibold legacy-mdx-headings:tracking-tight
          legacy-mdx-h1:text-5xl legacy-mdx-h2:text-4xl legacy-mdx-h3:text-3xl legacy-mdx-h4:text-2xl legacy-mdx-h5:text-xl legacy-mdx-h6:text-lg
          legacy-mdx-h1:text-white
          legacy-mdx-a:text-blue-600 dark:legacy-mdx-a:text-blue-400 hover:legacy-mdx-a:underline
          legacy-mdx-code:text-pink-600 dark:legacy-mdx-code:text-pink-400 legacy-mdx-code:before:content-[''] legacy-mdx-code:after:content-['']
          legacy-mdx-pre:bg-gray-900 legacy-mdx-pre:text-gray-100 legacy-mdx-pre:rounded-xl legacy-mdx-pre:p-4
          legacy-mdx-img:rounded-xl legacy-mdx-img:shadow-md
          legacy-mdx-th:border-r legacy-mdx-th:border-gray-300 dark:legacy-mdx-th:border-gray-700
          legacy-mdx-td:border-r legacy-mdx-td:border-gray-300 dark:legacy-mdx-td:border-gray-600
          legacy-mdx-strong:text-white
          relative
          inline-block
         
          rounded-md
          bg-gray-900/90 text-gray-50 text-sm leading-snug px-3 py-2 shadow-lg border border-gray-700 size-full
          
        "
      >
        {children}
      </div>
  )
}


/**
 * Applies the restrained typography used by project and domain-information prose.
 *
 * @param props - Compiled localized MDX children.
 * @returns A prose container optimized for longer descriptive text.
 */
export function MdxLayoutAbout({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
      <div className="legacy-mdx not-fumadocs-codeblock not-fumadocs-code
        legacy-mdx-a:text-accent
        text-lg text-muted-foreground mb-6
        legacy-mdx-a:no-underline
        text-justify
      "
            >
        {children}
            </div>
  )
}
