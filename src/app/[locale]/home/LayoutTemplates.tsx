"use client";

import type React from "react";
import { Link } from "@/i18n/routing";
import { Locale, useLocale } from "next-intl";
import { layoutTemplatesList } from "@messages/layoutTemplatesContent";
import { useUIContext } from "@/components/contexts/UIContext";

/**
 * Client component that renders the localized grid of available dashboard layout templates.
 *
 * @returns Responsive grid of interactive cards linking to each layout template route.
 *
 * @remarks
 * Uses `next-intl` for locale-aware route navigation and `UIContext` to store active document title references.
 *
 * @example
 * ```tsx
 * // Inside landing page section
 * <LayoutTemplatesGrid />
 * ```
 */
export default function LayoutTemplatesGrid() {
  const locale = useLocale() as Locale;
  const UI_contextT = useUIContext();
  const templates = layoutTemplatesList[locale] || layoutTemplatesList.en;

  return (
    <div className="p-2 size-full">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((template, index) => (
            <Link
              key={index}
              href={template.link}
              className="relative bg-white/15 backdrop-blur-lg rounded-3xl border border-gray-400/50 shadow-2xl overflow-hidden hover:shadow-3xl hover:bg-white/20 hover:border-indigo-600 transition-all duration-500 cursor-pointer group hover:scale-[1.04]"
              onClick={() => {
                if (UI_contextT.curDocsNameRef) {
                  UI_contextT.curDocsNameRef.current = template.title;
                }
              }}
            >
              {/* Glass overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-white/15 to-white/5"></div>

              {/* Content */}
              <div className="relative z-10 pr-6 pl-6 pt-4 h-64 flex flex-col justify-between">
                {/* Text Container */}
                <div className="bg-white/20 backdrop-blur-md rounded-2xl border border-white/50 shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight tracking-tight drop-shadow-lg mb-2">
                    {template.title}
                  </h3>
                  <p className="text-gray-800 text-sm leading-relaxed font-medium drop-shadow-md">
                    {template.description}
                  </p>
                </div>

                {/* Icon in bottom right */}
                <div className="flex justify-end mb-4 items-end">
                  <div className="bg-white/25 backdrop-blur-sm rounded-xl p-3 border border-white/40 shadow-lg hover:bg-white/30 transition-colors duration-200">
                    <div className="text-gray-800 drop-shadow-sm">{template.icon}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
