"use client";

import { useGetJSONData } from '@/app/hooks/useFetchAndCache';
import { apiRoutes } from '@/app/api_routes';
import { useMemo } from "react";

export default function PageVisitStats() {
  const url = apiRoutes.fetchDbData({ relationName: "page_visits", feature: "ALL" });
  const [isLoading, data] = useGetJSONData(url);

  const stats = useMemo(() => {
    if (!data || (data as any).error) return [];

    const responseArray = (data as any).response;
    if (!Array.isArray(responseArray)) return [];

    const pageStats = new Map<string, { totalVisits: number; uniqueUsers: Set<string> }>();

    responseArray.forEach((row: any) => {
      const path = row.page_path || "/";
      const sessionId = row.session_id || "unknown";

      if (!pageStats.has(path)) {
        pageStats.set(path, { totalVisits: 0, uniqueUsers: new Set() });
      }

      const stat = pageStats.get(path)!;
      stat.totalVisits += 1;
      stat.uniqueUsers.add(sessionId);
    });

    const result = Array.from(pageStats.entries()).map(([path, stat]) => ({
      path,
      totalVisits: stat.totalVisits,
      uniqueUsers: stat.uniqueUsers.size,
    }));

    // Sort by total visits descending
    return result.sort((a, b) => b.totalVisits - a.totalVisits);
  }, [data]);

  if (isLoading) return <div>Loading page visit statistics...</div>;
  if (data && (data as any).error) return <div>Error loading stats: {(data as any).error}</div>;

  return (
    <div className="w-full mt-8 p-6 bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Page Visit Statistics</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-3 font-medium text-gray-600">Page Path</th>
              <th className="p-3 font-medium text-gray-600">Total Visits</th>
              <th className="p-3 font-medium text-gray-600">Unique Users</th>
            </tr>
          </thead>
          <tbody>
            {stats.length > 0 ? (
              stats.map((stat, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 text-gray-800">{stat.path}</td>
                  <td className="p-3 text-gray-800">{stat.totalVisits}</td>
                  <td className="p-3 text-gray-800">{stat.uniqueUsers}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="p-3 text-center text-gray-500">
                  No page visit data available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
