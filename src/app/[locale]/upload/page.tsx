"use client";
import FileUploadForm from "@/app/components/upload";
import { ViewMainInfoComponent } from "@/app/components/viewPageMainInfo";
import { t_richConfig } from "@/app/const_store";
import MdxLayout from "@/mdx-layout";
import { useLocale, useTranslations } from "next-intl";
import { MDXContentProvider } from "../../../../messages/markdown/MDXContentProvider";
import { Link } from "@/i18n/routing";
import { TableRows } from "iconoir-react";

export default function UplaodPage() {

    const t = useTranslations("page_upload");
    const locale = useLocale();
   const MDX_content = MDXContentProvider[locale].pages.Upload.requirements;

    
return(
<>
  {/* Section for the File Upload Form */}
  <div className="min-h-[75vh] flex flex-col bg-gray-100">
    <div className="flex mt-50 items-center justify-center bg-gray-100 p-4 mb-20">
        <FileUploadForm />
    </div>

    {/* Link to the Metadata Editor */}
    <div className="flex items-center justify-center bg-gray-100 p-4">
      <Link
        href="/metadataEditor"
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 transition-colors"
      >
        <TableRows className="h-5 w-5" />
        {locale === "de" ? "Metadaten Editor" : "Metadata Editor"}
      </Link>
    </div> 
            
   <div className="flex items-center justify-center bg-gray-100 p-4">
    
    <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg md:p-8">

      
        <div className="flex flex-col items-center gap-8">

            {/* Section for MDX Content */}
            <div className="w-full max-w-3xl ">
                <MdxLayout>
                   
                    <MDX_content />
                </MdxLayout>
            </div>

            
        </div>
    </div>

</div>
</div>
</>

);
}
