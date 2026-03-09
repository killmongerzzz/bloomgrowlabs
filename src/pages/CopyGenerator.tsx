import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Copy, Check, Loader2, ArrowUpCircle, PauseCircle, Archive, RefreshCw } from 'lucide-react';

interface AdVariant {
    id: string;
    headline: string;
    supporting_text: string;
    cta: string;
    tone: string;
    visual_template?: string;
    status: 'draft' | 'active' | 'paused' | 'retired';
    performance_score: number;
    days_active: number;
    variant_group: string | null;
    pain_point_id: string | null;
    copy_style?: string;
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
    active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-100' },
    paused: { label: 'Paused', color: 'text-yellow-700', bg: 'bg-yellow-100' },
    retired: { label: 'Retired', color: 'text-red-600', bg: 'bg-red-100' },
};

const TONES = ['Professional', 'Empathetic', 'Urgent', 'Playful', 'Authoritative'];

interface BrandingSettings {
    primary_audience: string;
    brand_colors: string;
    avoid_colors: string;
    typography: string;
    design_direction: string;
}

export default function CopyGenerator() {
    const [variants, setVariants] = useState<AdVariant[]>([]);
    const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
    const [branding, setBranding] = useState<BrandingSettings | null>(null);
    const [selectedPainPoint, setSelectedPainPoint] = useState<PainPoint | null>(null);
    const [selectedTone, setSelectedTone] = useState('Empathetic');
    const [copyStyle, setCopyStyle] = useState<'calm_narrative' | 'problem_solution'>('calm_narrative');
    const [generating, setGenerating] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingVariants, setLoadingVariants] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [previewVariant, setPreviewVariant] = useState<AdVariant | null>(null);

    const fetchVariants = useCallback(async () => {
        setLoadingVariants(true);
        try {
            const res = await fetch("http://localhost:8000/ads/variants");
            const data = await res.json();
            if (data.status === "success") setVariants(data.data);
        } catch (e) { console.error("Failed to load variants", e); }
        finally { setLoadingVariants(false); }
    }, []);

    const fetchPainPoints = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:8000/research/results");
            const data = await res.json();
            if (data.status === "success" && data.data.length > 0) {
                setPainPoints(data.data);
                setSelectedPainPoint(data.data[0]);
            }
        } catch (e) { console.error("Failed to load pain points", e); }
    }, []);

    const fetchBranding = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:8000/settings/branding");
            const data = await res.json();
            if (data.status === "success") setBranding(data.data);
        } catch (e) { console.error("Failed to load branding", e); }
    }, []);

    useEffect(() => {
        fetchVariants();
        fetchPainPoints();
        fetchBranding();
    }, [fetchVariants, fetchPainPoints, fetchBranding]);

    const handleGenerate = async () => {
        if (!selectedPainPoint) return;
        setGenerating(true);
        try {
            const res = await fetch("http://localhost:8000/copy/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pain_point_id: selectedPainPoint.id,
                    pain_point_text: selectedPainPoint.text,
                    tone: selectedTone.toLowerCase(),
                    copy_style: copyStyle
                }),
            });
            const data = await res.json();
            if (data.status === "success") await fetchVariants();
        } catch (e) { console.error("Generate failed", e); }
        finally { setGenerating(false); }
    };

    const lifecycleAction = async (action: 'promote' | 'demote' | 'retire', id: string) => {
        setActionLoading(`${action}-${id}`);
        const endpointMap = { promote: 'promote', demote: 'demote', retire: 'retire' };
        try {
            await fetch(`http://localhost:8000/ads/${endpointMap[action]}/${id}`, { method: "POST" });
            await fetchVariants();
        } catch (e) { console.error(`Action ${action} failed`, e); }
        finally { setActionLoading(null); }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetch("http://localhost:8000/ads/refresh", { method: "POST" });
            await fetchVariants();
        } catch (e) { console.error("Refresh failed", e); }
        finally { setRefreshing(false); }
    };

    const copyText = (v: AdVariant) => {
        navigator.clipboard.writeText(`${v.headline}\n\n${v.supporting_text || ""}\n\nCTA: ${v.cta}`);
        setCopiedId(v.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filtered = statusFilter === 'all' ? variants : variants.filter(v => v.status === statusFilter);
    const displayVariants = filtered.filter(v => v.status !== 'retired' || statusFilter === 'retired' || statusFilter === 'all');

    // Branding helper
    const getBrandStyles = () => {
        if (!branding) return {};
        const colors = branding.brand_colors?.split(',').map(c => c.trim()) || [];
        const primaryColor = colors[0] || '#4F46E5';
        const font = branding.typography?.toLowerCase().includes('round') ? 'font-sans rounded-xl' :
            branding.typography?.toLowerCase().includes('serif') ? 'font-serif' : 'font-sans';

        return { primaryColor, font };
    };

    const { primaryColor, font } = getBrandStyles();

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Ad Copy Generator</h1>
                    <p className="text-gray-500 text-sm mt-1">Generate, manage, and optimize your ad copy variants.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-200 transition border border-purple-200 disabled:opacity-50"
                    >
                        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {refreshing ? "Refreshing..." : "Refresh Fatigued Ads"}
                    </button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                {/* Left: Generate Panel */}
                <div className="w-80 shrink-0 flex flex-col gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-500" /> Generate New Copy
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Pain Point</label>
                                <select
                                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                    value={selectedPainPoint?.id || ''}
                                    onChange={e => setSelectedPainPoint(painPoints.find(p => p.id === e.target.value) || null)}
                                >
                                    {painPoints.length === 0 && <option>Run Research first...</option>}
                                    {painPoints.map(p => (
                                        <option key={p.id} value={p.id}>{p.text.substring(0, 50)}...</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Brand Tone</label>
                                <div className="flex flex-wrap gap-2">
                                    {TONES.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setSelectedTone(t)}
                                            className={`px-3 py-1 rounded-md text-xs font-medium transition ${selectedTone === t
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >{t}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Copy Style</label>
                                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                                    <button
                                        onClick={() => setCopyStyle('calm_narrative')}
                                        className={`flex-1 py-2 px-3 transition ${copyStyle === 'calm_narrative' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                    >Calm Narrative</button>
                                    <button
                                        onClick={() => setCopyStyle('problem_solution')}
                                        className={`flex-1 py-2 px-3 transition border-l border-gray-200 ${copyStyle === 'problem_solution' ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                    >Problem → Solution</button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 leading-tight">
                                    {copyStyle === 'calm_narrative' ? 'Headspace-style reflective tone — emotional, brand-warm.' : 'Direct-response hook — names the problem, delivers the solution.'}
                                </p>
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={generating || !selectedPainPoint}
                                className={`w-full text-white py-2 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 ${copyStyle === 'problem_solution' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Copy</>}
                            </button>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="font-bold text-gray-900 text-sm mb-3">Variant Summary</h3>
                        <div className="space-y-2">
                            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                                const count = variants.filter(v => v.status === status).length;
                                return (
                                    <div key={status} className="flex justify-between items-center">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                        <span className="text-sm font-bold text-gray-700">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: Variants List */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Filter bar */}
                    <div className="flex gap-2 mb-4 shrink-0">
                        {['all', 'active', 'draft', 'paused', 'retired'].map(f => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition ${statusFilter === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                    }`}
                            >{f}</button>
                        ))}
                        <span className="ml-auto text-xs text-gray-400 flex items-center">{displayVariants.length} variants</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {loadingVariants ? (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading variants...
                            </div>
                        ) : displayVariants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                                <Sparkles className="w-10 h-10 text-gray-200" />
                                <p className="text-sm font-medium">No variants yet. Generate your first ad copy!</p>
                            </div>
                        ) : (
                            displayVariants.map(v => {
                                const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.draft;
                                const isLoading = (a: string) => actionLoading === `${a}-${v.id}`;
                                return (
                                    <div key={v.id} className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${v.status === 'retired' ? 'opacity-60' : ''}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                                    {v.performance_score > 0 && (
                                                        <span className="text-xs text-indigo-600 font-semibold">Score: {v.performance_score.toFixed(2)}</span>
                                                    )}
                                                    {v.days_active > 0 && (
                                                        <span className="text-xs text-gray-400">{v.days_active}d active</span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-gray-900 text-sm">{v.headline}</p>
                                            </div>
                                            <button
                                                onClick={() => setPreviewVariant(v)}
                                                className="text-xs text-indigo-600 font-semibold hover:underline"
                                            >Visual Preview</button>
                                        </div>
                                        <p className="text-gray-600 text-xs mb-2 leading-relaxed">{v.supporting_text}</p>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-md font-medium border border-indigo-100">{v.cta}</span>
                                            <span className="text-xs text-gray-400 capitalize">{v.tone}</span>
                                            {v.copy_style === 'problem_solution' && (
                                                <span className="bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-orange-100">P→S</span>
                                            )}
                                        </div>
                                        {/* Action Row */}
                                        <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                                            {v.status !== 'active' && v.status !== 'retired' && (
                                                <button
                                                    onClick={() => lifecycleAction('promote', v.id)}
                                                    disabled={!!actionLoading}
                                                    className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-md hover:bg-green-100 transition disabled:opacity-50"
                                                >
                                                    {isLoading('promote') ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />} Promote
                                                </button>
                                            )}
                                            {v.status === 'active' && (
                                                <button
                                                    onClick={() => lifecycleAction('demote', v.id)}
                                                    disabled={!!actionLoading}
                                                    className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-md hover:bg-yellow-100 transition disabled:opacity-50"
                                                >
                                                    {isLoading('demote') ? <Loader2 className="w-3 h-3 animate-spin" /> : <PauseCircle className="w-3 h-3" />} Pause
                                                </button>
                                            )}
                                            {v.status !== 'retired' && (
                                                <button
                                                    onClick={() => lifecycleAction('retire', v.id)}
                                                    disabled={!!actionLoading}
                                                    className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 transition disabled:opacity-50"
                                                >
                                                    {isLoading('retire') ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />} Retire
                                                </button>
                                            )}
                                            <button
                                                onClick={() => copyText(v)}
                                                className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md hover:bg-gray-100 transition ml-auto"
                                            >
                                                {copiedId === v.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                {copiedId === v.id ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Visual Preview Modal */}
            {previewVariant && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setPreviewVariant(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                        >✕</button>

                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Branded Ad Preview</h3>
                            <p className="text-sm text-gray-500">
                                Template: <span className="font-semibold text-indigo-600 capitalize">{previewVariant.visual_template || 'default'}</span>
                            </p>
                        </div>

                        {/* Ad Card Mockups */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            {/* The Ad Rendering */}
                            <div className={`mx-auto w-full aspect-[4/5] border border-gray-100 shadow-2xl rounded-2xl overflow-hidden bg-white ${font}`}>
                                {(!previewVariant.visual_template || previewVariant.visual_template === 'proof_focus') && (
                                    <div className="h-full flex flex-col p-6 text-white text-center relative" style={{ backgroundColor: primaryColor }}>
                                        {/* 5-Star Overlay */}
                                        <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map(i => <Sparkles key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}
                                            <span className="text-[10px] font-bold ml-1">TOP RATED</span>
                                        </div>

                                        <div className="mt-12 mb-auto space-y-4">
                                            <h4 className="text-3xl font-black leading-tight uppercase tracking-tighter drop-shadow-lg">
                                                {previewVariant.headline}
                                            </h4>
                                            <p className="text-sm opacity-90 font-medium leading-relaxed">
                                                {previewVariant.supporting_text}
                                            </p>
                                        </div>
                                        <div className="bg-white px-8 py-3 rounded-full font-bold text-base shadow-xl hover:scale-105 transition transform cursor-pointer"
                                            style={{ color: primaryColor }}
                                        >
                                            {previewVariant.cta}
                                        </div>
                                        <p className="mt-4 text-[10px] opacity-60 font-bold uppercase tracking-widest">BloomGrow Academy</p>
                                    </div>
                                )}

                                {previewVariant.visual_template === 'minimalist' && (
                                    <div className="h-full flex flex-col p-8 items-center justify-center text-center space-y-8"
                                        style={{ background: `linear-gradient(135deg, ${primaryColor}15, #ffffff)` }}>
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-inner" style={{ backgroundColor: `${primaryColor}20` }}>
                                            <Sparkles className="w-10 h-10" style={{ color: primaryColor }} />
                                        </div>
                                        <div className="space-y-4">
                                            <h4 className="text-2xl font-light tracking-tight text-gray-900" style={{ fontFamily: 'serif' }}>
                                                {previewVariant.headline}
                                            </h4>
                                            <p className="text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed italic">
                                                "{previewVariant.supporting_text}"
                                            </p>
                                        </div>
                                        <button className="px-6 py-2 rounded-md font-semibold text-sm transition-all hover:opacity-80 border-2"
                                            style={{ borderColor: primaryColor, color: primaryColor }}>
                                            {previewVariant.cta}
                                        </button>
                                    </div>
                                )}

                                {previewVariant.visual_template === 'split_screen' && (
                                    <div className="h-full flex flex-col">
                                        <div className="flex-1 bg-gray-50 p-6 flex items-center justify-center text-center">
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">The Problem</p>
                                                <p className="text-sm font-medium text-gray-600 line-through opacity-50 italic">
                                                    Frustrating screen time...
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex-[2] p-8 text-white flex flex-col items-center justify-center text-center space-y-4"
                                            style={{ backgroundColor: primaryColor }}>
                                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Our Solution</p>
                                            <h4 className="text-xl font-bold leading-tight">
                                                {previewVariant.headline}
                                            </h4>
                                            <div className="bg-white/20 backdrop-blur-sm px-6 py-2 rounded-lg font-bold text-sm">
                                                {previewVariant.cta}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {previewVariant.visual_template === 'testimony_paper' && (
                                    <div className="h-full flex flex-col p-8 items-center justify-center text-center relative overflow-hidden"
                                        style={{ background: `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.1)), url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80')`, backgroundSize: 'cover' }}>
                                        <div className="bg-white p-6 shadow-xl relative transform rotate-[-1deg]"
                                            style={{
                                                clipPath: 'polygon(2% 2%, 98% 1%, 99% 97%, 1% 99%)',
                                                boxShadow: '0 10px 30px -5px rgba(0,0,0,0.3)'
                                            }}>
                                            <span className="text-4xl text-gray-300 absolute -top-2 -left-2">“</span>
                                            <div className="space-y-4 relative z-10">
                                                <h4 className="text-xl font-bold text-gray-800 leading-tight">
                                                    {previewVariant.headline}
                                                </h4>
                                                <p className="text-sm text-gray-600 leading-relaxed italic">
                                                    {previewVariant.supporting_text}
                                                </p>
                                            </div>
                                        </div>
                                        <button className="mt-8 px-8 py-3 bg-white text-gray-900 rounded-full font-bold shadow-lg hover:scale-105 transition transform">
                                            {previewVariant.cta}
                                        </button>
                                    </div>
                                )}

                                {previewVariant.visual_template === 'character_smile' && (
                                    <div className="h-full flex flex-col p-8 items-center justify-center text-center space-y-8"
                                        style={{ background: `linear-gradient(180deg, ${primaryColor}40 0%, #ffffff 100%)` }}>
                                        {/* Character Smile Mascot */}
                                        <div className="w-32 h-32 rounded-full relative shadow-lg flex items-center justify-center group"
                                            style={{ backgroundColor: '#FF845E' }}>
                                            <div className="w-20 h-1 relative mt-4">
                                                <div className="absolute inset-x-0 bottom-0 h-4 border-b-4 border-gray-900 rounded-[100%]" />
                                            </div>
                                            <div className="absolute top-10 left-8 w-3 h-1 bg-gray-900 rounded-full" />
                                            <div className="absolute top-10 right-8 w-3 h-1 bg-gray-900 rounded-full" />
                                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full blur-[2px] opacity-60 animate-pulse" />
                                        </div>
                                        <div className="space-y-4">
                                            <h4 className="text-2xl font-bold text-gray-900 tracking-tight">
                                                {previewVariant.headline}
                                            </h4>
                                            <p className="text-sm text-gray-600 max-w-[220px] mx-auto leading-relaxed">
                                                {previewVariant.supporting_text}
                                            </p>
                                        </div>
                                        <button className="px-10 py-3 rounded-full font-black text-white shadow-xl hover:opacity-90 transition-all uppercase tracking-widest text-xs"
                                            style={{ backgroundColor: primaryColor }}>
                                            {previewVariant.cta}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Template Comparison/Info */}
                            <div className="space-y-6">
                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <h5 className="text-xs font-bold text-indigo-700 uppercase mb-2">Design Rationale</h5>
                                    <p className="text-xs text-indigo-900 leading-relaxed">
                                        {previewVariant.visual_template === 'proof_focus' && "High-energy layout using social proof overlays and vibrant colors to build immediate trust and drive action."}
                                        {previewVariant.visual_template === 'minimalist' && "Clean, minimalist aesthetic focused on calming palettes and elegant typography to reduce cognitive load."}
                                        {previewVariant.visual_template === 'split_screen' && "Direct response layout that contrasts the current frustration with your product's immediate solution."}
                                        {previewVariant.visual_template === 'testimony_paper' && "Headspace-inspired 'torn paper' effect that creates a tactile, human feel for personal testimonials."}
                                        {previewVariant.visual_template === 'character_smile' && "Friendly, character-driven layout using the iconic 'smile' mascot and soft gradients for brand warmth."}
                                        {!previewVariant.visual_template && "Standard brand-aligned card layout focusing on core messaging and primary brand color."}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Typography</div>
                                        <div className="text-xs font-semibold text-gray-700">{branding?.typography || 'Standard'}</div>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Scale</div>
                                        <div className="text-xs font-semibold text-gray-700">1080 x 1350</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-2 pt-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Live Preview Active</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
