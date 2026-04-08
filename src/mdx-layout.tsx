
export default function MdxLayout({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
      <div className="prose dark:prose-invert max-w-none
        prose-headings:font-semibold prose-headings:tracking-tight
        prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg
        prose-p:leading-relaxed prose-p:text-base
        prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline
        prose-code:text-pink-600 dark:prose-code:text-pink-400 prose-code:before:content-[''] prose-code:after:content-['']
        prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-4
        prose-img:rounded-xl prose-img:shadow-md
        prose-table:
        prose-th:border-r prose-th:border-gray-300 dark:prose-th:border-gray-700
        prose-td:border-r prose-td:border-gray-300 dark:prose-td:border-gray-600
        
      "
      >
        {children}
      </div>
  )
}


export function MdxLayoutTooltip({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
      <div
        className="
          prose prose-invert
          prose-headings:font-semibold prose-headings:tracking-tight
          prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg
          prose-h1:text-white
          prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline
          prose-code:text-pink-600 dark:prose-code:text-pink-400 prose-code:before:content-[''] prose-code:after:content-['']
          prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-4
          prose-img:rounded-xl prose-img:shadow-md
          prose-table:
          prose-th:border-r prose-th:border-gray-300 dark:prose-th:border-gray-700
          prose-td:border-r prose-td:border-gray-300 dark:prose-td:border-gray-600
          prose-strong:text-white
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


export function MdxLayoutAbout({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
      <div className="prose 
        prose-a:text-accent 
        text-lg text-muted-foreground mb-6
        prose-a:no-underline
        prose-p
        text-justify
        text-muted-foreground
        
            "
            >
        {children}
            </div>
  )
}
