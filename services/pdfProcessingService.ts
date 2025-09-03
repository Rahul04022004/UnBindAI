/**
 * Advanced PDF Processing Service with Semantic Chunking
 * Supports both Microsoft Docling integration and regex-based fallback
 */

// Types for PDF processing
export interface PdfProcessingOptions {
  chunkSize?: number;
  overlap?: number;
  useDocling?: boolean;
  doclingApiUrl?: string;
  doclingApiKey?: string;
}

export interface SemanticSection {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'other';
  content: string;
  level?: number; // For hierarchical headings
  metadata?: Record<string, any>;
}

/**
 * Main PDF text processing function with semantic chunking
 * This is the primary function that should be used for PDF text processing
 */
export const processPdfText = async (
  text: string,
  options: PdfProcessingOptions = {}
): Promise<string[]> => {
  const {
    chunkSize = 4000,
    overlap = 300,
    useDocling = false,
    doclingApiUrl,
    doclingApiKey
  } = options;

  try {
    let semanticSections: SemanticSection[];

    if (useDocling && doclingApiUrl && doclingApiKey) {
      // Use Microsoft Docling for semantic parsing
      semanticSections = await parseWithDocling(text, doclingApiUrl, doclingApiKey);
    } else {
      // Use regex-based fallback
      semanticSections = parseWithRegex(text);
    }

    // Convert semantic sections to text chunks
    return convertSectionsToChunks(semanticSections, chunkSize, overlap);
  } catch (error) {
    console.warn('Advanced parsing failed, falling back to basic chunking:', error);
    // Fallback to basic chunking if advanced parsing fails
    return basicChunking(text, chunkSize, overlap);
  }
};

/**
 * Microsoft Docling integration for semantic PDF parsing
 * Note: This requires a Docling API endpoint (typically a Python backend)
 */
const parseWithDocling = async (
  text: string,
  apiUrl: string,
  apiKey: string
): Promise<SemanticSection[]> => {
  try {
    const response = await fetch(`${apiUrl}/parse-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text: text,
        options: {
          extract_tables: true,
          extract_lists: true,
          preserve_structure: true,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Docling API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Convert Docling output to our SemanticSection format
    return result.sections?.map((section: any) => ({
      type: mapDoclingType(section.type),
      content: section.text,
      level: section.level,
      metadata: section.metadata || {}
    })) || [];
  } catch (error) {
    console.error('Docling parsing failed:', error);
    throw error;
  }
};

/**
 * Maps Docling section types to our internal types
 */
const mapDoclingType = (doclingType: string): SemanticSection['type'] => {
  const typeMap: Record<string, SemanticSection['type']> = {
    'heading': 'heading',
    'title': 'heading',
    'paragraph': 'paragraph',
    'list': 'list',
    'table': 'table',
    'text': 'paragraph',
  };
  return typeMap[doclingType] || 'other';
};

/**
 * Regex-based semantic parsing fallback
 * This is the same logic as in the main chunkText function but returns structured data
 */
const parseWithRegex = (text: string): SemanticSection[] => {
  // Normalize the text
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const sections: SemanticSection[] = [];
  const paragraphs = normalizedText.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (isLikelyHeading(trimmed)) {
      sections.push({
        type: 'heading',
        content: trimmed,
        level: getHeadingLevel(trimmed),
      });
    } else if (isLikelyList(trimmed)) {
      sections.push({
        type: 'list',
        content: trimmed,
      });
    } else if (isLikelyTable(trimmed)) {
      sections.push({
        type: 'table',
        content: trimmed,
      });
    } else {
      sections.push({
        type: 'paragraph',
        content: trimmed,
      });
    }
  }

  return sections;
};

/**
 * Determines if text is likely a heading (same logic as main function)
 */
const isLikelyHeading = (text: string): boolean => {
  const lines = text.split('\n');
  if (lines.length > 3) return false;

  const firstLine = lines[0].trim();

  return (
    /^\d+(\.\d+)*\.?\s/.test(firstLine) ||
    /^[IVX]+\.?\s/.test(firstLine) ||
    /^[A-Z]\.?\s/.test(firstLine) ||
    (firstLine === firstLine.toUpperCase() && firstLine.length < 100 && firstLine.length > 3) ||
    /^(section|chapter|part|article|clause|schedule|appendix|exhibit)\s+\d+/i.test(firstLine) ||
    (firstLine.length < 80 && firstLine.endsWith(':')) ||
    (firstLine.length < 60 && lines.length === 1)
  );
};

/**
 * Determines heading level based on numbering pattern
 */
const getHeadingLevel = (heading: string): number => {
  const firstLine = heading.split('\n')[0].trim();
  
  // Numbered headings (1., 1.1., 1.1.1., etc.)
  const numberedMatch = firstLine.match(/^(\d+(?:\.\d+)*)\.?\s/);
  if (numberedMatch) {
    return numberedMatch[1].split('.').length;
  }
  
  // Roman numerals
  if (/^[IVX]+\.?\s/.test(firstLine)) {
    return 1;
  }
  
  // Lettered sections
  if (/^[A-Z]\.?\s/.test(firstLine)) {
    return 2;
  }
  
  // Default level
  return 1;
};

/**
 * Determines if text is likely a list
 */
const isLikelyList = (text: string): boolean => {
  const lines = text.split('\n');
  const listPatterns = [
    /^\s*[-•*]\s/,
    /^\s*\d+\.\s/,
    /^\s*[a-z]\)\s/,
    /^\s*\([a-z]\)\s/,
  ];
  
  // Check if most lines match list patterns
  const listLines = lines.filter(line => 
    listPatterns.some(pattern => pattern.test(line))
  );
  
  return listLines.length > lines.length * 0.5;
};

/**
 * Determines if text is likely a table
 */
const isLikelyTable = (text: string): boolean => {
  const lines = text.split('\n');
  
  // Look for table indicators
  const hasMultipleColumns = lines.some(line => {
    const parts = line.split(/\s{2,}|\t/);
    return parts.length >= 3;
  });
  
  const hasConsistentSpacing = lines.filter(line => line.trim()).length > 2;
  
  return hasMultipleColumns && hasConsistentSpacing;
};

/**
 * Converts semantic sections to text chunks with proper overlap
 */
const convertSectionsToChunks = (
  sections: SemanticSection[],
  chunkSize: number,
  overlap: number
): string[] => {
  const chunks: string[] = [];
  let currentChunk = '';
  let currentSize = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionSize = section.content.length;

    // If adding this section would exceed chunk size
    if (currentSize + sectionSize > chunkSize && currentChunk) {
      // Save current chunk
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap from previous chunk
      const overlapText = getOverlapText(currentChunk, overlap);
      currentChunk = overlapText + (overlapText ? '\n\n' : '') + section.content;
      currentSize = currentChunk.length;
    } else {
      // Add section to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + section.content;
      } else {
        currentChunk = section.content;
      }
      currentSize = currentChunk.length;
    }

    // If a single section is too large, split it further
    if (sectionSize > chunkSize) {
      const subChunks = splitLargeSection(section.content, chunkSize, overlap);
      // Replace the current chunk with the first sub-chunk
      currentChunk = subChunks[0];
      currentSize = currentChunk.length;

      // Add remaining sub-chunks
      for (let j = 1; j < subChunks.length; j++) {
        chunks.push(subChunks[j]);
      }
    }
  }

  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

/**
 * Extracts overlap text from the end of a chunk
 */
const getOverlapText = (text: string, overlapSize: number): string => {
  if (text.length <= overlapSize) return text;

  // Try to find a good break point within the overlap area
  const overlapArea = text.slice(-overlapSize * 1.5);
  const lastSentence = overlapArea.match(/[.!?]\s+[A-Z]/);

  if (lastSentence) {
    const sentenceEnd = text.lastIndexOf(lastSentence[0]) + 1;
    return text.slice(sentenceEnd).trim();
  }

  // Fallback: just take the last overlapSize characters
  return text.slice(-overlapSize);
};

/**
 * Splits a large section into smaller chunks with overlap
 */
const splitLargeSection = (section: string, chunkSize: number, overlap: number): string[] => {
  const chunks: string[] = [];
  let start = 0;

  while (start < section.length) {
    let end = start + chunkSize;

    // Try to find a good break point near the end
    if (end < section.length) {
      const searchArea = section.slice(start + chunkSize - overlap, end + overlap);
      const breakPoints = [
        searchArea.lastIndexOf('\n\n'),
        searchArea.lastIndexOf('\n'),
        searchArea.lastIndexOf('. '),
        searchArea.lastIndexOf(', '),
      ].filter(pos => pos !== -1);

      if (breakPoints.length > 0) {
        const bestBreak = Math.max(...breakPoints);
        end = start + chunkSize - overlap + bestBreak;
      }
    }

    const chunk = section.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    start = end - overlap;
  }

  return chunks;
};

/**
 * Basic chunking fallback (original simple approach)
 */
const basicChunking = (text: string, chunkSize: number, overlap: number): string[] => {
  const chunks: string[] = [];
  if (text.length <= chunkSize) {
    return [text];
  }
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
};

/**
 * Enhanced PDF text extraction with better structure preservation
 * This can be used to improve the PDF text extraction in App.tsx
 */
export const extractPdfTextWithStructure = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target?.result) return reject(new Error("Failed to read PDF"));
      try {
        const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument(typedArray).promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Enhanced text extraction with better spacing
          const pageText = textContent.items
            .map((item: any) => {
              // Preserve spacing and line breaks
              if (item.hasEOL) {
                return item.str + '\n';
              }
              return item.str;
            })
            .join(' ')
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
          
          fullText += pageText + "\n\n";
        }
        
        resolve(fullText);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};
