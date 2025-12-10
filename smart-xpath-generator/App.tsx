
import React, { useState, useCallback, useEffect, useRef } from "react";
import { HtmlEditor } from "./components/HtmlEditor";
import { DomPreview } from "./components/DomPreview";
import { ResultPanel } from "./components/ResultPanel";
import { SettingsModal } from "./components/SettingsModal";
import { DomTree } from "./components/DomTree"; // Import new component
import { generateSmartXpath } from "./services/geminiService";
import { TargetElementInfo, XpathResult, AISettings, VerificationStatus } from "./types";
import { Code2, Wand2, ChevronDown, ChevronUp, Layout, MousePointer2, MousePointerClick, Settings, PanelLeftClose, PanelLeftOpen, Network } from "lucide-react";

const INITIAL_HTML = `
<div id="app-container" class="card">
  <h2>Welcome to Login</h2>
  <form id="login-form">
    <div class="input-group">
      <label>Username</label>
      <input type="text" name="username" placeholder="Enter user" data-testid="user-input" />
    </div>
    <div class="input-group">
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter password" />
    </div>
    <div class="actions" style="margin-top: 20px;">
      <button type="button" class="btn-primary" onclick="alert('Logging in...')">登录</button>
      <a href="#" class="forgot-link">Forgot Password?</a>
    </div>
  </form>
</div>
`;

// Default Settings
const DEFAULT_SETTINGS: AISettings = {
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    model: 'gemini-2.5-flash',
    customRules: ''
};

function App() {
  // Persistence for HTML
  const [htmlContent, setHtmlContent] = useState(() => {
      return localStorage.getItem('xpath_gen_html') || INITIAL_HTML;
  });

  // Save HTML when changed
  useEffect(() => {
      localStorage.setItem('xpath_gen_html', htmlContent);
  }, [htmlContent]);

  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<XpathResult[]>([]);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<'editor' | 'tree'>('editor'); // New Tab State
  const [isInspectorActive, setIsInspectorActive] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  
  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_SETTINGS);

  // Preview Reverse Highlight
  const [previewSelector, setPreviewSelector] = useState<{ selector: string; type: 'xpath' | 'css' } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('xpath_generator_settings');
    if (saved) {
        try { setAiSettings(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const handleSaveSettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    localStorage.setItem('xpath_generator_settings', JSON.stringify(newSettings));
    setIsSettingsOpen(false);
  };

  // RESIZE LOGIC
  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
    const startX = mouseDownEvent.clientX;
    const startWidth = sidebarWidth;

    const doDrag = (mousemoveEvent: MouseEvent) => {
        const newWidth = startWidth + (mousemoveEvent.clientX - startX);
        // Limit width to reasonable bounds (min 300px, max 80% of window width)
        const maxWidth = window.innerWidth * 0.8;
        if (newWidth > 300 && newWidth < maxWidth) {
            setSidebarWidth(newWidth);
        }
    };

    const stopDrag = () => {
        setIsResizing(false);
        document.documentElement.removeEventListener('mousemove', doDrag);
        document.documentElement.removeEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
    };

    document.documentElement.addEventListener('mousemove', doDrag);
    document.documentElement.addEventListener('mouseup', stopDrag);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  const handleElementSelect = useCallback(async (info: TargetElementInfo) => {
    setLoading(true);
    
    try {
      // 1. Generate via AI
      const aiResponse = await generateSmartXpath(info, aiSettings);
      
      // 2. Client-side Verification (Back-testing)
      const iframe = document.querySelector('iframe');
      let verification = { xpath: { isValid: false, matchCount: 0 }, css: { isValid: false, matchCount: 0 } };

      if (iframe && (iframe as any).__verifySelector) {
          const verifier = (iframe as any).__verifySelector;
          verification = {
              xpath: verifier(aiResponse.xpath, 'xpath'),
              css: verifier(aiResponse.cssSelector, 'css')
          };
      }

      const fullResult: XpathResult = {
          ...aiResponse,
          verification
      };

      setHistory(prev => [fullResult, ...prev]);

    } catch (e) {
      console.error(e);
      // Add error to history
      setHistory(prev => [{
          id: Date.now().toString(),
          timestamp: Date.now(),
          xpath: "Error",
          cssSelector: "Error",
          explanation: `Failed: ${e instanceof Error ? e.message : "Unknown"}`,
          elementSummary: "Error",
          model: aiSettings.model,
          provider: aiSettings.provider
      }, ...prev]);
    } finally {
      setLoading(false);
    }
  }, [aiSettings]);

  // Support manual editing of selectors
  const handleHistoryUpdate = useCallback((id: string, newValues: { xpath?: string, cssSelector?: string }) => {
      setHistory(prev => prev.map(item => {
          if (item.id !== id) return item;
          
          const updatedItem = { ...item, ...newValues };
          
          // Re-verify immediately
          const iframe = document.querySelector('iframe');
          if (iframe && (iframe as any).__verifySelector) {
              const verifier = (iframe as any).__verifySelector;
              // We need to verify both because the item object is being recreated
              updatedItem.verification = {
                  xpath: verifier(updatedItem.xpath, 'xpath'),
                  css: verifier(updatedItem.cssSelector, 'css')
              };
          }
          return updatedItem;
      }));
  }, []);

  // Handle hover from Tree
  const handleTreeHover = (selector: string | null) => {
      setPreviewSelector(selector ? { selector, type: 'css' } : null);
  };

  return (
    <div className="h-screen md:h-dvh w-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={aiSettings}
        onSave={handleSaveSettings}
      />

      {/* Header */}
      <header className="flex-none h-14 border-b border-gray-800 bg-gray-950 flex items-center px-4 justify-between shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg">
                <Wand2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent truncate">
            智能 XPath 生成器
            </h1>
        </div>
        
        <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-all shrink-0"
        >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">
                {aiSettings.provider === 'gemini' ? 'Gemini' : aiSettings.provider === 'deepseek' ? 'DeepSeek' : 'Custom'}
            </span>
        </button>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Sidebar */}
        <div 
            style={{ width: window.innerWidth > 768 ? sidebarWidth : '100%' }}
            className="flex flex-col border-b md:border-b-0 md:border-r border-gray-800 bg-gray-900 z-20 shadow-xl flex-none h-[45%] md:h-auto"
        >
            {/* Upper Section: Tabbed (Editor / Tree) */}
            <div className={`flex flex-col border-b border-gray-800 transition-all duration-300 ${isEditorCollapsed ? 'flex-none' : 'flex-1 min-h-0'}`}>
                {/* Header / Tabs */}
                <div 
                  className="flex items-center justify-between bg-gray-800/50 select-none border-b border-gray-700/50 shrink-0"
                >
                    <div className="flex">
                        <button 
                            onClick={() => { setActiveLeftTab('editor'); setIsEditorCollapsed(false); }}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-r border-gray-700/50 transition-colors ${activeLeftTab === 'editor' ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                        >
                            <Code2 className="w-4 h-4" />
                            源代码
                        </button>
                        <button 
                            onClick={() => { setActiveLeftTab('tree'); setIsEditorCollapsed(false); }}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-r border-gray-700/50 transition-colors ${activeLeftTab === 'tree' ? 'bg-gray-800 text-purple-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                        >
                            <Network className="w-4 h-4" />
                            DOM 树
                        </button>
                    </div>

                    <button 
                        className="px-3 text-gray-400 hover:text-white"
                        onClick={() => setIsEditorCollapsed(!isEditorCollapsed)}
                    >
                        {isEditorCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                </div>
                
                {/* Content */}
                <div className={`flex-1 overflow-hidden relative ${isEditorCollapsed ? 'hidden' : 'block'}`}>
                     {activeLeftTab === 'editor' ? (
                         <HtmlEditor value={htmlContent} onChange={setHtmlContent} />
                     ) : (
                         <DomTree 
                            htmlContent={htmlContent} 
                            onElementSelect={handleElementSelect}
                            onHoverElement={handleTreeHover}
                         />
                     )}
                </div>
            </div>

            {/* History Result Section */}
            <div className="flex-none bg-gray-900 p-0 flex flex-col md:h-1/2 overflow-y-auto min-h-0 border-t border-gray-800">
                 <ResultPanel 
                    loading={loading} 
                    history={history}
                    onClearHistory={() => setHistory([])}
                    onPreviewSelector={(sel, type) => setPreviewSelector(sel ? { selector: sel, type } : null)}
                    onUpdateHistory={handleHistoryUpdate}
                    modelName={aiSettings.model}
                    provider={aiSettings.provider}
                 />
            </div>
        </div>

        {/* Resizer Handle (Desktop Only) */}
        <div
            className={`hidden md:flex w-2 bg-gray-950 hover:bg-blue-600 cursor-col-resize z-30 items-center justify-center transition-colors group -ml-1 border-r border-gray-800 ${isResizing ? 'bg-blue-600' : ''}`}
            onMouseDown={startResizing}
        >
            <div className={`h-8 w-0.5 rounded ${isResizing ? 'bg-white' : 'bg-gray-700 group-hover:bg-blue-200'}`}></div>
        </div>

        {/* Right Panel: Visual Preview */}
        <div className="flex-1 bg-white relative flex flex-col min-w-0 h-[55%] md:h-auto">
             <div className="h-10 bg-gray-100 border-b border-gray-300 flex items-center px-4 justify-between flex-none shrink-0">
                <div className="flex items-center gap-2 text-gray-600">
                    <Layout className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">可视化预览</span>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-gray-200 rounded-lg p-0.5">
                         <button
                            onClick={() => setIsInspectorActive(false)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${!isInspectorActive ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                         >
                            <MousePointer2 className="w-3 h-3" />
                            <span className="hidden sm:inline">交互模式</span>
                         </button>
                         <button
                            onClick={() => setIsInspectorActive(true)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${isInspectorActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                         >
                            <MousePointerClick className="w-3 h-3" />
                            <span className="hidden sm:inline">定位元素</span>
                         </button>
                    </div>
                </div>
             </div>
             <div className="flex-1 relative overflow-hidden">
                {/* Overlay to prevent iframe capturing mouse events during resize */}
                {isResizing && <div className="absolute inset-0 z-50 bg-transparent cursor-col-resize" />}
                
                <DomPreview 
                    htmlContent={htmlContent} 
                    onElementSelect={handleElementSelect} 
                    isInspectorActive={isInspectorActive}
                    previewSelector={previewSelector}
                />
             </div>
        </div>

      </main>
    </div>
  );
}

export default App;
