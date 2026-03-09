import { Plus, Pause, Trash2, Zap, BrainCircuit, Loader2, AlertCircle, AlertTriangle, Info, CheckCircle2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface Finding {
    check_id: string;
    entity_id: string | null;
    issue_type: string;
    description: string;
    recommendation: string;
    severity: 'High' | 'Medium' | 'Low';
}

interface AuditResult {
    health_score: number;
    summary: { total: number; high: number; medium: number; low: number };
    findings: Finding[];
}

const SEVERITY_CONFIG = {
    High: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
    Medium: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
    Low: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
};

export default function AutomationRules() {
    const [loadingAudit, setLoadingAudit] = useState(false);
    const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [explanations, setExplanations] = useState<Record<string, string>>({});
    const [loadingExplain, setLoadingExplain] = useState<string | null>(null);
    const [expandedExplain, setExpandedExplain] = useState<string | null>(null);

    const runAudit = async () => {
        setLoadingAudit(true);
        setAuditError(null);
        try {
            const res = await fetch("http://localhost:8000/optimization/audit", { method: "POST" });
            const data = await res.json();
            if (data.status === "success") {
                setAuditResult(data);
            } else {
                setAuditError(data.message || "Audit failed.");
            }
        } catch (error) {
            setAuditError("[ERROR] Failed to connect to Marketing Brain.");
        } finally {
            setLoadingAudit(false);
        }
    };

    const explainFinding = async (f: Finding, key: string) => {
        if (explanations[key]) {
            setExpandedExplain(prev => prev === key ? null : key);
            return;
        }
        setLoadingExplain(key);
        try {
            const res = await fetch("http://localhost:8000/optimization/explain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    check_id: f.check_id,
                    issue_type: f.issue_type,
                    description: f.description,
                    recommendation: f.recommendation,
                    severity: f.severity,
                }),
            });
            const data = await res.json();
            if (data.status === "success") {
                setExplanations(prev => ({ ...prev, [key]: data.explanation }));
                setExpandedExplain(key);
            }
        } catch (e) {
            console.error("Explain failed", e);
        } finally {
            setLoadingExplain(null);
        }
    };

    const healthColor = !auditResult ? 'text-gray-400'
        : auditResult.health_score >= 75 ? 'text-green-600'
            : auditResult.health_score >= 50 ? 'text-yellow-600'
                : 'text-red-600';

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Optimization & Automation</h1>
                    <p className="text-gray-500 text-sm mt-1">Design automation rules and run the AI Marketing Brain audit.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={runAudit}
                        disabled={loadingAudit}
                        className="bg-purple-100 text-purple-700 px-4 py-2 rounded-md font-medium hover:bg-purple-200 transition flex items-center gap-2 shadow-sm disabled:opacity-50 border border-purple-200"
                    >
                        {loadingAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                        {loadingAudit ? "Auditing..." : "Run Marketing Brain Audit"}
                    </button>
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm">
                        <Plus className="w-4 h-4" /> Create Rule
                    </button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                {/* Left: Rule Builder */}
                <div className="w-96 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col shrink-0 overflow-y-auto">
                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" /> New Automation Rule
                    </h3>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                            <input type="text" placeholder="e.g. Pause low CTR ads" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">If (Condition)</label>
                                <div className="flex gap-2">
                                    <select className="border border-gray-200 rounded-md px-2 py-1.5 text-sm flex-1">
                                        <option>CTR</option><option>CPA</option><option>Spend</option>
                                    </select>
                                    <select className="border border-gray-200 rounded-md px-2 py-1.5 text-sm flex-1">
                                        <option>is less than</option><option>is greater than</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 mt-2 items-center">
                                    <input type="number" placeholder="0.5" className="border border-gray-200 rounded-md px-3 py-1.5 text-sm flex-1" />
                                    <span className="text-gray-500 text-sm font-medium">%</span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                                <label className="block text-xs font-bold text-indigo-500 uppercase mb-2">Then (Action)</label>
                                <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 outline-none">
                                    <option>Pause Ad</option>
                                    <option>Increase Budget by 20%</option>
                                    <option>Decrease Budget by 20%</option>
                                    <option>Send Email Alert</option>
                                </select>
                            </div>
                        </div>
                        <button className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-md font-medium hover:bg-indigo-700 transition shadow-sm">
                            Save Rule
                        </button>
                    </div>
                </div>

                {/* Right: Active Rules + Audit Output */}
                <div className="flex-1 space-y-5 flex flex-col min-h-0 overflow-hidden">
                    {/* Active Rules Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="font-bold text-gray-900">Active Rules</h3>
                        </div>
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3">Rule Name</th>
                                    <th className="px-6 py-3">Condition</th>
                                    <th className="px-6 py-3">Action</th>
                                    <th className="px-6 py-3 text-right">Controls</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 border-l-4 border-l-green-500">Cut Losers</td>
                                    <td className="px-6 py-4"><code className="bg-gray-100 px-2 py-1 rounded text-pink-600 text-xs font-mono">CTR &lt; 0.8%</code></td>
                                    <td className="px-6 py-4 font-medium text-gray-700">Pause Ad</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-1 text-gray-400 hover:text-orange-600"><Pause className="w-4 h-4" /></button>
                                        <button className="p-1 text-gray-400 hover:text-red-600 ml-2"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 border-l-4 border-l-green-500">Scale Winners</td>
                                    <td className="px-6 py-4"><code className="bg-gray-100 px-2 py-1 rounded text-pink-600 text-xs font-mono">Score &gt; 5.0</code></td>
                                    <td className="px-6 py-4 font-medium text-indigo-600">Increase Budget 20%</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-1 text-gray-400 hover:text-orange-600"><Pause className="w-4 h-4" /></button>
                                        <button className="p-1 text-gray-400 hover:text-red-600 ml-2"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Marketing Brain Audit Results */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-purple-600" />
                                <h3 className="font-bold text-gray-900">Marketing Brain Audit Results</h3>
                                <span className="text-xs text-gray-400 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">Claude 3 Haiku · AWS Bedrock</span>
                            </div>
                            {auditResult && (
                                <div className="flex items-center gap-3 text-sm">
                                    <span className={`text-2xl font-bold ${healthColor}`}>{auditResult.health_score}/100</span>
                                    <span className="text-gray-400 text-xs">Ads Health Score</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {loadingAudit ? (
                                <div className="flex items-center justify-center h-32 text-purple-500">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Running audit...
                                </div>
                            ) : auditError ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">{auditError}</div>
                            ) : !auditResult ? (
                                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center text-gray-500 font-mono text-sm">
                                    <BrainCircuit className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                                    <p className="text-gray-400">Click "Run Marketing Brain Audit" to analyze your account.</p>
                                    <p className="text-gray-600 text-xs mt-2">9 rule-based checks • Click "Explain with AI" on any finding to call Claude via Bedrock</p>
                                </div>
                            ) : auditResult.findings.length === 0 ? (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                    <p className="font-semibold text-green-700">All checks passed!</p>
                                    <p className="text-green-600 text-sm">Your account scored {auditResult.health_score}/100</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex gap-3 text-xs mb-1 shrink-0">
                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">{auditResult.summary.high} High</span>
                                        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold">{auditResult.summary.medium} Medium</span>
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">{auditResult.summary.low} Low</span>
                                    </div>
                                    {auditResult.findings.map((f, i) => {
                                        const cfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.Low;
                                        const Icon = cfg.icon;
                                        const key = `${f.check_id}-${i}`;
                                        const isExplaining = loadingExplain === key;
                                        const explanation = explanations[key];
                                        const isExpanded = expandedExplain === key;
                                        return (
                                            <div key={i} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
                                                <div className="flex items-start gap-3">
                                                    <Icon className={`w-5 h-5 ${cfg.color} shrink-0 mt-0.5`} />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className="font-bold text-gray-900 text-sm">{f.issue_type}</span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.badge}`}>{f.severity}</span>
                                                            <span className="text-xs text-gray-400 font-mono">{f.check_id}</span>
                                                            <button
                                                                onClick={() => explainFinding(f, key)}
                                                                disabled={isExplaining}
                                                                className="ml-auto flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full hover:bg-purple-200 transition disabled:opacity-50 font-medium border border-purple-200"
                                                            >
                                                                {isExplaining
                                                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Asking Claude...</>
                                                                    : explanation
                                                                        ? isExpanded
                                                                            ? <><ChevronUp className="w-3 h-3" /> Hide</>
                                                                            : <><ChevronDown className="w-3 h-3" /> Show AI</>
                                                                        : <><Sparkles className="w-3 h-3" /> Explain with AI</>
                                                                }
                                                            </button>
                                                        </div>
                                                        <p className="text-gray-700 text-xs mb-2">{f.description}</p>
                                                        <p className="text-xs font-medium text-gray-800">💡 {f.recommendation}</p>
                                                        {explanation && isExpanded && (
                                                            <div className="mt-3 bg-white border border-purple-200 rounded-lg p-3">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                                                    <span className="text-xs font-bold text-purple-700">Claude 3 Haiku · AWS Bedrock</span>
                                                                </div>
                                                                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{explanation}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
