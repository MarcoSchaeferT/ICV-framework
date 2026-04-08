"use client";

import { ImageBlogPostHandler } from "./blogImageHelper"
import { useTranslations } from "next-intl"
import { t_richConfig } from "../const_store";

export interface BlogPostProps {
  title: string
  column_2?: string
  content: string
  imageUrl: string
  imageCaption?: string
  sourceURL?: string
  textSourceURL?: string
  isLoadAsBlob?: boolean
  link?: string
}

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
