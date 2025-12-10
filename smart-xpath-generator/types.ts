
export interface AncestorNode {
  tagName: string;
  id: string;
  className: string;
  index: number; // nth-of-type index
}

export interface TargetElementInfo {
  tagName: string;
  outerHTML: string;
  innerText: string;
  attributes: Record<string, string>;
  parentOuterHTML?: string;
  siblingsSample?: string[];
  iframeContext?: string | null;
  elementIndex?: number; // 1-based index (nth-of-type)
  ancestors: AncestorNode[]; // Chain of parents up to body
  matchIndices?: {
    byText?: number; // 1-based index among elements with same Tag + Text
    totalByText?: number; // Total count of elements with same Tag + Text
  };
}

export interface VerificationStatus {
  isValid: boolean;
  matchCount: number;
  message?: string;
}

export interface XpathResult {
  id: string; // Unique ID for history
  timestamp: number;
  xpath: string;
  cssSelector: string;
  idSelector?: string | null;
  nameSelector?: string | null;
  explanation: string;
  iframeWarning?: string;
  elementSummary?: string; // Short summary of what was clicked (e.g. <button> Login)
  model?: string; // The model name used to generate this result
  provider?: string; // The provider used (gemini, deepseek, custom)
  verification?: {
    xpath: VerificationStatus;
    css: VerificationStatus;
  };
}

export type AIProvider = 'gemini' | 'deepseek' | 'custom';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  customRules?: string; // User defined instructions
}
