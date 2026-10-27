"use client";

import type { JSX } from "react";

/**
 * Renders the Flasgger Swagger UI inside an embedded frame within the application shell.
 *
 * @returns Full-height card framing the proxied `/api-docs` OpenAPI explorer.
 */
export default function ApiDocsPage(): JSX.Element {
  return (
    <div className="mx-auto mt-6 mb-8 flex w-full max-w-7xl flex-col px-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
        <iframe
          src="/api-docs"
          title="ICV REST API — Swagger UI"
          className="h-[calc(100vh-115px)] w-full border-0"
        />
      </div>
    </div>
  );
}
