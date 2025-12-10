
import React, { useState } from "react";
import { Layers, List, AlignLeft, Globe, Loader2, ArrowRight, X, AlertCircle, RefreshCcw, WifiOff, ShieldAlert, Terminal, Copy, Check } from "lucide-react";

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

// List of free CORS proxies to try in order
const PROXY_SERVICES = [
    {
        name: "AllOrigins",
        getUrl: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&disableCache=${Date.now()}`
    },
    {
        name: "CorsProxy.io",
        getUrl: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
    },
    {
        name: "CodeTabs",
        getUrl: (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    },
    {
        name: "ThingProxy",
        getUrl: (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`
    }
];

// Helper to check for private/intranet IPs
const isPrivateNetwork = (url: string): boolean => {
    try {
        const hostname = new URL(url).hostname;
        
        // Localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
        
        // Private IPv4 ranges
        // 10.0.0.0 - 10.255.255.255
        if (hostname.startsWith('10.')) return true;
        // 192.168.0.0 - 192.168.255.255
        if (hostname.startsWith('192.168.')) return true;
        // 172.16.0.0 - 172.31.255.255
        if (hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return true;
        
        // .local domains (mDNS)
        if (hostname.endsWith('.local')) return true;

        return false;
    } catch (e) {
        return false;
    }
};

export const HtmlEditor: React.FC<HtmlEditorProps> = ({ value, onChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentProxyIndex, setCurrentProxyIndex] = useState(0);
  const [isIntranetMode, setIsIntranetMode] = useState(false);
  const [consoleSnippet, setConsoleSnippet] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const formatHtml = () => {
    let formatted = '';
    let pad = 0;
    const lines = value
        .replace(/>\s*</g, '>\n<') // Break tags
        .split('\n');

    lines.forEach(line => {
        let indent = 0;
        const trimmed = line.trim();
        if (trimmed.match(/^<\//)) {
            pad -= 2;
        } else if (trimmed.match(/^<.*>\s*$/) && !trimmed.match(/^<.*(\/)|(br)|(hr)|(img)|(input).*>/)) {
            indent = 2;
        }
        
        if (pad < 0) pad = 0;
        formatted += ' '.repeat(pad) + trimmed + '\n';
        pad += indent;
    });
    
    onChange(formatted.trim());
  };

  const fetchWithTimeout = async (url: string, timeout = 8000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(id);
          return response;
      } catch (err) {
          clearTimeout(id);
          throw err;
      }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg(null);
      setConsoleSnippet(null);
      setCurrentProxyIndex(0);
      setIsIntranetMode(false);
      
      let targetUrl = urlInput.trim();
      if (!targetUrl) return;

      // Normalize URL
      if (!/^https?:\/\//i.test(targetUrl)) {
          // If it looks like an IP or localhost, default to http
          if (targetUrl.match(/^(\d{1,3}\.|localhost)/)) {
             targetUrl = 'http://' + targetUrl; 
          } else {
             targetUrl = 'https://' + targetUrl;
          }
      }

      const isIntranet = isPrivateNetwork(targetUrl);
      setIsIntranetMode(isIntranet);
      setIsLoading(true);

      try {
          if (isIntranet) {
            // --- INTRANET STRATEGY: Direct Fetch ONLY ---
            try {
                const response = await fetchWithTimeout(targetUrl, 5000);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const html = await response.text();
                onChange(html);
                setShowUrlInput(false);
                setUrlInput("");
            } catch (err: any) {
                console.error("Intranet fetch failed:", err);
                throw new Error("内网直连失败");
            }
          } else {
             // --- PUBLIC INTERNET STRATEGY: Try Proxies ---
             let success = false;
             
             for (let i = 0; i < PROXY_SERVICES.length; i++) {
                 const proxy = PROXY_SERVICES[i];
                 setCurrentProxyIndex(i);
                 
                 try {
                     const response = await fetchWithTimeout(proxy.getUrl(targetUrl));
                     if (!response.ok) continue;

                     const html = await response.text();
                     if (!html || html.trim().length < 50 || html.includes("Access Denied")) continue;

                     onChange(html);
                     success = true;
                     break; 
                 } catch (err) {
                     // continue to next proxy
                 }
             }
             
             // If proxies fail, try one last direct fetch (user might have CORS extension)
             if (!success) {
                 try {
                     const response = await fetchWithTimeout(targetUrl, 3000);
                     if (response.ok) {
                         const html = await response.text();
                         onChange(html);
                         success = true;
                     }
                 } catch(e) {}
             }

             if (success) {
                 setShowUrlInput(false);
                 setUrlInput("");
             } else {
                 throw new Error("Proxy Failed");
             }
          }
      } catch (err: any) {
          if (isIntranet) {
              setErrorMsg("内网 IP 无法被在线工具访问 (CORS 限制)。");
              setConsoleSnippet("copy(document.documentElement.outerHTML)");
          } else {
              setErrorMsg(`导入失败。目标网站 (${new URL(targetUrl).hostname}) 拒绝了访问。`);
              // Also offer snippet for public sites that block proxies
              setConsoleSnippet("copy(document.documentElement.outerHTML)");
          }
      } finally {
          setIsLoading(false);
      }
  };

  const copySnippet = () => {
      if (!consoleSnippet) return;
      navigator.clipboard.writeText(consoleSnippet);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 2000);
  };

  const openUrlInput = () => {
      setShowUrlInput(true);
      setErrorMsg(null);
      setConsoleSnippet(null);
      if (!urlInput) setUrlInput("http://");
  };

  const closeUrlInput = () => {
      setShowUrlInput(false);
      setErrorMsg(null);
      setConsoleSnippet(null);
      if (isLoading) setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
        <div className="flex flex-col border-b border-gray-800 shrink-0 bg-gray-900">
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar min-h-[50px]">
                {showUrlInput ? (
                    <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-left-2 duration-200">
                        <Globe className={`w-4 h-4 shrink-0 ${errorMsg ? 'text-red-400' : 'text-blue-400'}`} />
                        <input 
                            type="text" 
                            value={urlInput}
                            onChange={(e) => {
                                setUrlInput(e.target.value);
                                if (errorMsg) { setErrorMsg(null); setConsoleSnippet(null); }
                            }}
                            className={`flex-1 bg-gray-800 border ${errorMsg ? 'border-red-500/50 focus:border-red-500' : 'border-gray-700 focus:border-blue-500'} text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-opacity-50 transition-all placeholder-gray-600`}
                            placeholder="输入网址 (如 10.10.x.x 或 google.com)"
                            autoFocus
                        />
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className={`p-1.5 rounded transition-colors text-white flex items-center gap-1 ${isLoading ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
                            title="开始导入"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span className="text-[10px] whitespace-nowrap">
                                        {isIntranetMode ? '直连中...' : `线路 ${currentProxyIndex + 1}`}
                                    </span>
                                </>
                            ) : (
                                <ArrowRight className="w-3.5 h-3.5" />
                            )}
                        </button>
                        <button 
                            type="button"
                            onClick={closeUrlInput}
                            disabled={isLoading}
                            className="text-gray-500 hover:text-gray-300 p-1.5 hover:bg-gray-800 rounded transition-colors"
                            title="取消"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </form>
                ) : (
                    <>
                        <button 
                            onClick={openUrlInput}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-900/20 hover:bg-blue-900/40 text-blue-200 border border-blue-800/30 rounded transition-all active:scale-95 whitespace-nowrap mr-1"
                            title="从 URL 导入 HTML"
                        >
                            <Globe className="w-3.5 h-3.5" />
                            <span>导入 URL</span>
                        </button>

                        <div className="w-px h-4 bg-gray-700 mx-1"></div>

                        <button 
                            onClick={formatHtml}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded border border-gray-700 transition-all active:scale-95"
                            title="简单的格式化 HTML"
                        >
                            <AlignLeft className="w-3.5 h-3.5" />
                            <span>格式化</span>
                        </button>
                    </>
                )}
            </div>
            
            {/* Error Message & Console Snippet */}
            {errorMsg && showUrlInput && (
                <div className="bg-red-900/10 border-b border-red-900/20 animate-in slide-in-from-top-1">
                    <div className="text-red-300 text-[10px] px-4 py-2 flex items-start gap-1.5">
                        {isIntranetMode ? <WifiOff className="w-3 h-3 shrink-0 mt-0.5" /> : <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />}
                        <span className="leading-tight">{errorMsg}</span>
                    </div>
                    
                    {consoleSnippet && (
                        <div className="px-4 pb-3 pl-8">
                             <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                                <Terminal className="w-3 h-3" />
                                <span>在目标网页控制台(F12)运行此命令可快速复制源码：</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <code className="flex-1 bg-gray-950 text-green-400 font-mono text-[10px] px-2 py-1.5 rounded border border-gray-800 select-all overflow-hidden whitespace-nowrap text-ellipsis">
                                    {consoleSnippet}
                                </code>
                                <button 
                                    onClick={copySnippet}
                                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2 py-1.5 rounded border border-gray-700 transition-colors"
                                    title="复制命令"
                                >
                                    {snippetCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        <textarea
            className="flex-1 w-full bg-gray-900 text-gray-300 font-mono text-xs p-4 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gray-800 resize-none border-none leading-relaxed"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder="在此粘贴您的 HTML 代码..."
        />
    </div>
  );
};
