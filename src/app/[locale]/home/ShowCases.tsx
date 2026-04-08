"use client"
import type React from "react"
import Image from "next/image"
import { Link } from "@/i18n/routing";
import { Locale, useLocale } from "next-intl";
import { showCasesList } from "../../../../messages/showCasesContent";
import { useUIContext } from "@/app/components/contexts/UIContext";

export default function ShowcaseGrid() {

  const locale = useLocale() as Locale;
  let showcases = showCasesList[locale];
  const UI_contextT = useUIContext();
  return (
   <div className="p-2  size-full">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {showcases.map((showcase, index) => (
            <Link
              key={index}
              href={showcase.link}
              className="relative bg-white/15 backdrop-blur-lg rounded-3xl border border-gray-400/50 shadow-2xl overflow-hidden hover:shadow-3xl hover:bg-white/20 hover:border-indigo-600 transition-all duration-500 cursor-pointer group hover:scale-[1.04]"
              onClick={() => { UI_contextT.curDocsNameRef.current = showcase.title; }}
            >
              {/* Background Image */}
              <div className="absolute inset-0">
                <Image
                  src={showcase.backgroundImage || "/placeholder.svg"}
                  alt={`${showcase.title} visualization`}
                  fill
                  className="object-cover blur-[0px] opacity-30 group-hover:opacity-40 transition-opacity duration-300"
                />
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-linear-to-br from-white/25 via-white/15 to-white/5"></div>
              </div>

              {/* Content */}
              <div className="relative z-10 pr-6 pl-6 pt-2 h-72 flex flex-col">
                {/* Text Container - Rounded Rectangle Overlay */}
                <div className="bg-white/20 backdrop-blur-md rounded-2xl border border-white/50 shadow-lg p-6 mb-4">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight tracking-tight drop-shadow-lg mb-3">
                    {showcase.title}
                  </h3>
                  <p className="text-gray-800 text-sm leading-relaxed font-medium drop-shadow-md">
                    {showcase.description}
                  </p>
                </div>

                {/* Spacer to push icon to bottom */}
                <div className="flex-1"></div>

                {/* Icon in bottom right */}
                <div className="flex justify-end mb-5 items-end">
                  <div className="bg-white/25  backdrop-blur-sm rounded-xl p-4 border border-white/40 shadow-lg hover:bg-white/30 transition-colors duration-200">
                    <div className="text-gray-800 drop-shadow-sm">{showcase.icon}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
