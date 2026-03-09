import { useState, useEffect } from 'react';
import { Save, Loader2, Palette, Target, MessageSquare, Briefcase, Layout as LayoutIcon, Type } from 'lucide-react';

interface BrandingSettings {
    primary_audience: string;
    market_segment: string;
    comm_style: string;
    content_mix: string[];
    content_length: string;
    ai_prominence: string;
    tone_preference: string;
    design_direction: string;
    visual_focus: string;
    admired_brands: string;
    brand_colors: string;
    avoid_colors: string;
    typography: string;
    execution_priority: string;
}

const INITIAL_STATE: BrandingSettings = {
    primary_audience: '',
    market_segment: 'premium urban parents',
    comm_style: 'Balanced',
    content_mix: ['Parenting insights'],
    content_length: 'short and sharp',
    ai_prominence: 'Subtle',
    tone_preference: 'Warm & supportive',
    design_direction: 'Minimal & clean',
    visual_focus: 'Children',
    admired_brands: '',
    brand_colors: '',
    avoid_colors: '',
    typography: 'Modern sans-serif',
    execution_priority: 'All simultaneously'
};

const OPTIONS = {
    comm_style: ['Tech-forward', 'Science-backed', 'Emotion-led', 'Balanced'],
    content_mix: ['Thought leadership', 'Parenting insights', 'Product education', 'Research & data', 'Founder storytelling'],
    content_length: ['short and sharp', 'slightly explanatory'],
    ai_prominence: ['None', 'Subtle', 'Prominent'],
    tone_preference: ['Calm & intelligent', 'Bold & disruptive', 'Warm & supportive', 'Visionary & futuristic'],
    design_direction: ['Minimal & clean', 'Soft & nurturing', 'Modern SaaS', 'Playful but structured'],
    visual_focus: ['Parents', 'Children', 'Product UI', 'Abstract tech elements'],
    market_segment: ['premium urban parents', 'broader mass-market segment'],
    typography: ['Modern sans-serif', 'Rounded friendly fonts', 'Premium serif', 'Clean SaaS pairing'],
    execution_priority: ['Website', 'App UI', 'LinkedIn', 'Instagram', 'All simultaneously'],
    brand_palette: ['Trust blues', 'Calm greens', 'Neutral & muted', 'Bold contrast', 'Soft pastels']
};

export default function Settings() {
    const [settings, setSettings] = useState<BrandingSettings>(INITIAL_STATE);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("http://localhost:8000/settings/branding");
                const data = await res.json();
                if (data.status === "success" && Object.keys(data.data).length > 0) {
                    setSettings({ ...INITIAL_STATE, ...data.data });
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("http://localhost:8000/settings/branding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (data.status === "success") {
                setMessage({ type: 'success', text: 'Branding identity updated successfully!' });
            } else {
                setMessage({ type: 'error', text: 'Failed to update settings.' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Connection error.' });
        } finally {
            setSaving(false);
        }
    };

    const toggleContentMix = (item: string) => {
        setSettings(s => ({
            ...s,
            content_mix: s.content_mix.includes(item)
                ? s.content_mix.filter(i => i !== item)
                : [...s.content_mix, item]
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Brand Identity & Audience</h1>
                <p className="text-gray-500 text-sm mt-1">Configure your branding to steer the AI agents towards your specific voice and style.</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Target Audience */}
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-600" /> Target Audience
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Primary Audience Description</label>
                            <textarea
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                rows={2}
                                placeholder="e.g., Working parents in US/UK with kids aged 3-8, income $100k+"
                                value={settings.primary_audience}
                                onChange={e => setSettings(s => ({ ...s, primary_audience: e.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Market Segment</label>
                            <div className="grid grid-cols-2 gap-2">
                                {OPTIONS.market_segment.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setSettings(s => ({ ...s, market_segment: opt }))}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${settings.market_segment === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                    >{opt}</button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Communication Style</label>
                            <div className="grid grid-cols-2 gap-2">
                                {OPTIONS.comm_style.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setSettings(s => ({ ...s, comm_style: opt }))}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${settings.comm_style === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                    >{opt}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Content Direction */}
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-indigo-600" /> Content Direction
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Content Mix Preference</label>
                            <div className="flex flex-wrap gap-2">
                                {OPTIONS.content_mix.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => toggleContentMix(opt)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${settings.content_mix.includes(opt) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                    >{opt}</button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Tone Focus</label>
                                <select
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none capitalize"
                                    value={settings.tone_preference}
                                    onChange={e => setSettings(s => ({ ...s, tone_preference: e.target.value }))}
                                >
                                    {OPTIONS.tone_preference.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">AI Prominence</label>
                                <select
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={settings.ai_prominence}
                                    onChange={e => setSettings(s => ({ ...s, ai_prominence: e.target.value }))}
                                >
                                    {OPTIONS.ai_prominence.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Visual Identity */}
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <LayoutIcon className="w-5 h-5 text-indigo-600" /> Visual Identity
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Design Direction</label>
                            <select
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={settings.design_direction}
                                onChange={e => setSettings(s => ({ ...s, design_direction: e.target.value }))}
                            >
                                {OPTIONS.design_direction.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Visual Focus</label>
                            <div className="grid grid-cols-2 gap-2">
                                {OPTIONS.visual_focus.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setSettings(s => ({ ...s, visual_focus: opt }))}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${settings.visual_focus === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                    >{opt}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Colors & Typography */}
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-indigo-600" /> Colors & Typography
                    </h2>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 text-xs">Brand HEX Colors / Direction</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="#4F46E5, #10B981"
                                    value={settings.brand_colors}
                                    onChange={e => setSettings(s => ({ ...s, brand_colors: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 text-xs">Colors to Avoid</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Neon Pink, Dark Red"
                                    value={settings.avoid_colors}
                                    onChange={e => setSettings(s => ({ ...s, avoid_colors: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                                <Type className="w-4 h-4" /> Typography Preference
                            </label>
                            <select
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={settings.typography}
                                onChange={e => setSettings(s => ({ ...s, typography: e.target.value }))}
                            >
                                {OPTIONS.typography.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Strategy & Execution */}
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm md:col-span-2 space-y-6">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-indigo-600" /> Strategy & Execution
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Admired Brands (Design Language)</label>
                            <textarea
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                rows={2}
                                placeholder="e.g., Apple (clean), Headspace (nurturing), Stripe (premium SaaS)"
                                value={settings.admired_brands}
                                onChange={e => setSettings(s => ({ ...s, admired_brands: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2 font-medium">Primary Execution Channel</label>
                            <div className="grid grid-cols-2 gap-2">
                                {OPTIONS.execution_priority.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setSettings(s => ({ ...s, execution_priority: opt }))}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${settings.execution_priority === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                    >{opt}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Branding Identity
                </button>
            </div>
        </div>
    );
}
