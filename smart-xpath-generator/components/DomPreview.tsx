
import React, { useRef, useEffect } from "react";
import { TargetElementInfo, VerificationStatus, AncestorNode } from "../types";

interface DomPreviewProps {
  htmlContent: string;
  onElementSelect: (info: TargetElementInfo) => void;
  isInspectorActive: boolean;
  // Props for reverse lookup
  previewSelector?: { selector: string; type: 'xpath' | 'css' } | null;
  // Callback to return verification results
  onVerifySelector?: (selector: string, type: 'xpath' | 'css', status: VerificationStatus) => void;
}

export const DomPreview: React.FC<DomPreviewProps> = ({
  htmlContent,
  onElementSelect,
  isInspectorActive,
  previewSelector,
  onVerifySelector
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const onElementSelectRef = useRef(onElementSelect);
  const isInspectorActiveRef = useRef(isInspectorActive);
  const onVerifySelectorRef = useRef(onVerifySelector);

  useEffect(() => {
    onElementSelectRef.current = onElementSelect;
    onVerifySelectorRef.current = onVerifySelector;
  }, [onElementSelect, onVerifySelector]);

  useEffect(() => {
    isInspectorActiveRef.current = isInspectorActive;
    
    // Clear highlights when disabled
    if (!isInspectorActive && iframeRef.current?.contentDocument) {
        const doc = iframeRef.current.contentDocument;
        const hover = doc.getElementById("_preview_hover_highlight");
        if (hover) hover.style.display = "none";
    }
  }, [isInspectorActive]);

  // --- REVERSE LOOKUP / PREVIEW LOGIC ---
  useEffect(() => {
    const mainIframe = iframeRef.current;
    if (!mainIframe || !mainIframe.contentDocument) return;
    const doc = mainIframe.contentDocument;

    // Clear previous preview highlights
    const old = doc.querySelectorAll('._ai_generated_highlight');
    old.forEach(el => {
        el.classList.remove('_ai_generated_highlight');
        (el as HTMLElement).style.outline = "";
        (el as HTMLElement).style.boxShadow = "";
    });

    if (!previewSelector || !previewSelector.selector) return;

    const { selector, type } = previewSelector;
    let foundElements: Element[] = [];

    try {
        if (type === 'xpath') {
            const iterator = doc.evaluate(selector, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < iterator.snapshotLength; i++) {
                const node = iterator.snapshotItem(i);
                if (node && node.nodeType === Node.ELEMENT_NODE) {
                    foundElements.push(node as Element);
                }
            }
        } else {
            foundElements = Array.from(doc.querySelectorAll(selector));
        }

        // Visualize matches
        foundElements.forEach(el => {
            el.classList.add('_ai_generated_highlight');
            (el as HTMLElement).style.outline = "2px dashed #a855f7"; // Purple dashed
            (el as HTMLElement).style.boxShadow = "0 0 0 4px rgba(168, 85, 247, 0.2)";
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

    } catch (e) {
        // Invalid selector, ignore
    }

  }, [previewSelector]);

  // --- VERIFICATION API ---
  useEffect(() => {
      if (iframeRef.current) {
          (iframeRef.current as any).__verifySelector = (selector: string, type: 'xpath' | 'css'): VerificationStatus => {
              const doc = iframeRef.current?.contentDocument;
              if (!doc) return { isValid: false, matchCount: 0, message: "No Document" };
              
              try {
                  let count = 0;
                  if (type === 'xpath') {
                      const res = doc.evaluate(selector, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                      count = res.snapshotLength;
                  } else {
                      const res = doc.querySelectorAll(selector);
                      count = res.length;
                  }
                  return { isValid: true, matchCount: count };
              } catch (e) {
                  return { isValid: false, matchCount: 0, message: (e as Error).message };
              }
          }
      }
  });


  useEffect(() => {
    const mainIframe = iframeRef.current;
    if (!mainIframe) return;

    const doc = mainIframe.contentDocument;
    if (!doc) return;

    const INJECTED_STYLES = `
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 16px; background-color: #fff; }
      #_preview_hover_highlight { position: absolute; background-color: rgba(59, 130, 246, 0.2); pointer-events: none; z-index: 2147483647; display: none; border: 1px solid rgba(59, 130, 246, 0.5); }
      #_preview_select_highlight { position: absolute; background-color: rgba(34, 197, 94, 0.3); border: 2px solid #16a34a; pointer-events: none; z-index: 2147483647; display: none; }
      
      /* Demo CSS */
      .card { border: 1px solid #e0e0e0; padding: 20px; margin-bottom: 16px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
      .input-group { margin-bottom: 15px; }
      .input-group label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 14px; }
      .input-group input { padding: 8px 12px; width: 100%; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
      .actions { margin-top: 20px; display: flex; align-items: center; gap: 12px; }
      .btn-primary { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    `;

    const setupDocument = (targetDoc: Document, iframeContext: string | null = null) => {
        if (targetDoc.getElementById("_preview_setup_done")) return;

        const style = targetDoc.createElement('style');
        style.textContent = INJECTED_STYLES;
        targetDoc.head.appendChild(style);

        const hoverDiv = targetDoc.createElement('div');
        hoverDiv.id = "_preview_hover_highlight";
        targetDoc.body.appendChild(hoverDiv);

        const selectDiv = targetDoc.createElement('div');
        selectDiv.id = "_preview_select_highlight";
        targetDoc.body.appendChild(selectDiv);

        const meta = targetDoc.createElement('meta');
        meta.id = "_preview_setup_done";
        targetDoc.head.appendChild(meta);

        const updateHighlight = (element: HTMLElement, highlightDiv: HTMLElement | null) => {
            if (!highlightDiv || !element) return;
            const rect = element.getBoundingClientRect();
            const scrollTop = targetDoc.documentElement.scrollTop || targetDoc.body.scrollTop;
            const scrollLeft = targetDoc.documentElement.scrollLeft || targetDoc.body.scrollLeft;
            highlightDiv.style.display = "block";
            highlightDiv.style.top = `${rect.top + scrollTop}px`;
            highlightDiv.style.left = `${rect.left + scrollLeft}px`;
            highlightDiv.style.width = `${rect.width}px`;
            highlightDiv.style.height = `${rect.height}px`;
        };

        const handleMouseOver = (e: Event) => {
            if (!isInspectorActiveRef.current) return;
            e.stopPropagation();
            const target = e.target as HTMLElement;
            if (target.id.startsWith("_preview_") || target === targetDoc.body) return;
            updateHighlight(target, hoverDiv);
        };

        // Helper: Calculate nth-of-type index
        const calculateIndex = (el: Element): number => {
            let index = 1;
            let sib = el.previousElementSibling;
            while(sib) {
                if(sib.tagName === el.tagName) index++;
                sib = sib.previousElementSibling;
            }
            return index;
        };

        // Helper: Get Ancestor Chain
        const getAncestors = (el: HTMLElement): AncestorNode[] => {
            const ancestors: AncestorNode[] = [];
            let current = el.parentElement;
            // Traverse up to 5 levels or until body
            let depth = 0;
            while (current && current !== targetDoc.body && current.tagName !== 'HTML' && depth < 5) {
                ancestors.push({
                    tagName: current.tagName.toLowerCase(),
                    id: current.id || '',
                    className: current.className || '',
                    index: calculateIndex(current)
                });
                current = current.parentElement;
                depth++;
            }
            return ancestors;
        };

        const handleClick = (e: Event) => {
            if (!isInspectorActiveRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            let target = e.target as HTMLElement;
            if (target.nodeType === Node.TEXT_NODE && target.parentElement) target = target.parentElement;
            if (!target || target.id.startsWith("_preview_") || target === targetDoc.body) return;

            updateHighlight(target, selectDiv);

            const attributes: Record<string, string> = {};
            if (target.hasAttributes()) {
                for (let i = 0; i < target.attributes.length; i++) {
                    const attr = target.attributes[i];
                    attributes[attr.name] = attr.value;
                }
            }

            // Calculate element index (nth-of-type)
            const elementIndex = calculateIndex(target);

            // Calculate global text index (nth-match-by-text)
            let byTextIndex = 1;
            let totalByText = 1;

            try {
                const targetText = target.innerText?.trim() || "";
                if (targetText) {
                    const allByTag = Array.from(targetDoc.getElementsByTagName(target.tagName));
                    const textMatches = allByTag.filter(el => (el as HTMLElement).innerText?.trim() === targetText);
                    byTextIndex = textMatches.indexOf(target) + 1;
                    totalByText = textMatches.length;
                }
            } catch(e) {
                console.error("Error calculating text index", e);
            }

            // Collect Sibling Samples for Context
            const siblingsSample: string[] = [];
            let sib = target.previousElementSibling;
            if(sib) siblingsSample.push(sib.outerHTML.slice(0, 150));
            sib = target.nextElementSibling;
            if(sib) siblingsSample.push(sib.outerHTML.slice(0, 150));

            const info: TargetElementInfo = {
                tagName: target.tagName.toLowerCase(),
                outerHTML: target.outerHTML,
                innerText: (target.innerText || "").slice(0, 200),
                attributes: attributes,
                parentOuterHTML: target.parentElement?.outerHTML.slice(0, 500) || "",
                iframeContext: iframeContext,
                elementIndex: elementIndex,
                siblingsSample: siblingsSample,
                ancestors: getAncestors(target),
                matchIndices: {
                    byText: byTextIndex,
                    totalByText: totalByText
                }
            };

            onElementSelectRef.current(info);
        };

        targetDoc.addEventListener("mouseover", handleMouseOver);
        targetDoc.addEventListener("click", handleClick);

        // Recursion for iframes
        targetDoc.querySelectorAll('iframe').forEach(iframe => {
             iframe.addEventListener('load', () => {
                try {
                    if (iframe.contentDocument) setupDocument(iframe.contentDocument, iframe.outerHTML);
                } catch(e) {}
             });
             // Try immediately if already loaded
             try {
                 if (iframe.contentDocument) setupDocument(iframe.contentDocument, iframe.outerHTML);
             } catch(e) {}
        });
    };

    doc.open();
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => setupDocument(doc, null), 50);

  }, [htmlContent]); 

  return (
    <iframe
      ref={iframeRef}
      title="DOM Preview Sandbox"
      className="w-full h-full border-none block bg-white"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms" 
    />
  );
};
