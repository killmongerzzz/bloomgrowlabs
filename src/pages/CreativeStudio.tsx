import { Wand2, Download, Send, Loader2, Sparkles, Image as ImageIcon2, Quote, X, RefreshCw, Layers, Edit2, Save, Type, LayoutTemplate, Zap } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import * as htmlToImage from 'html-to-image';
import { saveAs } from 'file-saver';

interface CreativeGenome {
    template: string;
    background_type: string;
    background_url?: string;
    icon?: string;
    color_palette: string;
    headline_type: string;
    font_style: string;
    emotion: string;
    destination_link: string;
}

interface CreativeVariant {
    id: string;
    headline: string;
    supporting_text: string;
    cta: string;
    offer_pointers?: string[]; // Structured bullet points from promotional text
    genome: CreativeGenome;
    batch_id?: string;
    predicted_score?: number;
    score_rationale?: string;
    pain_point_id?: string;
    pain_point_text?: string;
}

interface PromotedCopy {
    id: string;
    headline: string;
    supporting_text: string;
    tone?: string;
    pain_point_text?: string;
}

export default function CreativeStudio() {
    const [promotedCopies, setPromotedCopies] = useState<PromotedCopy[]>([]);
    const [selectedCopy, setSelectedCopy] = useState("");
    const [creatives, setCreatives] = useState<CreativeVariant[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingCopies, setFetchingCopies] = useState(true);
    const [previewVariant, setPreviewVariant] = useState<CreativeVariant | null>(null);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const [aiDirective, setAiDirective] = useState("");
    const [regenerating, setRegenerating] = useState(false);
    const [seedStyle, setSeedStyle] = useState<any>(null);
    const [promoText, setPromoText] = useState("Start your 14-day free trial. 50% off first 3 months with Code: BLOOM50. 40% off annual plan with Code: BLOOM-LAUNCH");

    // Control Panel State
    const [editMode, setEditMode] = useState(false);
    const [editHeadline, setEditHeadline] = useState("");
    const [editSupportingText, setEditSupportingText] = useState("");
    const [editCta, setEditCta] = useState("");
    const [editOfferPointers, setEditOfferPointers] = useState<string[]>([]);

    const [savingEdits, setSavingEdits] = useState(false);
    const [regeneratingBg, setRegeneratingBg] = useState(false);
    const [mutatingType, setMutatingType] = useState<string | null>(null);

    useEffect(() => {
        if (previewVariant) {
            setEditHeadline(previewVariant.headline || "");
            setEditSupportingText(previewVariant.supporting_text || "");
            setEditCta(previewVariant.cta || "");
            setEditOfferPointers(previewVariant.offer_pointers || []);
            setEditMode(false);
        }
    }, [previewVariant]);

    const renderRef = useRef<HTMLDivElement>(null);

    const fetchPromotedCopy = async () => {
        try {
            const res = await fetch("http://localhost:8000/copy/promoted");
            const data = await res.json();
            if (data.status === "success") {
                setPromotedCopies(data.data);
                if (data.data.length > 0) setSelectedCopy(data.data[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch promoted copy", error);
        } finally {
            setFetchingCopies(false);
        }
    };

    const fetchLastBatch = async () => {
        try {
            const res = await fetch("http://localhost:8000/copy/results");
            const data = await res.json();
            if (data.status === "success") {
                // Filter ones with genome
                const genetic = data.data.filter((v: any) => v.genome);
                setCreatives(genetic);
            }
        } catch (error) {
            console.error("Failed to fetch variants", error);
        }
    };

    useEffect(() => {
        fetchPromotedCopy();
        fetchLastBatch();

        // Check for style seeding from Research Page
        const savedSeed = localStorage.getItem("bloomgrow_seed_style");
        if (savedSeed) {
            try {
                setSeedStyle(JSON.parse(savedSeed));
            } catch (e) {
                console.error("Failed to parse seed style", e);
            }
        }
    }, []);

    const handleGenerate = async () => {
        if (!selectedCopy) return;
        setLoading(true);

        try {
            const res = await fetch("http://localhost:8000/creatives/batch-generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    copy_id: selectedCopy,
                    count: 7,
                    style_source: seedStyle,
                    promo_text: promoText
                })
            });
            const data = await res.json();
            if (data.status === "success") {
                await fetchLastBatch();
            }
        } catch (error) {
            console.error("Batch generation failed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        if (!previewVariant || !aiDirective.trim()) return;
        setRegenerating(true);
        try {
            const res = await fetch(`http://localhost:8000/creatives/${previewVariant.id}/regenerate-text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    directive: aiDirective
                })
            });
            const data = await res.json();
            if (data.status === "success") {
                setPreviewVariant(data.data as CreativeVariant);
                setCreatives((prev) => prev.map(c => c.id === data.data.id ? data.data : c));
                setAiDirective("");
            }
        } catch (error) {
            console.error("Text regeneration failed", error);
        } finally {
            setRegenerating(false);
        }
    };

    const handleSaveEdits = async () => {
        if (!previewVariant) return;
        setSavingEdits(true);
        try {
            const res = await fetch(`http://localhost:8000/creatives/${previewVariant.id}/text`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    headline: editHeadline,
                    supporting_text: editSupportingText,
                    cta: editCta,
                    offer_pointers: editOfferPointers
                })
            });
            const data = await res.json();
            if (data.status === "success") {
                setPreviewVariant(data.data as CreativeVariant);
                setCreatives((prev) => prev.map(c => c.id === data.data.id ? data.data : c));
                setEditMode(false);
            }
        } catch (error) {
            console.error("Manual edit failed", error);
        } finally {
            setSavingEdits(false);
        }
    };

    const handleRegenerateBg = async () => {
        if (!previewVariant) return;
        setRegeneratingBg(true);
        try {
            const res = await fetch(`http://localhost:8000/creatives/${previewVariant.id}/regenerate-background`, {
                method: "POST"
            });
            const data = await res.json();
            if (data.status === "success") {
                setPreviewVariant(data.data as CreativeVariant);
                setCreatives((prev) => prev.map(c => c.id === data.data.id ? data.data : c));
            }
        } catch (error) {
            console.error("BG regeneration failed", error);
        } finally {
            setRegeneratingBg(false);
        }
    };

    const handleMutate = async (type: string) => {
        if (!previewVariant) return;
        setMutatingType(type);
        try {
            const res = await fetch(`http://localhost:8000/creatives/${previewVariant.id}/mutate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mutation_type: type })
            });
            const data = await res.json();
            if (data.status === "success") {
                // Prepend or replace the creative list with the new batch to show them
                await fetchLastBatch();
                setPreviewVariant(null); // Close modal to view variations
            }
        } catch (error) {
            console.error("Mutation failed", error);
        } finally {
            setMutatingType(null);
        }
    };

    const handleExportPNG = async (creative: CreativeVariant, fromModal: boolean = false) => {
        setExportingId(creative.id);

        // If not from modal, we still need to set previewVariant to render it in DOM
        if (!fromModal) setPreviewVariant(creative);

        setTimeout(async () => {
            if (renderRef.current) {
                try {
                    const dataUrl = await htmlToImage.toPng(renderRef.current, {
                        cacheBust: true,
                        pixelRatio: 1,
                        skipFonts: false,
                        includeQueryParams: true
                    });
                    saveAs(dataUrl, `bloomgrow - ad - ${creative.id.substring(0, 6)}.png`);
                } catch (err) {
                    console.error('Failed to export image', err);
                } finally {
                    setExportingId(null);
                    if (!fromModal) setPreviewVariant(null);
                }
            }
        }, 500);
    };

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Creative Studio</h1>
                    <p className="text-gray-500 text-sm mt-1">Scale your marketing with the Code-Based Layout Engine.</p>
                </div>
                <div className="flex gap-3">
                    <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50 transition flex items-center gap-2">
                        <Download className="w-4 h-4" /> Download All
                    </button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                {/* Controls Sidebar */}
                <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col shrink-0 overflow-y-auto">
                    {seedStyle && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <Zap className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <div className="text-xs font-black text-amber-800 uppercase tracking-tighter">Style Seeding Active</div>
                                    <div className="text-sm text-amber-700 font-medium italic leading-none mt-1">
                                        Mirroring "{seedStyle.brand}" Ad Pattern
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setSeedStyle(null);
                                    localStorage.removeItem("bloomgrow_seed_style");
                                }}
                                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-white/50 px-2 py-1 rounded border border-amber-200 transition active:scale-95"
                            >
                                Clear Seed
                            </button>
                        </div>
                    )}

                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500" /> Engine Setup
                    </h3>

                    <div className="space-y-5 flex-1">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Select Promoted Copy</label>
                            {fetchingCopies ? (
                                <div className="h-10 bg-gray-50 animate-pulse rounded block"></div>
                            ) : (
                                <select
                                    value={selectedCopy}
                                    onChange={(e) => setSelectedCopy(e.target.value)}
                                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                >
                                    {promotedCopies.map(copy => (
                                        <option key={copy.id} value={copy.id}>"{copy.headline}" - {(copy.supporting_text || "").substring(0, 20)}...</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                            <h4 className="text-xs font-bold text-indigo-900 uppercase mb-2">Engine Strategy</h4>
                            <p className="text-[10px] text-indigo-700 leading-relaxed italic">
                                "The layout engine will generate 6 visual variations for your winning copy using AI-generated background photography"
                            </p>
                        </div>

                        {/* Promotional Hook Section */}
                        <div className="pt-2 border-t border-gray-100">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                                Promotional Offer
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${promoText ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                    {promoText ? 'INCLUDED' : 'OPTIONAL'}
                                </span>
                            </label>
                            <textarea
                                value={promoText}
                                onChange={(e) => setPromoText(e.target.value)}
                                placeholder="e.g. Start your 14-day trial, or 50% off monthly plans..."
                                className="w-full h-24 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none leading-relaxed"
                            />
                            <p className="mt-2 text-[10px] text-gray-400 italic">
                                AI will bridge your brand narrative with this offer.
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 mt-4 border-t border-gray-100">
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !selectedCopy}
                            className="w-full bg-indigo-600 text-white px-4 py-3 rounded-md font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            {loading ? "Generating Batch..." : "Evolve Batch"}
                        </button>
                    </div>
                </div>

                {/* Output Grid */}
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-y-auto relative">
                    {creatives.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                <Wand2 className="w-8 h-8 text-gray-200" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">No batch generated yet</h3>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto">Select a promoted copy and click 'Evolve Batch' to render code-based variants.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-8">
                            {creatives.map((creative) => (
                                <div key={creative.id} className="flex flex-col gap-4 group relative">
                                    {/* Predicted Score Badge */}
                                    <div className="absolute -top-3 -right-3 z-10">
                                        <div className={`flex flex - col items - center justify - center w - 12 h - 12 rounded - full border - 2 border - white shadow - lg ${(creative.predicted_score || 0) > 85 ? 'bg-green-500' :
                                            (creative.predicted_score || 0) > 70 ? 'bg-yellow-500' : 'bg-orange-500'
                                            } `}>
                                            <span className="text-[10px] text-white font-black leading-none">AI</span>
                                            <span className="text-sm text-white font-black leading-none">{creative.predicted_score || 0}</span>
                                        </div>
                                    </div>

                                    <div
                                        className="aspect-square rounded-xl relative overflow-hidden shadow-2xl transition hover:scale-[1.02] cursor-pointer"
                                        onClick={() => setPreviewVariant(creative)}
                                    >
                                        <CreativeLayout creative={creative} />
                                    </div>

                                    {/* Genome Metadata & Traceability */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-start px-1">
                                            <div className="flex flex-wrap gap-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                                    {creative.genome.template.replace("_", " ")}
                                                </span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-50 px-2 py-1 rounded">
                                                    {creative.genome.headline_type}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-4">
                                                <button
                                                    onClick={() => handleExportPNG(creative)}
                                                    title="Download PNG"
                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition shadow-sm bg-white"
                                                    disabled={exportingId === creative.id}
                                                >
                                                    {exportingId === creative.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                </button>
                                                <button title="Export for Metadata" className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition shadow-sm bg-white"><Send className="w-4 h-4" /></button>
                                            </div>
                                        </div>

                                        {/* Rationale & Source */}
                                        <div className="px-1 text-[11px] text-gray-500 line-clamp-2">
                                            <span className="font-bold text-gray-700">Rationale:</span> {creative.score_rationale}
                                        </div>

                                        <div className="flex justify-between items-center px-1 pt-1 border-t border-gray-50">
                                            <div className="text-[10px] text-indigo-600 font-medium truncate flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" />
                                                Copy Origin: {creative.headline?.substring(0, 30)}...
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* New Preview Modal */}
            {previewVariant && (
                <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-8">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-5xl flex gap-8 relative items-start">

                        <button
                            onClick={() => { setPreviewVariant(null); setAiDirective(""); }}
                            className="absolute -top-4 -right-4 bg-white text-gray-400 hover:text-gray-900 p-2 rounded-full shadow-lg border border-gray-100 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Left Side: Scaled Preview */}
                        <div className="w-[540px] h-[540px] shrink-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 relative shadow-inner">
                            {/* We use a transform wrapping div to scale down the 1080x1080 renderRef */}
                            <div style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "1080px", height: "1080px" }}>
                                <div ref={renderRef} className="w-[1080px] h-[1080px] bg-white">
                                    <CreativeLayout creative={previewVariant} isExport />
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Edit & Export Controls */}
                        <div className="flex-1 flex flex-col pt-2 h-[540px]">
                            <div className="flex justify-between items-center mb-1">
                                <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">Control Panel</h2>
                                {!editMode ? (
                                    <button onClick={() => setEditMode(true)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition">
                                        <Edit2 className="w-4 h-4" /> Edit Copy
                                    </button>
                                ) : (
                                    <button onClick={handleSaveEdits} disabled={savingEdits} className="text-sm font-bold text-white bg-green-600 hover:bg-green-700 flex items-center gap-1 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                                        {savingEdits ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                                    </button>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 mb-4 pb-4 border-b border-gray-100 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded tracking-wider uppercase">
                                    {previewVariant.genome.template.replace("_", " ")}
                                </span>
                            </p>

                            <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                                {/* Manual Edits Section */}
                                <div className="space-y-3">
                                    {editMode ? (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Headline (Hook)</label>
                                                <input type="text" value={editHeadline} onChange={(e) => setEditHeadline(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Supporting Text (Benefit)</label>
                                                <input type="text" value={editSupportingText} onChange={(e) => setEditSupportingText(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">CTA Button Type (Metadata)</label>
                                                <input type="text" value={editCta} onChange={(e) => setEditCta(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                                                    Promotion (Multi-line Offer)
                                                    <button onClick={() => setEditOfferPointers([...editOfferPointers, ""])} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold">+ ADD POINTER</button>
                                                </label>
                                                {editOfferPointers.map((p, i) => (
                                                    <div key={i} className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={p}
                                                            onChange={(e) => {
                                                                const newPointers = [...editOfferPointers];
                                                                newPointers[i] = e.target.value;
                                                                setEditOfferPointers(newPointers);
                                                            }}
                                                            className="flex-1 text-sm p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            placeholder={`Pointer ${i + 1}`}
                                                        />
                                                        <button onClick={() => setEditOfferPointers(editOfferPointers.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:text-red-600">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-100">
                                            <div className="text-sm"><span className="font-bold text-gray-500">Headline:</span> <span className="text-gray-900 font-medium">{previewVariant.headline}</span></div>
                                            <div className="text-sm"><span className="font-bold text-gray-500">Supporting:</span> <span className="text-gray-900 font-medium">{previewVariant.supporting_text}</span></div>
                                            <div className="text-sm"><span className="font-bold text-gray-500">Platform CTA:</span> <span className="text-indigo-600 font-bold">{previewVariant.cta}</span></div>
                                            {previewVariant.offer_pointers && previewVariant.offer_pointers.length > 0 && (
                                                <div className="pt-2">
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Active Promotion</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {previewVariant.offer_pointers.map((p, i) => (
                                                            <span key={i} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-medium">
                                                                • {p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* AI Regeneration Tools */}
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                        <Wand2 className="w-4 h-4" /> AI Text Regeneration Engine
                                    </h3>
                                    <p className="text-xs text-gray-500">Describe how you want the AI to rewrite the text. The visual layout will remain locked.</p>
                                    <textarea
                                        value={aiDirective}
                                        onChange={(e) => setAiDirective(e.target.value)}
                                        placeholder="e.g. Make it sound more urgent and use the phrase 'Start Today'..."
                                        className="w-full h-24 p-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition resize-none outline-none shadow-sm"
                                    />
                                    <button
                                        onClick={handleRegenerate}
                                        disabled={regenerating || !aiDirective.trim() || editMode}
                                        className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        {regenerating ? "Rewriting text..." : "Regenerate Text Only"}
                                    </button>
                                </div>

                                {previewVariant.genome.template !== "illustration_card" && (
                                    <div className="space-y-4 pt-4 border-t border-gray-100">
                                        <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                            <ImageIcon2 className="w-4 h-4" /> Background Synthesis
                                        </h3>
                                        <p className="text-xs text-gray-500">Generate a completely new background image from the AI, locking the text and formatting.</p>
                                        <button
                                            onClick={handleRegenerateBg}
                                            disabled={regeneratingBg || editMode}
                                            className="w-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {regeneratingBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                                            {regeneratingBg ? "Synthesizing Image..." : "Regenerate Background Image"}
                                        </button>
                                    </div>
                                )}

                                {/* NEW: Mutation Hub */}
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <h3 className="text-xs font-bold text-fuchsia-600 uppercase tracking-widest flex items-center gap-2">
                                        <Zap className="w-4 h-4" /> Creative Mutation Lab
                                    </h3>
                                    <p className="text-xs text-gray-500">Select this as the <b>Base Creative</b> and instantly spawn 100 new variations by mutating specific elements.</p>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleMutate("text")}
                                            disabled={mutatingType !== null || editMode}
                                            className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 hover:bg-fuchsia-100 transition p-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {mutatingType === "text" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Type className="w-3 h-3" />} Mutate Text
                                        </button>
                                        <button
                                            onClick={() => handleMutate("background")}
                                            disabled={mutatingType !== null || editMode || previewVariant.genome.template === "illustration_card"}
                                            className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 hover:bg-fuchsia-100 transition p-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {mutatingType === "background" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon2 className="w-3 h-3" />} Mutate Background
                                        </button>
                                        <button
                                            onClick={() => handleMutate("icon")}
                                            disabled={mutatingType !== null || editMode || previewVariant.genome.template !== "illustration_card"}
                                            className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 hover:bg-fuchsia-100 transition p-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {mutatingType === "icon" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Mutate Icons
                                        </button>
                                        <button
                                            onClick={() => handleMutate("layout")}
                                            disabled={mutatingType !== null || editMode}
                                            className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 hover:bg-fuchsia-100 transition p-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {mutatingType === "layout" ? <Loader2 className="w-3 h-3 animate-spin" /> : <LayoutTemplate className="w-3 h-3" />} Mutate Layout
                                        </button>
                                        <button
                                            onClick={() => handleMutate("all")}
                                            disabled={mutatingType !== null || editMode}
                                            className="col-span-2 bg-slate-900 text-white hover:bg-slate-800 transition p-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-slate-200 mt-2"
                                        >
                                            {mutatingType === "all" ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Zap className="w-4 h-4 text-fuchsia-400" />} Mutate ALL Variables (100x)
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg">
                                    <h4 className="text-xs font-bold text-orange-900 uppercase">AI Layout Rationale</h4>
                                    <p className="text-sm text-orange-800 mt-2 italic flex items-start gap-2">
                                        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                                        "{previewVariant.score_rationale}"
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] bg-white z-10">
                                <button
                                    onClick={() => handleExportPNG(previewVariant, true)}
                                    disabled={exportingId === previewVariant.id || editMode}
                                    className="flex-1 px-4 py-3 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-xl font-black transition flex justify-center items-center gap-2 disabled:opacity-50"
                                >
                                    {exportingId === previewVariant.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                    Download PNG
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay when exporting */}
            {exportingId && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">Exporting Creative...</h3>
                        <p className="text-sm text-gray-500">Rendering HTML layout to high-resolution PNG.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper to render structured promotional block — same glass card style across all templates
function PromotionBlock({ pointers, template }: { pointers?: string[], template?: string }) {
    if (!pointers || pointers.length === 0) return null;

    // Stacked typography: inline card (no full-width blue banner, no button)
    // All other templates: centered floating card
    const isStackedType = template === 'stacked_typography';

    return (
        <div className={`bg-black/40 backdrop-blur-xl border border-white/20 rounded-[24px] shadow-2xl space-y-2 text-left ${
            isStackedType
                ? 'w-full px-10 py-6 mx-0'
                : 'mt-4 p-6 w-full max-w-[850px]'
        }`}>
            <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-[#818cf8] rounded-full animate-pulse shadow-[0_0_10px_rgba(129,140,248,1)]" />
                <span className="text-[#a5b4fc] text-[22px] font-black uppercase tracking-[0.2em]">Exclusive Offer</span>
            </div>
            {pointers.map((p, i) => (
                <div key={i} className="flex items-center gap-4">
                    <span className="text-white text-[28px] font-black leading-tight tracking-tight drop-shadow-md">
                        {p}
                    </span>
                </div>
            ))}
        </div>
    );
}

// Layout Component that handles scaling for both UI and Export
function CreativeLayout({ creative, isExport = false }: { creative: CreativeVariant, isExport?: boolean }) {
    const scale = isExport ? 1 : 0.4; // Scale down for UI, full size for export (1080x1080)

    // Default fallback image if URL is missing
    const defaultImg = "https://images.unsplash.com/photo-1501854140801-515011ce7d78?auto=format&fit=crop&w=1080&q=80";
    const bgUrl = creative.genome.background_url || defaultImg;

    const [randomIcon, setRandomIcon] = useState<string | null>(null);

    useEffect(() => {
        const currentIcon = creative.genome.icon || '';
        const isBranded = currentIcon?.startsWith('http') || currentIcon?.endsWith('.svg');

        if (creative.genome.template === 'illustration_card' && !isBranded) {
            fetch("http://localhost:8000/icons/random")
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success' && data.url) {
                        setRandomIcon(data.url);
                    } else {
                        // Resilient fallback icon (verified heart icon)
                        setRandomIcon("https://bloomgrow-assets.s3.amazonaws.com/icons/6acc41ff-2498-4799-87a4-7f00fb3f80c8.svg");
                    }
                })
                .catch(err => {
                    console.error("Icon fetch error:", err);
                    setRandomIcon("https://bloomgrow-assets.s3.amazonaws.com/icons/6acc41ff-2498-4799-87a4-7f00fb3f80c8.svg");
                });
        } else {
            setRandomIcon(null);
        }
    }, [creative.id, creative.genome.template, creative.genome.icon]);

    const commonStyles = {
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: "1080px",
        height: "1080px",
        position: "absolute" as const,
        top: 0,
        left: 0,
        overflow: "hidden" as const
    };

    return (
        <div style={commonStyles}>
            {creative.genome.template === 'illustration_card' && (
                <div className="h-full w-full relative flex flex-col items-center justify-center text-center overflow-hidden bg-gray-900" style={{ padding: '80px 96px 200px 96px', gap: '48px' }}>
                    {/* Gradient Background overrides any image */}
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-400 via-emerald-500 to-blue-600 z-0"></div>

                    {/* Floating Decorative Shapes (Bigger, big, medium, small, faded) */}
                    <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-white/5 blur-[80px] z-0"></div>
                    <div className="absolute bottom-[-5%] right-[-5%] w-[500px] h-[500px] rounded-full bg-white/5 blur-[60px] z-0"></div>
                    <div className="absolute top-[20%] right-[10%] w-64 h-64 rounded-xl rotate-45 bg-white/10 blur-2xl z-0"></div>
                    <div className="absolute bottom-20 left-10 w-48 h-48 rounded-full bg-white/10 blur-xl z-0"></div>
                    <div className="absolute top-1/2 right-[20%] w-32 h-32 rounded-lg -rotate-12 bg-white/10 blur-lg z-0"></div>
                    <div className="absolute top-[15%] left-[30%] w-24 h-24 rounded-full bg-white/15 blur-md z-0"></div>
                    <div className="absolute bottom-1/4 left-[15%] w-16 h-16 rounded-full bg-white/20 blur-sm z-0"></div>
                    <div className="absolute top-1/3 left-1/4 w-12 h-12 rounded-lg rotate-12 bg-white/20 blur-[2px] z-0"></div>
                    <div className="absolute bottom-10 right-1/3 w-8 h-8 rounded-full bg-white/30 blur-none z-0"></div>
                    <div className="absolute top-40 right-1/4 w-6 h-6 rounded-full bg-white/40 blur-none z-0"></div>

                    {/* Large Centered Icon (Supports URLs) */}
                    <div className="w-72 h-72 bg-white/20 rounded-[80px] flex items-center justify-center backdrop-blur-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] z-10 border-[8px] border-white/40">
                        {getIcon(randomIcon || creative.genome.icon, isExport)}
                    </div>

                    <h2 className={`text-[85px] font-black text-white leading-[1.1] tracking-tight z-10 ${creative.genome.font_style === 'rounded' ? 'font-mono' : ''}`}
                        style={{ textShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                        {creative.headline}
                    </h2>

                    <p className="text-white/90 font-medium text-[38px] max-w-[850px] leading-snug z-10">
                        {creative.supporting_text}
                    </p>
                    <PromotionBlock pointers={creative.offer_pointers} template={creative.genome.template} />
                    {/* CTA Safe Zone */}
                    <div className="absolute bottom-0 left-0 right-0 h-[160px] z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,30,50,0.85) 0%, rgba(0,30,50,0.3) 55%, transparent 100%)' }}>
                    </div>
                </div>
            )}

            {creative.genome.template === 'blurred_image' && (
                <div className="h-full w-full relative flex flex-col overflow-hidden">
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${bgUrl}')` }}></div>
                    <div className="absolute inset-0 backdrop-blur-[10px]"></div>
                    <div className="absolute inset-0 bg-indigo-900/30"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent"></div>

                    <div className="relative flex-1 flex flex-col items-center justify-center p-20 pt-32 text-center text-white z-10" style={{ paddingBottom: '200px' }}>
                        <h2 className="text-[100px] font-black leading-[1.05] tracking-tight text-balance mb-8 drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                            {creative.headline}
                        </h2>
                        <p className="text-[40px] opacity-90 italic max-w-[800px] font-serif mb-12">
                            {creative.supporting_text}
                        </p>
                        <PromotionBlock pointers={creative.offer_pointers} template={creative.genome.template} />
                    </div>
                    {/* CTA Safe Zone */}
                    <div className="absolute bottom-0 left-0 right-0 h-[160px] z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)' }}>
                    </div>
                </div>
            )}

            {/* 3. Photo Typography - Clean large text over blurred photo */}
            {creative.genome.template === 'photo_typography' && (
                <div className="h-full w-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${bgUrl}')` }}></div>
                    <div className="absolute inset-0 backdrop-blur-[6px]"></div>
                    <div className="absolute inset-0 bg-black/35"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

                    <div className="relative flex flex-col h-full z-10 p-20 text-white justify-between" style={{ paddingBottom: '200px' }}>
                        <div className="flex justify-center w-full mt-10">
                            <h2 className="text-[110px] font-black leading-tight tracking-tight text-center max-w-[900px] drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                                {creative.headline}
                            </h2>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <p className="text-4xl opacity-90 font-medium max-w-[800px]" style={{ textShadow: "0 4px 15px rgba(0,0,0,0.5)" }}>
                                {creative.supporting_text}
                            </p>
                            <PromotionBlock pointers={creative.offer_pointers} template={creative.genome.template} />
                        </div>
                    </div>
                    {/* CTA Safe Zone */}
                    <div className="absolute bottom-0 left-0 right-0 h-[160px] z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)' }}>
                    </div>
                </div>
            )}

            {/* 4. Stacked Typography - Magazine cutout words */}
            {creative.genome.template === 'stacked_typography' && (
                <div className="h-full w-full relative flex flex-col overflow-hidden">
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${bgUrl}')` }}></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"></div>

                    {/* Content area — padded bottom to clear CTA safe zone */}
                    <div className="relative z-10 flex-1 flex flex-col" style={{ paddingBottom: '160px' }}>
                        {/* Headline — stacked blocks, one word per block */}
                        {(() => {
                            const words = creative.headline.replace(/\.$/, '').split(' ');
                            const count = words.length;

                            // Layout rules:
                            // 1–4 words  → 1 word per row, large font
                            // 5–6 words  → all words in ONE single row, smaller font
                            // 7+ words   → rows of 2 words, each word its OWN block side-by-side
                            let rows: string[][];
                            let fontSize: number;

                            if (count <= 4) {
                                rows = words.map(w => [w]);
                                fontSize = 72;
                            } else if (count <= 6) {
                                rows = words.map(w => [w]); // 1 word per row, smaller font
                                fontSize = 54;
                            } else {
                                // pair up into rows of 2 separate blocks
                                rows = [];
                                for (let i = 0; i < words.length; i += 2) {
                                    rows.push(words.slice(i, i + 2));
                                }
                                fontSize = count <= 8 ? 60 : 52;
                            }

                            return (
                                <div className="flex-1 flex flex-col items-center justify-center px-6 pt-10 max-w-[980px] mx-auto text-center gap-3">
                                    {rows.map((rowWords, rowIdx) => (
                                        <div key={rowIdx} className="flex gap-3 justify-center items-center"
                                            style={{ transform: `rotate(${rowIdx % 2 === 0 ? '-1.5deg' : '2deg'})` }}>
                                            {rowWords.map((word, wordIdx) => (
                                                <span key={wordIdx}
                                                    className="bg-white text-slate-900 font-black px-8 py-2 uppercase tracking-tighter shadow-[10px_10px_0_rgba(0,0,0,0.2)] leading-none inline-block border-[4px] border-slate-900/5"
                                                    style={{
                                                        fontSize: `${fontSize}px`,
                                                        transform: `translateX(${wordIdx % 2 === 0 ? '-4px' : '4px'})`
                                                    }}>
                                                    {word}
                                                </span>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* Supporting text — always visible below headline */}
                        <div className="shrink-0 px-10 pb-5">
                            <div className="bg-black/40 backdrop-blur-md border border-white/20 p-7 rounded-2xl max-w-[860px] mx-auto shadow-xl">
                                <p className="text-white text-[32px] font-medium leading-relaxed italic opacity-95 text-center">
                                    "{creative.supporting_text}"
                                </p>
                            </div>
                        </div>

                        {/* Promo block — in-flow, sits above CTA safe zone */}
                        <PromotionBlock pointers={creative.offer_pointers} template={creative.genome.template} />
                    </div>

                    {/* CTA Safe Zone — bottom 160px reserved for Meta platform CTA button */}
                    <div className="absolute bottom-0 left-0 right-0 h-[160px] z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)' }}>
                    </div>
                </div>
            )}

            {/* 5. Quote Testimonial - Classic elegant quote marks */}
            {creative.genome.template === 'quote_testimonial' && (
                <div className="h-full w-full relative flex items-center justify-center overflow-hidden" style={{ paddingBottom: '160px', paddingTop: '40px', paddingLeft: '64px', paddingRight: '64px' }}>
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${bgUrl}')` }}></div>
                    <div className="absolute inset-0 backdrop-blur-[8px]"></div>
                    <div className="absolute inset-0 bg-black/40"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent"></div>

                    <div className="relative z-10 bg-white/10 border border-white/20 backdrop-blur-xl rounded-[40px] p-16 text-center w-full max-w-[900px] shadow-2xl">
                        <Quote className="w-24 h-24 text-white/40 mx-auto mb-8" />
                        <h2 className="text-[65px] font-serif font-bold italic text-white leading-snug mb-8 drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                            "{creative.headline}"
                        </h2>
                        <p className="text-[32px] text-white/90 font-medium italic mb-8 max-w-[800px] mx-auto">
                            {creative.supporting_text}
                        </p>
                        <div className="flex justify-center">
                            <PromotionBlock pointers={creative.offer_pointers} template={creative.genome.template} />
                        </div>
                        <div className="w-24 h-1 bg-white/30 mx-auto mt-8 mb-6 rounded-full"></div>
                        <p className="text-2xl text-white/80 uppercase tracking-[0.2em] font-black">
                            Verified Parent
                        </p>
                    </div>
                    {/* CTA Safe Zone */}
                    <div className="absolute bottom-0 left-0 right-0 h-[160px] z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)' }}>
                    </div>
                </div>
            )}

            {/* 6. Paper Quote Testimonial - Rugged Paper Strips with Torn Effect */}
            {creative.genome.template === 'paper_quote_testimonial' && (
                <div className="h-full w-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${bgUrl}')` }}></div>
                    <div className="absolute inset-0 bg-black/40"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-black/80"></div>

                    <div className="relative z-10 h-full flex flex-col p-16 justify-end" style={{ paddingBottom: '200px' }}>
                        <div className="flex flex-col items-start space-y-4 mb-16 max-w-[900px]">
                            {/* Split headline into chunks for the paper strips */}
                            {creative.headline.match(/([^\s]+(?:\s+[^\s]+){0,2})/g)?.map((chunk, i) => (
                                <div key={i} className="bg-[#fcfaf7] text-slate-900 px-10 py-5 shadow-[10px_10px_25px_rgba(0,0,0,0.5)] border-b-2 border-r-2 border-gray-300/30"
                                    style={{
                                        transform: `rotate(${i % 2 === 0 ? '-1.5deg' : '2.5deg'}) translateX(${i * 10}px)`,
                                        clipPath: i % 2 === 0
                                            ? "polygon(0% 2%, 100% 0%, 98% 98%, 2% 100%, 0% 50%)"
                                            : "polygon(2% 0%, 98% 2%, 100% 100%, 0% 98%, 2% 40%)"
                                    }}>
                                    <span className={`text-[75px] font-bold leading-none ${creative.genome.font_style === 'modern_serif' ? 'font-serif' : 'font-sans'} tracking-tight`}>
                                        {chunk}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="w-full flex flex-col items-start">
                            <div className="text-white/90 text-[32px] font-medium leading-relaxed max-w-[750px] italic bg-black/20 backdrop-blur-sm p-6 rounded-lg border-l-4 border-indigo-400 mb-6">
                                "{creative.supporting_text}"
                            </div>
                            <PromotionBlock pointers={creative.offer_pointers} template={creative.genome.template} />
                        </div>
                    </div>
                    {/* CTA Safe Zone */}
                    <div className="absolute bottom-0 left-0 right-0 h-[160px] z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)' }}>
                    </div>
                </div>
            )}

            {/* 7. Billboard Mockup - Pretend outdoor ad */}
            {creative.genome.template === 'billboard_mockup' && (
                <div className="h-full w-full relative flex items-center justify-center overflow-hidden bg-gray-900" style={{ paddingBottom: '160px' }}>
                    <div className="absolute inset-0 bg-cover bg-center opacity-80 blur-sm scale-110" style={{ backgroundImage: `url('${bgUrl}')` }}></div>
                    <div className="absolute inset-0 bg-black/10"></div>
                    {/* CTA Safe Zone */}
                    <div className="absolute bottom-0 left-0 right-0 h-[160px] z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.3) 55%, transparent 100%)' }}>
                    </div>

                    {/* Billboard Structure */}
                    <div className="relative w-[900px] h-[650px] bg-white rounded-md shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex flex-col border-[12px] border-zinc-800 transform rotate-1 perspective-1000 rotate-y-[-5deg] rotate-x-[2deg]">
                        {/* Billboard Frame Highlights */}
                        <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.1)] pointer-events-none z-20"></div>

                        {/* Legs that reach to the bottom */}
                        <div className="absolute top-[638px] left-[150px] w-12 h-[500px] bg-zinc-900 shadow-2xl z-0"></div>
                        <div className="absolute top-[638px] right-[150px] w-12 h-[500px] bg-zinc-900 shadow-2xl z-0"></div>

                        {/* Billboard Content */}
                        <div className="flex-1 flex flex-col p-16 justify-between text-slate-900 bg-gradient-to-br from-gray-50 to-gray-200 z-10 relative">
                            <div className="flex justify-between items-start w-full mb-8">
                                <div className="font-black text-4xl tracking-tighter text-indigo-600 flex items-center gap-2">
                                    Bloom Grow AI
                                </div>
                                <div className="text-indigo-600 font-black text-[22px] uppercase tracking-widest border-b-4 border-indigo-600 pb-1">
                                    The Best Kids Learning App
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-center gap-8">
                                <h2 className="text-[70px] font-black leading-[1.1] tracking-tight text-slate-900 max-w-[800px]">
                                    {creative.headline}
                                </h2>
                                <p className="text-[34px] text-slate-600 font-medium max-w-[700px] italic border-l-4 border-indigo-600 pl-6 py-2 bg-indigo-50/50 rounded-r-lg">
                                    "{creative.supporting_text}"
                                </p>
                                <div className="scale-75 origin-left">
                                    <PromotionBlock pointers={creative.offer_pointers} template={creative.genome.template} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helpers
function getIcon(name?: string, isExport: boolean = false) {
    const defaultIconClass = isExport ? "text-white w-24 h-24" : "text-white w-10 h-10";
    const emojiClass = isExport ? "text-[120px]" : "text-5xl";

    if (!name || name === "none" || name === "") return <Sparkles className={isExport ? "w-32 h-32 text-white/50" : "w-16 h-16 text-white/50"} />;

    // Handle AI-generated Image Icons (S3 or Fallback URLs)
    if (name.includes('/') || name.startsWith('http') || name.endsWith('.svg')) {
        let iconSrc = name;
        // Automatically proxy S3 URLs to bypass CORS
        if (name.includes('s3.amazonaws.com') && !name.includes('localhost:8000/icons/proxy')) {
            iconSrc = `http://localhost:8000/icons/proxy?url=${encodeURIComponent(name)}`;
        }

        return (
            <img
                src={iconSrc}
                crossOrigin="anonymous"
                loading="eager"
                alt="Icon"
                className={`${isExport ? 'w-64 h-64' : 'w-48 h-48'} object-contain drop-shadow-2xl opacity-95 transition-opacity duration-300`}
                onError={(e) => {
                    // Fallback to proxied icon (avoid direct S3 CORS issues)
                    const fallbackS3 = "https://bloomgrow-assets.s3.amazonaws.com/icons/6acc41ff-2498-4799-87a4-7f00fb3f80c8.svg";
                    const proxiedFallback = `http://localhost:8000/icons/proxy?url=${encodeURIComponent(fallbackS3)}`;
                    (e.target as HTMLImageElement).src = proxiedFallback;
                    (e.target as HTMLImageElement).onerror = null; // Prevent infinite loops
                }}
            />
        );
    }

    if (name === 'smiley') return <span className={`${emojiClass} text-white leading-none`}>☺</span>;
    if (name === 'moon') return <span className={`${emojiClass} text-white leading-none`}>☾</span>;
    if (name === 'star') return <Sparkles className={`${isExport ? 'w-32 h-32' : 'w-12 h-12'} text-white`} />;
    if (name === 'flower') return <span className={`${emojiClass} text-white leading-none`}>✿</span>;
    if (name === 'rocket') return <span className={`${emojiClass} text-white leading-none`}>🚀</span>;

    return <ImageIcon2 className={defaultIconClass} />;
}
