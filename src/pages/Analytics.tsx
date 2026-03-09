import { useState, useEffect, useCallback } from 'react';
import { Download, TrendingUp, BarChart2, RefreshCw, Loader2, Zap } from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';

interface AdPerformance {
    id: string;
    campaign_id: string;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    spend: number;
    date: string;
}

interface TimeSeries {
    date: string;
    spend: number;
    clicks: number;
    impressions: number;
    avg_ctr: number;
}

export default function Analytics() {
    const [performanceData, setPerformanceData] = useState<AdPerformance[]>([]);
    const [timeSeries, setTimeSeries] = useState<TimeSeries[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const totalSpend = performanceData.reduce((acc, curr) => acc + curr.spend, 0);
    const totalImpressions = performanceData.reduce((acc, curr) => acc + curr.impressions, 0);
    const totalClicks = performanceData.reduce((acc, curr) => acc + curr.clicks, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("http://localhost:8000/analytics/dashboard");
            const data = await res.json();
            if (data.status === "success") {
                setPerformanceData(data.data || []);
                setTimeSeries(data.time_series || []);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await fetch("http://localhost:8000/analytics/sync", { method: "POST" });
            await fetchDashboardData();
        } catch (error) {
            console.error("Sync failed:", error);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                    <p className="text-gray-500 text-sm mt-1">Monitor ad performance and uncover statistical winners.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-md font-medium hover:bg-indigo-100 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {syncing ? "Syncing..." : "Sync Latest Metrics"}
                    </button>
                    <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50 transition flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-5 shrink-0">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Total Spend</div>
                    <div className="text-2xl font-bold text-gray-900">${totalSpend.toFixed(2)}</div>
                    <div className="text-xs text-gray-400 mt-1">{performanceData.length} synced records</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Avg CTR</div>
                    <div className="text-2xl font-bold text-gray-900">{avgCtr.toFixed(2)}%</div>
                    <div className="text-xs text-gray-400 mt-1">{totalClicks.toLocaleString()} total clicks</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Avg CPC</div>
                    <div className="text-2xl font-bold text-gray-900">${avgCpc.toFixed(2)}</div>
                    <div className="text-xs text-gray-400 mt-1">{totalImpressions.toLocaleString()} impressions</div>
                </div>
                <div className="bg-indigo-600 p-5 rounded-xl shadow-sm text-white flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-indigo-200" />
                        <span className="font-semibold text-sm">AI Insight</span>
                    </div>
                    <p className="text-xs text-indigo-100 leading-relaxed">
                        {performanceData.length > 0
                            ? `Top campaign CTR: ${Math.max(...performanceData.map(r => r.ctr)).toFixed(2)}%. Run Marketing Brain to get optimization tips.`
                            : "Sync your campaigns to see AI-powered insights here."}
                    </p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-5 shrink-0">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-indigo-500" /> Spend Over Time
                    </h3>
                    {timeSeries.length > 0 ? (
                        <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={timeSeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v: number | undefined) => v != null ? [`$${v.toFixed(2)}`, 'Spend'] : ['-', 'Spend']} />
                                <Line type="monotone" dataKey="spend" stroke="#4f46e5" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-36 flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded border border-dashed border-gray-200">
                            {loading ? "Loading..." : "Sync campaigns to see chart data."}
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-4">CTR by Date</h3>
                    {timeSeries.length > 0 ? (
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={timeSeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                                <YAxis tick={{ fontSize: 10 }} unit="%" />
                                <Tooltip formatter={(v: number | undefined) => v != null ? [`${v.toFixed(2)}%`, 'CTR'] : ['-', 'CTR']} />
                                <Bar dataKey="avg_ctr" fill="#818cf8" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-36 flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded border border-dashed border-gray-200">
                            {loading ? "Loading..." : "Sync campaigns to see chart data."}
                        </div>
                    )}
                </div>
            </div>

            {/* Performance Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="p-5 border-b border-gray-100 shrink-0 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-gray-900">Recent Performance Records</h3>
                    <span className="text-xs text-gray-400 ml-auto">{performanceData.length} records</span>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold tracking-wider border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">Campaign ID</th>
                                <th className="px-6 py-3">Impressions</th>
                                <th className="px-6 py-3">Clicks</th>
                                <th className="px-6 py-3">CTR</th>
                                <th className="px-6 py-3">CPC</th>
                                <th className="px-6 py-3">Spend</th>
                                <th className="px-6 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading...
                                </td></tr>
                            ) : performanceData.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400 italic">
                                    No performance data. Launch a campaign and click "Sync".
                                </td></tr>
                            ) : performanceData.map((row, i) => (
                                <tr key={`${row.campaign_id}-${i}`} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-xs text-gray-700 border-l-4 border-indigo-500 pl-2">
                                            {(row.campaign_id || 'unknown').substring(0, 8)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{row.impressions.toLocaleString()}</td>
                                    <td className="px-6 py-4">{row.clicks.toLocaleString()}</td>
                                    <td className="px-6 py-4 font-bold text-indigo-600">{row.ctr}%</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">${row.cpc}</td>
                                    <td className="px-6 py-4 text-gray-700">${row.spend}</td>
                                    <td className="px-6 py-4 text-xs text-gray-400">{new Date(row.date).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
