import { useState } from "react";
import Image from 'next/image'
import { BlogPostProps } from "./blogPosts"

interface ImageBlogPostHandlerProps {
    postsData: BlogPostProps[];
    index: number;
}

interface ImageTooltipProps {
    sourceURL?: string;
}


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
 * @param {string} props.sourceURL - The URL of the image to be displayed in the tooltip.
 * @returns {JSX.Element} The rendered tooltip component.
 */
function ImageTooltip({ sourceURL }: ImageTooltipProps) {
    return (
        <div className="absolute  mt-2 -ml-2 opacity-50 bg-white rounded-lg shadow-md text-xs p-1">
            <p>{sourceURL}</p>
        </div>
    )
}



