import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Code, MousePointer2 } from 'lucide-react';
import { TargetElementInfo, AncestorNode } from '../types';

interface DomTreeProps {
  htmlContent: string;
  onElementSelect: (info: TargetElementInfo) => void;
  onHoverElement: (selector: string | null) => void;
}

// Helper to generate a unique selector for the tree node to highlight it in Preview
const getUniqueSelector = (node: Element): string => {
  if (node.tagName.toLowerCase() === 'body') return 'body';
  
  let path = '';
  let current = node;
  
  while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() !== 'body' && current.tagName.toLowerCase() !== 'html') {
    let index = 1;
    let sibling = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    const tagName = current.tagName.toLowerCase();
    path = ` > ${tagName}:nth-of-type(${index})` + path;
    current = current.parentElement as Element;
  }
  
  return 'body' + path;
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
const getAncestors = (el: Element): AncestorNode[] => {
    const ancestors: AncestorNode[] = [];
    let current = el.parentElement;
    let depth = 0;
    while (current && current.tagName.toLowerCase() !== 'body' && current.tagName.toLowerCase() !== 'html' && depth < 5) {
        ancestors.push({
            tagName: current.tagName.toLowerCase(),
            id: current.getAttribute('id') || '',
            className: current.getAttribute('class') || '',
            index: calculateIndex(current)
        });
        current = current.parentElement;
        depth++;
    }
    return ancestors;
};

const TreeNode: React.FC<{
  node: Node;
  depth: number;
  onSelect: (info: TargetElementInfo) => void;
  onHover: (selector: string | null) => void;
  rootDoc?: Document; // Pass root doc for global calculations
}> = ({ node, depth, onSelect, onHover, rootDoc }) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand top levels

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    return (
      <div 
        className="pl-4 py-0.5 text-gray-500 font-mono text-xs hover:bg-gray-800 rounded truncate cursor-default"
        style={{ paddingLeft: `${depth * 16 + 20}px` }}
      >
        "{text.slice(0, 50)}{text.length > 50 ? '...' : ''}"
      </div>
    );
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const hasChildren = element.childNodes.length > 0;
  const attributes = Array.from(element.attributes);
  
  const idAttr = element.getAttribute('id');
  const classAttr = element.getAttribute('class');

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    const selector = getUniqueSelector(element);
    onHover(selector);
  };

  const handleMouseLeave = () => {
    onHover(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Construct TargetElementInfo
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach(attr => {
        attrs[attr.name] = attr.value;
    });

    // Calculate element index (nth-of-type)
    const elementIndex = calculateIndex(element);

    // Calculate global text index (nth-match-by-text)
    let byTextIndex = 1;
    let totalByText = 1;

    if (rootDoc) {
        const targetText = element.textContent?.trim() || "";
        if (targetText) {
            const allByTag = Array.from(rootDoc.getElementsByTagName(tagName));
            const textMatches = allByTag.filter((el: Element) => (el.textContent?.trim() || '') === targetText);
            byTextIndex = textMatches.indexOf(element) + 1;
            totalByText = textMatches.length;
        }
    }

    // Collect Sibling Samples
    const siblingsSample: string[] = [];
    let sib = element.previousElementSibling;
    if(sib) siblingsSample.push(sib.outerHTML.slice(0, 150));
    sib = element.nextElementSibling;
    if(sib) siblingsSample.push(sib.outerHTML.slice(0, 150));

    const info: TargetElementInfo = {
        tagName: tagName,
        outerHTML: element.outerHTML,
        innerText: (element.textContent || "").slice(0, 200),
        attributes: attrs,
        parentOuterHTML: element.parentElement?.outerHTML.slice(0, 500) || "",
        iframeContext: null, // TODO: support iframe recursion in tree later
        elementIndex: elementIndex,
        siblingsSample: siblingsSample,
        ancestors: getAncestors(element),
        matchIndices: {
            byText: byTextIndex,
            totalByText: totalByText
        }
    };
    onSelect(info);
  };

  return (
    <div className="select-none">
      <div 
        className="flex items-center py-0.5 hover:bg-gray-800 rounded cursor-pointer group pr-2"
        style={{ paddingLeft: `${depth * 12}px` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <button 
          className={`w-4 h-4 flex items-center justify-center mr-0.5 text-gray-500 hover:text-white transition-colors ${!hasChildren ? 'invisible' : ''}`}
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        <div className="flex items-center font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="text-purple-400">{tagName}</span>
          
          {idAttr && (
            <span className="ml-1.5 text-yellow-300" title={`id="${idAttr}"`}>#{idAttr}</span>
          )}
          
          {classAttr && (
            <span className="ml-1.5 text-blue-300 truncate max-w-[150px]" title={`class="${classAttr}"`}>.{classAttr.replace(/\s+/g, '.')}</span>
          )}
          
          {!idAttr && !classAttr && attributes.length > 0 && (
             <span className="ml-1.5 text-amber-200 opacity-60">[{attributes[0].name}]</span>
          )}
        </div>
        
        {/* Hover Action Icon */}
        <div className="ml-auto opacity-0 group-hover:opacity-100 pl-2">
            <MousePointer2 className="w-3 h-3 text-gray-400" />
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {Array.from(element.childNodes).map((child, i) => (
            <TreeNode 
              key={i} 
              node={child} 
              depth={depth + 1} 
              onSelect={onSelect}
              onHover={onHover}
              rootDoc={rootDoc}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DomTree: React.FC<DomTreeProps> = ({ htmlContent, onElementSelect, onHoverElement }) => {
  const { rootNodes, doc } = useMemo(() => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        return { rootNodes: Array.from(doc.body.childNodes), doc: doc };
    } catch (e) {
        return { rootNodes: [], doc: undefined };
    }
  }, [htmlContent]);

  return (
    <div className="h-full overflow-auto bg-gray-900 text-gray-300 p-2">
      {rootNodes.map((node, i) => (
        <TreeNode 
            key={i} 
            node={node} 
            depth={0} 
            onSelect={onElementSelect}
            onHover={onHoverElement}
            rootDoc={doc}
        />
      ))}
      
      {rootNodes.length === 0 && (
          <div className="text-center text-gray-500 mt-10 text-xs">
              Empty DOM
          </div>
      )}
    </div>
  );
};