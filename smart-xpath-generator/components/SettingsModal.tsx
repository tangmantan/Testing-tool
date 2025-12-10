
import React, { useState, useEffect } from "react";
import { Settings, X, Save } from "lucide-react";
import { AISettings, AIProvider } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AISettings;
  onSave: (settings: AISettings) => void;
}

const PRESETS: Record<string, Partial<AISettings>> = {
  gemini: {
    provider: 'gemini',
    baseUrl: '',
    model: 'gemini-2.5-flash',
  },
  deepseek: {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSave,
}) => {
  const [formData, setFormData] = useState<AISettings>(currentSettings);

  useEffect(() => {
    if (isOpen) {
        setFormData(currentSettings);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleProviderChange = (provider: AIProvider) => {
    if (provider === 'gemini') {
        setFormData({
            ...formData,
            ...PRESETS.gemini,
            apiKey: '' 
        });
    } else if (provider === 'deepseek') {
        setFormData({
            ...formData,
            ...PRESETS.deepseek,
            apiKey: formData.provider === 'deepseek' ? formData.apiKey : '' 
        });
    } else {
        setFormData({ ...formData, provider: 'custom' });
    }
  };

  const getEnvHint = () => {
      switch (formData.provider) {
          case 'gemini': return 'API_KEY';
          case 'deepseek': return 'DEEPSEEK_API_KEY';
          case 'custom': return 'CUSTOM_API_KEY';
          default: return '';
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-lg rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Settings className="w-4 h-4 text-blue-400" />
            <span>AI 模型配置</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="p-5 space-y-5 overflow-y-auto">
          
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">服务提供商</label>
            <div className="grid grid-cols-3 gap-2">
                {(['gemini', 'deepseek', 'custom'] as AIProvider[]).map((p) => (
                    <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={`px-3 py-2 rounded text-sm font-medium border transition-all ${
                            formData.provider === p 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                    >
                        {p === 'gemini' ? 'Gemini' : p === 'deepseek' ? 'DeepSeek' : '自定义'}
                    </button>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Model Name */}
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">模型名称</label>
                <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
            </div>
            {/* Base URL */}
            {formData.provider !== 'gemini' && (
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">API 地址</label>
                    <input
                        type="text"
                        value={formData.baseUrl}
                        onChange={(e) => setFormData({...formData, baseUrl: e.target.value})}
                        placeholder={formData.provider === 'custom' ? "环境变量 CUSTOM_BASE_URL 或输入" : ""}
                        className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
                    />
                </div>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 flex justify-between">
                <span>API Key</span>
                <span className="text-gray-500 italic font-normal">
                    留空则读取 .env ({getEnvHint()})
                </span>
            </label>
            <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                placeholder="本地运行请配置 .env 或在此输入"
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
            />
          </div>

          {/* Custom Rules */}
          <div className="space-y-1.5">
             <label className="text-xs font-medium text-gray-400 flex justify-between">
                <span>自定义提示词规则 (可选)</span>
             </label>
             <textarea
                value={formData.customRules || ''}
                onChange={(e) => setFormData({...formData, customRules: e.target.value})}
                placeholder="例如：&#10;- 必须优先使用 data-testid 属性&#10;- 尽量不要使用 contains(text())&#10;- 总是返回单引号的 XPath"
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-600 min-h-[100px]"
             />
             <p className="text-[10px] text-gray-500">这些规则将附加到 System Prompt 中，指导 AI 生成更符合您偏好的选择器。</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-950/50 flex justify-end gap-3 shrink-0">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
                取消
            </button>
            <button 
                onClick={() => onSave(formData)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
                <Save className="w-4 h-4" />
                保存配置
            </button>
        </div>
      </div>
    </div>
  );
};
