
import React, { useState } from "react";
import { XpathResult, AIProvider, VerificationStatus } from "../types";
import { Copy, Check, Loader2, Info, Hash, FileCode, Tag, Sparkles, Trash2, AlertTriangle, Eye, Layers } from "lucide-react";

interface ResultPanelProps {
  loading: boolean;
  history: XpathResult[];
  onClearHistory: () => void;
  onPreviewSelector: (selector: string, type: 'xpath' | 'css') => void;
  onUpdateHistory: (id: string, newValues: { xpath?: string, cssSelector?: string }) => void;
  modelName: string;
  provider: AIProvider;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ 
    loading, 
    history, 
    onClearHistory, 
    onPreviewSelector,
    onUpdateHistory,
    modelName, 
    provider 
}) => {
  return (
    <div className="flex flex-col h-full bg-gray-900 border-t border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-100">
                生成历史
                {history.length > 0 && <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">{history.length}</span>}
            </h3>
            {loading && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
        </div>
        {history.length > 0 && (
            <button 
                onClick={onClearHistory}
                className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
                <Trash2 className="w-3 h-3" /> 清空
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {history.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">
                <Info className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无记录</p>
                <p className="text-xs text-gray-600 mt-1">在右侧点击元素以生成选择器</p>
            </div>
        )}

        {loading && (
             <div className="animate-pulse space-y-3 mb-6 bg-gray-900/50 p-2 rounded">
                <div className="h-4 bg-gray-800 rounded w-1/3 mb-2"></div>
                <div className="h-10 bg-gray-800 rounded w-full"></div>
                <div className="h-10 bg-gray-800 rounded w-full"></div>
             </div>
        )}

        {history.map((result) => (
            <div key={result.id} className="group relative border-l-2 border-gray-700 pl-4 pb-1 hover:border-blue-500 transition-colors animate-in slide-in-from-left-2 fade-in duration-300">
                
                {/* Header Info */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-blue-300 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-900/30">
                            {result.elementSummary || 'Element'}
                        </span>
                        <span className="text-[10px] text-gray-600">
                            {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                    {/* Model Badge */}
                    <div className="opacity-50 group-hover:opacity-100 transition-opacity text-[10px] flex items-center gap-1 text-gray-500 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">
                        <Sparkles className="w-2.5 h-2.5" />
                        {result.model || modelName}
                    </div>
                </div>

                {/* Iframe Warning */}
                {result.iframeWarning && (
                    <div className="mb-3 bg-amber-950/20 border border-amber-900/40 rounded px-2 py-1.5 flex gap-2 items-start">
                        <Layers className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-amber-200/80">{result.iframeWarning}</span>
                    </div>
                )}

                {/* Selectors */}
                <div className="space-y-3">
                    <SelectorItem 
                        label="XPath" 
                        value={result.xpath} 
                        onChange={(val) => onUpdateHistory(result.id, { xpath: val })}
                        icon={<FileCode className="w-3 h-3" />}
                        colorClass="text-green-400 focus:text-green-300"
                        verification={result.verification?.xpath}
                        onMouseEnter={() => onPreviewSelector(result.xpath, 'xpath')}
                        onMouseLeave={() => onPreviewSelector('', 'xpath')}
                    />

                    <SelectorItem 
                        label="CSS" 
                        value={result.cssSelector} 
                        onChange={(val) => onUpdateHistory(result.id, { cssSelector: val })}
                        icon={<Hash className="w-3 h-3" />}
                        colorClass="text-blue-400 focus:text-blue-300"
                        verification={result.verification?.css}
                        onMouseEnter={() => onPreviewSelector(result.cssSelector, 'css')}
                        onMouseLeave={() => onPreviewSelector('', 'css')}
                    />
                </div>
                
                {/* Explanation */}
                <div className="mt-3 text-xs text-gray-500 leading-relaxed border-t border-gray-800/50 pt-2">
                    {result.explanation}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

const SelectorItem = ({ 
    label, 
    value, 
    onChange,
    icon, 
    colorClass, 
    verification,
    onMouseEnter,
    onMouseLeave
}: { 
    label: string, 
    value: string, 
    onChange: (val: string) => void,
    icon: React.ReactNode, 
    colorClass: string,
    verification?: VerificationStatus,
    onMouseEnter: () => void,
    onMouseLeave: () => void
}) => {
    const [copied, setCopied] = useState(false);
  
    const handleCopy = () => {
      navigator.clipboard.writeText(value || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                    {icon}
                    {label}
                </div>
                {verification && (
                    <div className={`text-[10px] flex items-center gap-1 px-1.5 rounded ${verification.isValid && verification.matchCount === 1 ? 'text-green-400 bg-green-900/20' : 'text-amber-400 bg-amber-900/20'}`}>
                        {verification.isValid ? (
                            <>
                                {verification.matchCount === 1 ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                匹配 {verification.matchCount} 个
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-3 h-3" /> 无效
                            </>
                        )}
                    </div>
                )}
            </div>
            
            <div className="relative group">
                <textarea
                    value={value || ""}
                    onChange={(e) => {
                        onChange(e.target.value);
                        onMouseEnter(); // Trigger preview update immediately
                    }}
                    onFocus={onMouseEnter}
                    spellCheck={false}
                    rows={Math.max(2, Math.min(5, Math.ceil((value || "").length / 40)))}
                    className={`w-full bg-gray-950 border border-gray-700 hover:border-gray-500 focus:border-blue-500/50 rounded px-2.5 py-2 font-mono text-xs shadow-sm ${colorClass} transition-colors resize-y focus:outline-none focus:ring-1 focus:ring-blue-900/30 pr-8 block`}
                    style={{ minHeight: "2.5rem" }}
                />
                <button
                    onClick={handleCopy}
                    className="absolute right-1 top-1.5 p-1 text-gray-500 hover:text-white transition-colors bg-gray-800/50 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
                    title="复制"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>
        </div>
    );
};
