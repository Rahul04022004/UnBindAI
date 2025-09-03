/**
 * PDF to Markdown Conversion Service
 * Converts PDF text to Markdown format for better semantic parsing
 */

export interface MarkdownConversionOptions {
  preserveStructure?: boolean;
  detectHeadings?: boolean;
  detectLists?: boolean;
  detectTables?: boolean;
}

/**
 * Converts PDF text to Markdown format for better parsing
 */
export const convertPdfToMarkdown = (
  pdfText: string,
  options: MarkdownConversionOptions = {}
): string => {
  const {
    preserveStructure = true,
    detectHeadings = true,
    detectLists = true,
    detectTables = true
  } = options;

  let markdown = pdfText;

  // Step 1: Normalize line endings and whitespace
  markdown = markdown
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Step 2: Detect and convert headings
  if (detectHeadings) {
    markdown = convertHeadingsToMarkdown(markdown);
  }

  // Step 3: Detect and convert lists
  if (detectLists) {
    markdown = convertListsToMarkdown(markdown);
  }

  // Step 4: Detect and convert tables
  if (detectTables) {
    markdown = convertTablesToMarkdown(markdown);
  }

  // Step 5: Clean up and format paragraphs
  markdown = formatParagraphs(markdown);

  return markdown;
};

/**
 * Converts various heading patterns to Markdown headings
 */
const convertHeadingsToMarkdown = (text: string): string => {
  const lines = text.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      result.push('');
      continue;
    }

    // Detect different heading patterns
    const isHeading = detectHeadingPattern(line);
    
    if (isHeading) {
      const level = getHeadingLevel(line);
      const headingText = cleanHeadingText(line);
      result.push(`${'#'.repeat(level)} ${headingText}`);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
};

/**
 * Detects if a line is a heading based on various patterns
 */
const detectHeadingPattern = (line: string): boolean => {
  // Numbered sections (1., 1.1, 1.1.1, etc.)
  if (/^\d+(\.\d+)*\.?\s/.test(line)) return true;
  
  // Roman numerals (I., II., III., etc.)
  if (/^[IVX]+\.?\s/.test(line)) return true;
  
  // Lettered sections (A., B., C., etc.)
  if (/^[A-Z]\.?\s/.test(line)) return true;
  
  // All caps (but not too long)
  if (line === line.toUpperCase() && line.length < 100 && line.length > 3) return true;
  
  // Common heading keywords
  if (/^(section|chapter|part|article|clause|schedule|appendix|exhibit)\s+\d+/i.test(line)) return true;
  
  // Short lines that end with colon
  if (line.length < 80 && line.endsWith(':')) return true;
  
  // Lines that are significantly shorter than average paragraph length
  if (line.length < 60 && !line.includes('.')) return true;
  
  return false;
};

/**
 * Determines heading level based on numbering pattern
 */
const getHeadingLevel = (heading: string): number => {
  // Numbered headings (1., 1.1., 1.1.1., etc.)
  const numberedMatch = heading.match(/^(\d+(?:\.\d+)*)\.?\s/);
  if (numberedMatch) {
    return Math.min(numberedMatch[1].split('.').length + 1, 6);
  }
  
  // Roman numerals
  if (/^[IVX]+\.?\s/.test(heading)) return 2;
  
  // Lettered sections
  if (/^[A-Z]\.?\s/.test(heading)) return 3;
  
  // All caps or keyword headings
  if (heading === heading.toUpperCase() || /^(section|chapter|part|article|clause|schedule|appendix|exhibit)/i.test(heading)) {
    return 1;
  }
  
  // Default level
  return 2;
};

/**
 * Cleans heading text by removing numbering and formatting
 */
const cleanHeadingText = (heading: string): string => {
  return heading
    .replace(/^\d+(\.\d+)*\.?\s*/, '') // Remove numbered prefixes
    .replace(/^[IVX]+\.?\s*/, '') // Remove Roman numerals
    .replace(/^[A-Z]\.?\s*/, '') // Remove lettered prefixes
    .replace(/^(section|chapter|part|article|clause|schedule|appendix|exhibit)\s+\d+/i, '') // Remove keyword prefixes
    .trim();
};

/**
 * Converts list patterns to Markdown lists
 */
const convertListsToMarkdown = (text: string): string => {
  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType: 'bullet' | 'numbered' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) {
      if (inList) {
        result.push(''); // Add spacing after list
        inList = false;
        listType = null;
      }
      result.push('');
      continue;
    }

    // Detect list patterns
    const listMatch = detectListPattern(trimmed);
    
    if (listMatch) {
      if (!inList || listMatch.type !== listType) {
        if (inList) {
          result.push(''); // Add spacing between different list types
        }
        inList = true;
        listType = listMatch.type;
      }
      
      const indent = '  '.repeat(listMatch.level);
      const content = trimmed.replace(listMatch.pattern, '').trim();
      
      if (listMatch.type === 'bullet') {
        result.push(`${indent}- ${content}`);
      } else {
        result.push(`${indent}${listMatch.number}. ${content}`);
      }
    } else {
      if (inList) {
        result.push(''); // End list
        inList = false;
        listType = null;
      }
      result.push(line);
    }
  }

  return result.join('\n');
};

/**
 * Detects list patterns in text
 */
const detectListPattern = (line: string): { type: 'bullet' | 'numbered'; pattern: RegExp; level: number; number?: string } | null => {
  // Bullet points
  const bulletMatch = line.match(/^(\s*)([-•*])\s/);
  if (bulletMatch) {
    return {
      type: 'bullet',
      pattern: new RegExp(`^${bulletMatch[1]}[${bulletMatch[2]}]\\s`),
      level: Math.floor(bulletMatch[1].length / 2)
    };
  }
  
  // Numbered lists
  const numberedMatch = line.match(/^(\s*)(\d+)\.\s/);
  if (numberedMatch) {
    return {
      type: 'numbered',
      pattern: new RegExp(`^${numberedMatch[1]}${numberedMatch[2]}\\.\\s`),
      level: Math.floor(numberedMatch[1].length / 2),
      number: numberedMatch[2]
    };
  }
  
  // Lettered lists
  const letteredMatch = line.match(/^(\s*)([a-z])\)\s/);
  if (letteredMatch) {
    return {
      type: 'numbered',
      pattern: new RegExp(`^${letteredMatch[1]}${letteredMatch[2]}\\)\\s`),
      level: Math.floor(letteredMatch[1].length / 2),
      number: letteredMatch[2]
    };
  }
  
  return null;
};

/**
 * Converts table-like structures to Markdown tables
 */
const convertTablesToMarkdown = (text: string): string => {
  const lines = text.split('\n');
  const result: string[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      if (inTable && tableLines.length > 0) {
        result.push(convertTableToMarkdown(tableLines));
        tableLines = [];
        inTable = false;
      }
      result.push('');
      continue;
    }

    // Detect table-like structure (multiple columns separated by spaces or tabs)
    const columns = line.split(/\s{2,}|\t/).filter(col => col.trim());
    
    if (columns.length >= 3) {
      if (!inTable) {
        inTable = true;
      }
      tableLines.push(line);
    } else {
      if (inTable && tableLines.length > 0) {
        result.push(convertTableToMarkdown(tableLines));
        tableLines = [];
        inTable = false;
      }
      result.push(line);
    }
  }

  // Handle table at end of text
  if (inTable && tableLines.length > 0) {
    result.push(convertTableToMarkdown(tableLines));
  }

  return result.join('\n');
};

/**
 * Converts table lines to Markdown table format
 */
const convertTableToMarkdown = (tableLines: string[]): string => {
  if (tableLines.length === 0) return '';

  // Parse table data
  const rows = tableLines.map(line => 
    line.split(/\s{2,}|\t/).map(cell => cell.trim()).filter(cell => cell)
  );

  if (rows.length === 0) return '';

  const maxCols = Math.max(...rows.map(row => row.length));
  
  // Create header row
  const header = rows[0];
  const headerRow = '| ' + header.join(' | ') + ' |';
  
  // Create separator row
  const separator = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
  
  // Create data rows
  const dataRows = rows.slice(1).map(row => {
    const paddedRow = [...row, ...Array(maxCols - row.length).fill('')];
    return '| ' + paddedRow.join(' | ') + ' |';
  });

  return [headerRow, separator, ...dataRows].join('\n');
};

/**
 * Formats paragraphs with proper spacing
 */
const formatParagraphs = (text: string): string => {
  return text
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Limit to double newlines
    .trim();
};

/**
 * Enhanced PDF text extraction with Markdown conversion
 */
export const extractPdfAsMarkdown = async (file: File): Promise<string> => {
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
        
        // Convert to Markdown
        const markdown = convertPdfToMarkdown(fullText);
        resolve(markdown);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};
