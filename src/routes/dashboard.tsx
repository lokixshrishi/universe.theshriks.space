import { createFileRoute, notFound } from '@tanstack/react-router'
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getDashboardData } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    // Dashboard is only accessible in local development
    if (import.meta.env.PROD) {
      throw notFound();
    }
  },
  component: DashboardComponent,
  head: () => ({
    meta: [{ title: "The Shriks - Dashboard" }],
  }),
});

type DashboardEntry = {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  created_at: string;
};

function DashboardComponent() {
  const fetchDashboardData = useServerFn(getDashboardData);
  const [data, setData] = useState<DashboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData()
      .then((res) => {
        setData(res as DashboardEntry[]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [fetchDashboardData]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F2F2F2] p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl mb-2 text-[#F2F2F2]">Venture Dashboard</h1>
            <p className="text-[#888] font-light">The Shriks Universe records</p>
          </div>
          <div className="bg-[#2B2B2B] px-4 py-2 rounded-md text-sm text-[#F2F2F2]">
            Total Entries: {loading ? "..." : data.length}
          </div>
        </header>

        {error && (
          <div className="bg-red-900/50 border border-red-500/50 p-4 rounded-md mb-8 text-red-200">
            {error}
          </div>
        )}

        <div className="bg-[#0A0A0A] border border-[#2B2B2B] rounded-lg overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#2B2B2B] border-b border-[#2B2B2B]">
                  <th className="py-4 px-6 font-medium text-sm text-[#888] uppercase tracking-wider">Date</th>
                  <th className="py-4 px-6 font-medium text-sm text-[#888] uppercase tracking-wider">Name</th>
                  <th className="py-4 px-6 font-medium text-sm text-[#888] uppercase tracking-wider">Email</th>
                  <th className="py-4 px-6 font-medium text-sm text-[#888] uppercase tracking-wider">Category</th>
                  <th className="py-4 px-6 font-medium text-sm text-[#888] uppercase tracking-wider">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2B2B2B]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#888]">
                      Loading records...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#888]">
                      No records found in the cosmos yet.
                    </td>
                  </tr>
                ) : (
                  data.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#1F3D2E]/20 transition-colors">
                      <td className="py-4 px-6 text-sm text-[#888] whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-sm font-medium">
                        {entry.name}
                      </td>
                      <td className="py-4 px-6 text-sm text-[#888]">
                        {entry.email}
                      </td>
                      <td className="py-4 px-6 text-sm">
                        <span className="inline-block px-3 py-1 bg-[#1F3D2E] text-[#F2F2F2] rounded-full text-xs">
                          {entry.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-[#aaa] max-w-xs truncate" title={entry.message}>
                        {entry.message}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
