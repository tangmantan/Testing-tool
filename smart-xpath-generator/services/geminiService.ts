
import { GoogleGenAI, Type } from "@google/genai";
import { TargetElementInfo, XpathResult, AISettings } from "../types";

// Helper to clean HTML to save tokens
const cleanHtml = (html: string): string => {
    if (!html) return "";
    let cleaned = html;
    // Remove SVG contents
    cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, '<svg>...</svg>');
    // Truncate long base64 sources
    cleaned = cleaned.replace(/src="data:image\/[^;]+;base64,[^"]+"/g, 'src="data:image...[truncated]"');
    // Truncate long styles
    cleaned = cleaned.replace(/style="[^"]{50,}"/g, 'style="..."');
    return cleaned;
};

const getSystemPrompt = (elementInfo: TargetElementInfo, customRules?: string) => `
    你是一名拥有10年经验的资深前端工程师，精通 CSS 选择器和 XPath 定位艺术。你的目标是生成**精准、高性能、高可维护性**的定位符。

    ### 输入数据概览:
    - 标签: <${elementInfo.tagName}>
    - 文本: "${elementInfo.innerText.replace(/"/g, '\\"')}"
    - 属性: ${JSON.stringify(elementInfo.attributes)}
    - **Total Text Matches (同类文本总数)**: ${elementInfo.matchIndices?.totalByText || '1'}
    - **Global Text Index (当前文本索引)**: ${elementInfo.matchIndices?.byText || '1'}
    - 兄弟节点索引: ${elementInfo.elementIndex}
    - 父级链: ${JSON.stringify(elementInfo.ancestors?.slice(0, 4).map(a => `${a.tagName}${a.id ? '#'+a.id : ''}${a.className ? '.'+a.className.trim().replace(/\s+/g, '.') : ''}`) || [])}

    ---

    ### 1. XPath 生成规则 (必须严格执行):
    
    **核心原则**: 只要元素有文本和属性，**必须**将它们组合起来。拒绝使用脆弱的绝对路径 (如 /div/div[2]/span)。
    
    **语法模板**: 
    \`//tag[@属性='值' and text()='内容']\`
    
    **关键逻辑 (索引处理)**:
    - **检查 Total Text Matches**:
      - **情况 A (Total == 1)**: 元素是唯一的。**严禁**添加 \`[1]\`。
        - 正确: \`//button[text()='登录']\`
        - 错误: \`//button[text()='登录'][1]\`
      - **情况 B (Total > 1)**: 元素有重复。**必须**在表达式末尾添加索引 \`(...)[N]\`。
        - 正确: \`(//button[text()='保存'])[2]\`
        - 错误: \`//button[text()='保存']\` (这会导致定位错误)

    **文本匹配细节**:
    - 如果是 \`div\`: 必须用 \`contains(text(), '...')\` (容忍换行)。
    - 如果是 \`button\`, \`a\`, \`span\`, \`label\`: 优先用 \`text()='...'\` (精准匹配)，除非文本极长或包含动态空格。

    ---

    ### 2. CSS Selector 生成规则 (大师级):

    **心法总纲**:
    1. **精准至上**: 像 GPS 一样精准。
    2. **语义优先**: 寻找 \`id\`, \`name\`, \`data-*\`, \`role\` 等强语义钩子。
    3. **拒绝脆弱**: 避免依赖纯样式类名 (如 \`p-4 flex\`) 或过深的层级。

    **招式拆解**:

    **第一层: 独一无二**
    - ID (非随机): \`#submit-btn\`
    - 测试属性: \`[data-testid="login-input"]\`
    - 强语义: \`input[name="username"]\`

    **第二层: 组合连招**
    - 标签 + 类名 + 属性: \`button.btn-primary[type="submit"]\`
    - 模糊匹配: \`a[href^="https://login"]\`

    **第三层: 上下文限定**
    - 优先使用子代 (>): \`#login-form > .actions > button\`
    
    **第四层: 结构兜底**
    - 必须使用 \`:nth-of-type(n)\`，**严禁**使用 \`:nth-child\`。
    - 否定伪类: \`input:not([disabled])\`

    ---

    ${customRules ? `用户自定义规则:\n${customRules}\n` : ""}

    输出格式: JSON Only. 
    必须包含 JSON 字段: "xpath" (string), "cssSelector" (string), "explanation" (string)。
    可选字段: "idSelector" (string|null), "nameSelector" (string|null), "iframeWarning" (string|null)。
`;

export const generateSmartXpath = async (
  elementInfo: TargetElementInfo,
  settings: AISettings
): Promise<Omit<XpathResult, 'verification'>> => { // verification happens on client side
  
  const systemPrompt = getSystemPrompt(elementInfo, settings.customRules);
  const now = Date.now();
  const baseResult = {
      id: `${now}`,
      timestamp: now,
      elementSummary: `<${elementInfo.tagName}> ${elementInfo.innerText.slice(0, 20)}...`,
      model: settings.model,
      provider: settings.provider
  };

  let rawJson: any = {};

  try {
    if (settings.provider === 'gemini') {
      const apiKey = settings.apiKey || process.env.API_KEY;
      if (!apiKey) throw new Error("Missing API Key for Gemini");

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: settings.model || "gemini-2.5-flash",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              xpath: { type: Type.STRING },
              cssSelector: { type: Type.STRING },
              idSelector: { type: Type.STRING, nullable: true },
              nameSelector: { type: Type.STRING, nullable: true },
              explanation: { type: Type.STRING },
              iframeWarning: { type: Type.STRING, nullable: true },
            },
            required: ["xpath", "cssSelector", "explanation"],
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      rawJson = JSON.parse(text);
    } 
    else {
      // Custom / Deepseek
      let apiKey = settings.apiKey;
      let baseUrl = settings.baseUrl;

      // Fallback to env vars
      if (settings.provider === 'deepseek' && !apiKey) {
          apiKey = process.env.DEEPSEEK_API_KEY || "";
      } else if (settings.provider === 'custom') {
          if (!apiKey) apiKey = process.env.CUSTOM_API_KEY || "";
          if (!baseUrl) baseUrl = process.env.CUSTOM_BASE_URL || "";
      }

      if (!apiKey) throw new Error(`Missing API Key for ${settings.provider}`);
      if (!baseUrl) throw new Error("Missing Base URL");

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: "system", content: "You are a JSON generator." },
            { role: "user", content: systemPrompt + "\n\nReturn strictly valid JSON with keys: xpath, cssSelector, explanation." }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API Request Failed: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI Provider");
      
      try {
        rawJson = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse JSON from AI", content);
        throw new Error("Invalid JSON response from AI");
      }
    }

    // Validate and Sanitize (兜底逻辑)
    return {
        ...baseResult,
        xpath: typeof rawJson.xpath === 'string' ? rawJson.xpath : "Error: No XPath generated",
        cssSelector: typeof rawJson.cssSelector === 'string' ? rawJson.cssSelector : "Error: No CSS generated",
        explanation: rawJson.explanation || "No explanation provided.",
        idSelector: rawJson.idSelector,
        nameSelector: rawJson.nameSelector,
        iframeWarning: rawJson.iframeWarning
    };

  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
};
