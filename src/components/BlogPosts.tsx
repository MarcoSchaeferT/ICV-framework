"use client";

import { ImageBlogPostHandler } from "./BlogImageHelper"
import { useTranslations } from "next-intl"
import { t_richConfig } from '@/app/const_store';

/**
 * Localized domain-information article and media metadata.
 *
 * @example
 * ```ts
 * const denguePost: BlogPostProps = {
 *   title: "Dengue virus serotypes",
 *   column_2: "Aedes mosquitoes",
 *   content: "DENV-1 through DENV-4 are represented in the sequence dataset.",
 *   imageUrl: "/images/dengue-serotypes.jpg",
 *   imageCaption: "Dengue serotype overview",
 *   sourceURL: "https://example.org/dengue-image-source",
 *   textSourceURL: "https://example.org/dengue-reference",
 * };
 * ```
 */
export interface BlogPostProps {
  /** Article heading; rendered as trusted HTML. */
  title: string
  /** Optional second-column label used by tabular accordions. */
  column_2?: string
  /** Main article body; rendered as trusted HTML. */
  content: string
  /** Next.js-compatible image URL. */
  imageUrl: string
  /** Optional trusted-HTML image caption. */
  imageCaption?: string
  /** Optional image provenance URL. */
  sourceURL?: string
  /** Optional prose/source reference URL. */
  textSourceURL?: string
  /** Legacy flag indicating that image data may require blob loading. */
  isLoadAsBlob?: boolean
  /** Optional destination opened when the image is selected. */
  link?: string
}

/**
 * Renders alternating image/text domain-information articles.
 *
 * @param props - Localized article records.
 * @returns One responsive article row per record.
 *
 * @remarks
 * `title`, `content`, and `imageCaption` are rendered as HTML and therefore must come from trusted, maintained content
 * modules rather than unvalidated user input.
 */
export function BlogPost({ blogContent }: { blogContent: BlogPostProps[] }) {
  let t = useTranslations("component_blogPosts");
    return (
      blogContent.map((post, index) => (
        <div key={post.title+index} className="my-16">
      <div className={`flex flex-col md:flex-row items-center gap-8 ${(index % 2 !== 0) ? 'md:flex-row-reverse' : ''}`}>
        <div className="w-full md:w-5/12 relative flex items-center content-center ">
          <ImageBlogPostHandler 
            postsData={blogContent}
            index={index}/>
        </div>
        <div className="w-full md:w-7/12 space-y-4 text-justify hyphens-auto">
          <h2 className="text-2xl font-bold" dangerouslySetInnerHTML={{ __html: post.title }}></h2>
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>
      </div>
      {post.textSourceURL && (
        <div className="w-full mt-4 opacity-50 bg-white rounded-lg text-xs p-1">
           {t.rich('source',{...t_richConfig})}:&nbsp;
                  <a target="_blank" className="text-sky-900" href={post.textSourceURL}>{post.textSourceURL}</a>
        </div>
      )}
      </div>
    ))
  )
}
