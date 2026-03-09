import { useState, useEffect, useCallback } from 'react';
import { Type, ImageIcon, Megaphone, Activity, ArrowUpRight, Loader2, BarChart2, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdVariant {
    id: string;
    headline: string;
    cta: string;
    status: string;
    performance_score: number;
    days_active: number;
}

interface Campaign {
    id: string;
    name: string;
    platform: string;
    status: string;
    budget: number;
}

interface PainPoint {
    id: string;
    theme: string;
}

export default function Dashboard() {
    const [variants, setVariants] = useState<AdVariant[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [varsRes, campsRes, ppRes] = await Promise.all([
                fetch("http://localhost:8000/ads/variants"),
                fetch("http://localhost:8000/campaigns/list"),
                fetch("http://localhost:8000/research/results"),
            ]);
            const [vars, camps, pp] = await Promise.all([varsRes.json(), campsRes.json(), ppRes.json()]);
            if (vars.status === "success") setVariants(vars.data || []);
            if (camps.status === "success") setCampaigns(camps.data || []);
            if (pp.status === "success") setPainPoints(pp.data || []);
        } catch (e) {
            console.error("Dashboard fetch error:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const activeVariants = variants.filter(v => v.status === 'active');
    const draftVariants = variants.filter(v => v.status === 'draft');
    const topVariants = [...variants]
        .filter(v => v.performance_score > 0)
        .sort((a, b) => b.performance_score - a.performance_score)
        .slice(0, 3);
    const activeCampaigns = campaigns.filter(c => c.status === 'Running' || c.status === 'active');
    const totalBudget = activeCampaigns.reduce((acc, c) => acc + (c.budget || 0), 0);
    const latestInsight = painPoints[0];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <Link to="/copy" className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition">
                    + New Ad Copy
                </Link>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Active Ad Variants</div>
                    <div className="text-3xl font-bold text-gray-900">
                        {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-300" /> : activeVariants.length}
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                        {draftVariants.length} drafts pending review
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Active Campaigns</div>
                    <div className="text-3xl font-bold text-gray-900">
                        {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-300" /> : activeCampaigns.length}
                    </div>
                    <div className="text-sm text-green-600 font-medium mt-2 flex items-center">
                        <ArrowUpRight className="w-4 h-4 mr-1" />${totalBudget.toFixed(0)}/day budget
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Total Variants in DB</div>
                    <div className="text-3xl font-bold text-gray-900">
                        {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-300" /> : variants.length}
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                        {variants.filter(v => v.status === 'retired').length} retired
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Latest Research Theme</div>
                    <div className="text-sm font-semibold text-gray-900 mt-1 line-clamp-2">
                        {loading ? "..." : latestInsight ? `"${latestInsight.theme}"` : "Run research to see insights"}
                    </div>
                    <Link to="/research" className="text-xs text-indigo-600 font-medium mt-auto pt-2 block hover:underline">
                        View in Research →
                    </Link>
                </div>
            </div>

            {/* Quick Actions */}
            <h2 className="text-lg font-bold text-gray-900 mt-2">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-4">
                <Link to="/research" className="bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition group flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div className="font-medium text-gray-800">Run Research</div>
                </Link>
                <Link to="/copy" className="bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition group flex items-center gap-4">
                    <div className="bg-teal-50 p-3 rounded-lg text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition">
                        <Type className="w-6 h-6" />
                    </div>
                    <div className="font-medium text-gray-800">Generate Copy</div>
                </Link>
                <Link to="/campaigns" className="bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition group flex items-center gap-4">
                    <div className="bg-orange-50 p-3 rounded-lg text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition">
                        <Megaphone className="w-6 h-6" />
                    </div>
                    <div className="font-medium text-gray-800">Launch Campaign</div>
                </Link>
                <Link to="/automation" className="bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition group flex items-center gap-4">
                    <div className="bg-purple-50 p-3 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition">
                        <BrainCircuit className="w-6 h-6" />
                    </div>
                    <div className="font-medium text-gray-800">Run Audit</div>
                </Link>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Top Performers */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-indigo-600" /> Top Performing Ad Variants
                    </h3>
                    {loading ? (
                        <div className="text-center py-4 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
                    ) : topVariants.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No scored variants yet. Promote some ads and sync analytics.</p>
                    ) : topVariants.map((v, i) => (
                        <div key={v.id} className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-xs">{i + 1}</div>
                                <div>
                                    <div className="font-medium text-sm text-gray-900 truncate max-w-[180px]">{v.headline}</div>
                                    <div className="text-xs text-gray-400">Active • {v.days_active}d</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-sm text-indigo-600">Score: {v.performance_score.toFixed(2)}</div>
                                <div className="text-xs text-green-600">{v.cta}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Recent Campaigns */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-orange-500" /> Recent Campaigns
                        </h3>
                        <Link to="/campaigns" className="text-xs text-indigo-600 font-medium hover:underline">View All</Link>
                    </div>
                    {loading ? (
                        <div className="text-center py-4 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
                    ) : campaigns.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No campaigns yet. Launch your first campaign.</p>
                    ) : campaigns.slice(0, 4).map((c) => (
                        <div key={c.id} className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                            <div>
                                <div className="font-medium text-sm text-gray-900">{c.name || c.id.substring(0, 8)}</div>
                                <div className="text-xs text-gray-400">{c.platform} • ${c.budget}/day</div>
                            </div>
                            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${c.status === 'Running' ? 'bg-green-100 text-green-700' :
                                    c.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-500'
                                }`}>{c.status}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
