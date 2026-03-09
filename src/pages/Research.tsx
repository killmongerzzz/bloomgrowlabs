import { useState, useEffect } from 'react';
import { Search, BarChart2, Loader2, Sparkles, Layers, Type, Image as ImageIcon, ExternalLink, Zap } from 'lucide-react';

interface CompetitorAd {
    id: string;
    brand: string;
    image_url: string;
    headline: string;
    subtext: string;
    cta: string;
    landing_page: string;
    style_metadata: {
        template_type: string;
        background_style: string;
        color_palette: string;
        icon_presence: boolean;
    };
    copy_pattern: {
        headline_pattern: string;
        angle: string;
    };
    cluster: string;
    created_at: string;
}

interface PainPoint {
    id: string;
    source: string;
    source_type: string;
    text: string;
    frequency: number;
    relevance_score: number;
    created_at: string;
}

export default function Research() {
    const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [activeTab, setActiveTab] = useState<"pain-points" | "competitor-intel">("pain-points");
    const [competitorAds, setCompetitorAds] = useState<CompetitorAd[]>([]);
    const [fetchingAds, setFetchingAds] = useState(false);

    // Context inputs
    const [siteUrl, setSiteUrl] = useState("");
    const [competitorInput, setCompetitorInput] = useState("");
    const [selectedSources, setSelectedSources] = useState<string[]>(["Reddit", "YouTube", "App Store", "Parenting Forums"]);

    const sources = ["Reddit", "YouTube", "App Store", "Parenting Forums"];

    const toggleSource = (source: string) => {
        if (selectedSources.includes(source)) {
            setSelectedSources(selectedSources.filter(s => s !== source));
        } else {
            setSelectedSources([...selectedSources, source]);
        }
    };

    const fetchResults = async () => {
        try {
            const res = await fetch("http://localhost:8000/research/results");
            const data = await res.json();
            if (data.status === "success" && data.data) {
                setPainPoints(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch research results", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCompetitorAds = async () => {
        setFetchingAds(true);
        try {
            const res = await fetch("http://localhost:8000/competitors/ads");
            const data = await res.json();
            if (data.status === "success") {
                setCompetitorAds(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch competitor ads", error);
        } finally {
            setFetchingAds(false);
        }
    };

    useEffect(() => {
        fetchResults();
        fetchCompetitorAds();
    }, []);

    const handleRunScan = async () => {
        if (activeTab === "pain-points") {
            setScanning(true);
            try {
                const res = await fetch("http://localhost:8000/research/run", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        site_url: siteUrl || null,
                        competitors: competitorInput ? competitorInput.split(",").map(c => c.trim()) : [],
                        sources: selectedSources
                    })
                });
                await res.json();
                await fetchResults();
            } catch (error) {
                console.error("Failed to run scan", error);
            } finally {
                setScanning(false);
            }
        } else {
            setScanning(true);
            try {
                const res = await fetch("http://localhost:8000/competitors/scrape", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        brands: competitorInput ? competitorInput.split(",").map(c => c.trim()) : ["Headspace", "Lingokids", "Duolingo", "BetterHelp"]
                    })
                });
                await res.json();
                await fetchCompetitorAds();
            } catch (error) {
                console.error("Failed to scrape competitors", error);
            } finally {
                setScanning(false);
            }
        }
    };

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Research & Inspiration Lab</h1>
                    <p className="text-gray-500 text-sm mt-1">Analyze market pain points and reverse-engineer successful competitor creative patterns.</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setActiveTab("pain-points")}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "pain-points" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Pain Points
                        </button>
                        <button
                            onClick={() => setActiveTab("competitor-intel")}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "competitor-intel" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Competitor Intel
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0 flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6 w-full">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Your Product URL</label>
                        <input
                            type="text"
                            placeholder="e.g. https://growth.bloomgrow.app"
                            value={siteUrl}
                            onChange={(e) => setSiteUrl(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        />
                        <p className="text-[10px] text-gray-400 italic">We'll study your site to tailor the research specifically to your niche.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {activeTab === "pain-points" ? "Target Competitors (Comma Separated)" : "Brands to Scrape (e.g. Headspace, Calm)"}
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Lingokids, ABCMouse, Pok Pok"
                            value={competitorInput}
                            onChange={(e) => setCompetitorInput(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        />
                        <p className="text-[10px] text-gray-400 italic">Leave blank to let AI auto-discover competitors.</p>
                    </div>
                </div>

                <div className="flex items-end justify-between gap-6 border-t border-gray-100 pt-4">
                    <div className="flex-1">
                        {activeTab === "pain-points" ? (
                            <>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Research Sources (Multi-select)</label>
                                <div className="flex flex-wrap gap-2">
                                    {sources.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => toggleSource(s)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${selectedSources.includes(s)
                                                ? 'bg-indigo-600 text-white border border-indigo-600'
                                                : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-4 text-sm text-gray-500 italic">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                Our Agentic Scraper will identify top-performing ads and extract design patterns automatically.
                            </div>
                        )}
                    </div>

                    <div>
                        <button
                            onClick={handleRunScan}
                            disabled={scanning}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:scale-100 h-12"
                        >
                            {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            {scanning ? (activeTab === "pain-points" ? "Deep Scanning..." : "Scraping Ads...") : (activeTab === "pain-points" ? "Run Contextual Scan" : "Scrape & Cluster Performance Ads")}
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === "pain-points" ? (
                <>
                    <div className="grid grid-cols-3 gap-6 shrink-0 h-48">
                        <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
                            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <BarChart2 className="w-4 h-4" /> Topic Clusters Visualization
                            </h3>
                            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-sm">
                                [Chart Area: Bubble Chart of Pain Points]
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
                            <h3 className="text-sm font-bold text-gray-700 mb-4">Top Keywords</h3>
                            <div className="flex flex-wrap gap-2">
                                {painPoints.length > 0 ? (
                                    Array.from(new Set(
                                        painPoints.flatMap(p =>
                                            p.text.toLowerCase().split(/\W+/).filter(w => w.length > 4)
                                        )
                                    )).slice(0, 10).map(word => (
                                        <span key={word} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100">
                                            {word}
                                        </span>
                                    ))
                                ) : (
                                    <div className="text-xs text-gray-400 italic">No keywords yet...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col min-h-[300px]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3">Pain Point</th>
                                        <th className="px-6 py-3">Source Type</th>
                                        <th className="px-6 py-3">Context Relevance</th>
                                        <th className="px-6 py-3">Frequency</th>
                                        <th className="px-6 py-3">Discovered</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-4 text-center">Loading data...</td>
                                        </tr>
                                    ) : painPoints.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-4 text-center text-gray-500 italic">No pain points found. Run a scan.</td>
                                        </tr>
                                    ) : (
                                        painPoints.map((point) => (
                                            <tr key={point.id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 font-medium text-gray-900 border-l-4 border-l-indigo-500">
                                                    {point.text}
                                                    <div className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{point.source}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${point.source_type === 'Reddit' ? 'bg-orange-50 text-orange-600' :
                                                        point.source_type === 'App Store' ? 'bg-blue-50 text-blue-600' :
                                                            point.source_type === 'YouTube' ? 'bg-red-50 text-red-600' :
                                                                'bg-gray-50 text-gray-600'
                                                        }`}>
                                                        {point.source_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs font-bold ${point.relevance_score > 80 ? 'text-green-600' :
                                                        point.relevance_score > 50 ? 'text-indigo-600' :
                                                            'text-gray-400'
                                                        }`}>
                                                        {point.relevance_score}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                                            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${Math.min(point.frequency, 100)}%` }}></div>
                                                        </div>
                                                        {point.frequency}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">{new Date(point.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {fetchingAds ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                            <p className="font-bold">Syncing with Competitor Ad Library...</p>
                        </div>
                    ) : competitorAds.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 italic">
                            <Search className="w-12 h-12 mb-4 opacity-20" />
                            <p>No competitor ads analyzed yet. Enter brands above to begin.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-6 pb-10">
                            {competitorAds.map((ad) => (
                                <div key={ad.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition group">
                                    <div className="aspect-video relative overflow-hidden bg-gray-100">
                                        <img src={ad.image_url} alt={ad.brand} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-900 border border-white/50 shadow-sm">
                                            {ad.brand}
                                        </div>
                                        <div className="absolute top-4 right-4 bg-indigo-600 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ExternalLink className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900 leading-tight">"{ad.headline}"</h3>
                                            <p className="text-xs text-gray-500 mt-1">{ad.subtext}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-[10px] font-bold border border-fuchsia-100">
                                                <Layers className="w-3 h-3" /> {ad.style_metadata.template_type.replace('_', ' ')}
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-100">
                                                <Type className="w-3 h-3" /> {ad.copy_pattern.headline_pattern.replace('_', ' ')}
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg text-[10px] font-bold border border-teal-100">
                                                <ImageIcon className="w-3 h-3" /> {ad.style_metadata.background_style.replace('_', ' ')}
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-slate-100"
                                                onClick={() => {
                                                    localStorage.setItem("bloomgrow_seed_style", JSON.stringify(ad));
                                                    window.location.href = "/creatives";
                                                }}
                                            >
                                                <Zap className="w-4 h-4 text-amber-400" /> Use Style in Generation
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
