import { useState } from "react";
import Image from 'next/image'
import { BlogPostProps } from "./BlogPosts"

/**
 * Article collection and selected image index for `ImageBlogPostHandler`.
 *
 * @example
 * ```ts
 * const imageProps: ImageBlogPostHandlerProps = {
 *   postsData: [{
 *     title: "Dengue virus",
 *     content: "Dengue is transmitted by infected Aedes mosquitoes.",
 *     imageUrl: "/viruses/Dengue_Virus.png",
 *   }],
 *   index: 0,
 * };
 * ```
 */
interface ImageBlogPostHandlerProps {
    /** Localized article records containing image and provenance fields. */
    postsData: BlogPostProps[];
    /** Zero-based index of the article image to render. */
    index: number;
}

/**
 * Optional provenance URL displayed while hovering an article image.
 *
 * @example
 * ```ts
 * const tooltip: ImageTooltipProps = {
 *   sourceURL: "https://www.rcsb.org/3d-view/1K4R/1",
 * };
 * ```
 */
interface ImageTooltipProps {
    /** Optional link to the image's source or structure record. */
    sourceURL?: string;
}


/**
 * Renders the image, attribution hover state, caption, and destination for one domain-information article.
 *
 * @param props - Complete post collection and index of the image to render.
 * @returns A responsive Next.js image with optional source tooltip and caption.
 */
export function ImageBlogPostHandler({ postsData: postData, index}: ImageBlogPostHandlerProps){

    const [isImageHover, setIsImageHover] = useState(false);
    let post = postData[index];
    // Use placeholder only if imageUrl is truly empty
    const imageUrl = post.imageUrl || "/placeholder.svg";

    return (
        <>
            <a href={post.link} target="_blank" rel="noopener noreferrer">
                <Image
                    src={imageUrl} 
            alt={post.title}
            width={480}
            height={320}
            className="rounded-lg shadow-md w-full h-auto hover:scale-105 hover:duration-200"
            onMouseEnter={() => setIsImageHover(true)}
            onMouseLeave={() => setIsImageHover(false)}
            />
             {isImageHover && (
            <ImageTooltip sourceURL={post.sourceURL} />
            )}
            {post.imageCaption && (
            <figcaption className={`ml-2 pt-1 text-xs text-gray-500 ${isImageHover ? '   text-transparent ' : ''}`}
                dangerouslySetInnerHTML={{ __html: post.imageCaption }}>
            </figcaption>
        )}
        </a>
        </>
    )
}

/**
 * A component that displays a tooltip with the given image source URL.
 *
 * @param props - Contains the optional image source URL displayed in the tooltip.
 * @returns The rendered tooltip component.
 */
function ImageTooltip({ sourceURL }: ImageTooltipProps) {
    return (
        <div className="absolute  mt-2 -ml-2 opacity-50 bg-white rounded-lg shadow-md text-xs p-1">
            <p>{sourceURL}</p>
        </div>
    )
}



