import { Megaphone, Save, Play, Pause, ExternalLink, Loader2, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Campaign {
    id: string;
    name: string;
    platform: string;
    budget: number;
    status: string;
    objective: string;
    created_at: string;
    ctr?: number;
    cpc?: number;
}

export default function CampaignManager() {
    const [platform, setPlatform] = useState('Meta');
    const [budget, setBudget] = useState(50);
    const [audience, setAudience] = useState('Parents 25-45 (Broad)');
    const [objective, setObjective] = useState('App Installs');
    const [loading, setLoading] = useState(false);
    const [launched, setLaunched] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [fetching, setFetching] = useState(true);

    const fetchData = async () => {
        setFetching(true);
        try {
            // Fetch campaigns
            const cRes = await fetch("http://localhost:8000/campaigns/list");
            const cData = await cRes.json();

            // Fetch latest analytics for metrics
            const aRes = await fetch("http://localhost:8000/analytics/dashboard");
            const aData = await aRes.json();

            if (cData.status === "success") {
                const combined = cData.data.map((c: any) => {
                    // Find latest perf record for this campaign
                    const perf = aData.data?.find((p: any) => p.campaign_id === c.id);
                    return {
                        ...c,
                        ctr: perf ? perf.ctr : 0,
                        cpc: perf ? perf.cpc : 0
                    };
                });
                setCampaigns(combined);
            }
        } catch (error) {
            console.error("Failed to fetch campaigns", error);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleLaunch = async () => {
        setLoading(true);
        setLaunched(false);
        try {
            const res = await fetch("http://localhost:8000/campaigns/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `Auto-Generated ${platform} Campaign - ${new Date().toLocaleDateString()}`,
                    platform: platform.toLowerCase(),
                    budget: parseFloat(budget.toString()),
                    audience_target: audience,
                    objective: objective,
                    creative_id: "Genetic Winner 001"
                })
            });
            const data = await res.json();
            if (data.status === "success") {
                setLaunched(true);
                await fetchData();
                setTimeout(() => setLaunched(false), 3000);
            }
        } catch (error) {
            console.error("Failed to launch campaign", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Campaign Manager</h1>
                    <p className="text-gray-500 text-sm mt-1">Deploy ad variations directly to Meta and monitor status.</p>
                </div>
                <div className="flex gap-3 items-center">
                    {launched && <span className="text-sm text-green-600 font-medium animate-bounce">✅ Campaign Launched!</span>}
                    <button
                        onClick={() => fetchData()}
                        className="p-2 text-gray-500 hover:text-indigo-600 transition" title="Refresh Data">
                        <BarChart3 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleLaunch}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {loading ? "Syncing..." : "Sync to Sandbox"}
                    </button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                {/* Campaign Builder */}
                <div className="w-1/3 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col shrink-0 overflow-y-auto">
                    <h3 className="font-bold text-gray-900 mb-6">Execution Setup</h3>

                    <div className="space-y-6">
                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                            <h4 className="text-xs font-bold text-orange-900 uppercase mb-2">Sandbox Status</h4>
                            <p className="text-xs text-orange-700 italic">"This is a growth experiment. Campaigns will be saved as DRAFTS for manual export to Meta Ads Manager."</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Budget ($)</label>
                                <input
                                    type="number"
                                    value={budget}
                                    onChange={(e) => setBudget(Number(e.target.value))}
                                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                                <select
                                    value={platform}
                                    onChange={(e) => setPlatform(e.target.value)}
                                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                >
                                    <option value="Meta">Meta Ads</option>
                                    <option value="Google">Google Ads</option>
                                    <option value="X">X Ads</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                            <select
                                value={audience}
                                onChange={(e) => setAudience(e.target.value)}
                                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                            >
                                <option>Parents 25-45 (Broad)</option>
                                <option>Lookalike: High Retain Parents (1%)</option>
                                <option>Retargeting: App Installers (7d)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Objective</label>
                            <select
                                value={objective}
                                onChange={(e) => setObjective(e.target.value)}
                                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                            >
                                <option>App Installs</option>
                                <option>Subscription Purchase</option>
                                <option>Brand Awareness</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Campaign List */}
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 shrink-0 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900">Live Campaigns</h3>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {fetching ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                            </div>
                        ) : campaigns.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <Megaphone className="w-12 h-12 mb-4 opacity-10" />
                                <p>No active campaigns found. Start one today!</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold border-b border-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4">Campaign Name</th>
                                        <th className="px-6 py-4">Budget</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">CTR</th>
                                        <th className="px-6 py-4">CPA</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {campaigns.map((camp) => (
                                        <tr key={camp.id} className="hover:bg-gray-50 group transition">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {camp.name}
                                                <div className="text-xs text-gray-500 font-normal mt-0.5">{camp.platform} • {camp.objective}</div>
                                            </td>
                                            <td className="px-6 py-4">${camp.budget}/day</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${camp.status === 'Draft'
                                                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                        : 'bg-green-50 text-green-700 border-green-200'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${camp.status === 'Draft' ? 'bg-yellow-500' : 'bg-green-500'}`}></span> {camp.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono font-medium">{camp.ctr}%</td>
                                            <td className={`px-6 py-4 font-mono font-medium ${camp.cpc && camp.cpc < 2 ? 'text-green-600' : 'text-gray-900'}`}>
                                                ${camp.cpc?.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-10 group-hover:opacity-100 transition">
                                                    <button className="p-1.5 text-gray-400 hover:text-gray-900 rounded transition"><Pause className="w-4 h-4" /></button>
                                                    <button className="p-1.5 text-gray-400 hover:text-indigo-600 rounded transition ml-1"><ExternalLink className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
