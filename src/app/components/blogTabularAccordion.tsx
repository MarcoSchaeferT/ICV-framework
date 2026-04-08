"use client"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { BlogPostProps } from "./blogPosts"
import { ImageBlogPostHandler } from "./blogImageHelper"
import { useTranslations } from "next-intl"
import { t_richConfig } from '../const_store';


interface TabularAccordionProps {
    tabularAccordionContent: BlogPostProps[]
}

export function TabularAccordion({ tabularAccordionContent }: TabularAccordionProps) {

const columnCnt = 2
let t = useTranslations("component_blogTabularAccordion")

return (
    <Accordion type="single" collapsible className="w-full">
        <div className="grid grid-cols-2 px-2 py-2 font-semibold text-2xl bg-gray-100 rounded-t-lg">
        <div>{t.rich('viruses',{...t_richConfig})}</div>
        <div>{t.rich('vectors',{...t_richConfig})}</div>
        </div>
        {tabularAccordionContent.map((post: BlogPostProps, index: number) => (
        <AccordionItem
            key={index+post.title}
            value={index.toString()}
            className="border-b last:border-b-0 ml-2"
        >
            <AccordionTrigger className="hover:no-underline">
            <div className="grid grid-cols-2 w-full text-lg text-left">
                <div >{post.title}</div>
                <div className="px-2">{post.column_2}</div>
                {/* <div className="flex justify-end">
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                </div>*/}
            </div>
            </AccordionTrigger>
            <AccordionContent>
            <div className="flex flex-col md:flex-row gap-4 p-4">
                {/* set min-h-[340px] becasue --radix-accordion-content-height calacualtion works not well with the image which leads to: opening animation stops before the enire image is visible and the jumps to the end. (workaround is to set a min height) */}
                    <div className="w-full md:w-1/3 min-h-[340px] relative">
                    <ImageBlogPostHandler
                    postsData={tabularAccordionContent}
                    index={index}/>
                </div>
                <div className="w-full md:w-2/3 text-base">
                    <div className="pl-4" dangerouslySetInnerHTML={{ __html: post.content }} />
                </div>
            </div>
            {post.textSourceURL && (
                <div className="col-span-2 opacity-50 bg-white rounded-lg text-xs p-1">
                     {t.rich('source',{...t_richConfig})}:&nbsp;
         <a target="_blank" className="text-sky-900" href={post.textSourceURL}>{post.textSourceURL}</a>
                </div>
            )}
        </AccordionContent>
        </AccordionItem>
    ))}
    </Accordion>
    )
}





