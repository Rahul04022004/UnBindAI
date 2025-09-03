# Advanced PDF Text Chunking Implementation

This implementation provides a sophisticated text chunking system for PDF processing that respects semantic boundaries and document structure.

## Overview

The new chunking system replaces the simple character-based splitting with intelligent semantic chunking that:

1. **Respects Document Structure**: Splits on paragraph boundaries, keeps headings with their content
2. **Preserves Lists and Tables**: Maintains list and table integrity when possible
3. **Smart Overlap**: Only applies overlap when breaking large sections, not between natural paragraphs
4. **Fallback Support**: Works with or without external APIs like Microsoft Docling

## Files Added/Modified

### New Files
- `services/pdfProcessingService.ts` - Main PDF processing service with semantic chunking
- `test-chunking.ts` - Test file demonstrating the chunking functionality
- `CHUNKING_GUIDE.md` - This documentation

### Modified Files
- `services/analysisService.ts` - Updated with new chunking functions and enhanced analysis

## Key Features

### 1. Semantic Section Detection

The system identifies different types of content:

- **Headings**: Numbered sections (1., 1.1, 1.1.1), Roman numerals (I., II.), lettered sections (A., B.), all-caps titles, and keyword-based headings
- **Lists**: Bullet points, numbered lists, lettered lists, and parenthesized lists
- **Tables**: Multi-column data with consistent spacing
- **Paragraphs**: Regular text content

### 2. Intelligent Chunking Strategy

```typescript
// Basic usage
const chunks = await processPdfText(text, {
  chunkSize: 4000,
  overlap: 300,
  useDocling: false
});
```

The chunking process:
1. **Normalizes** text (handles line endings, whitespace)
2. **Identifies** semantic sections (paragraphs, headings, lists, tables)
3. **Groups** sections into chunks respecting size limits
4. **Applies** overlap only when breaking large sections
5. **Preserves** document structure and context

### 3. Microsoft Docling Integration (Optional)

For advanced semantic parsing, you can integrate Microsoft Docling:

```typescript
const chunks = await processPdfText(text, {
  chunkSize: 4000,
  overlap: 300,
  useDocling: true,
  doclingApiUrl: 'https://your-docling-api.com',
  doclingApiKey: 'your-api-key'
});
```

**Note**: Docling requires a Python backend service. The integration expects a REST API endpoint that accepts PDF text and returns structured sections.

### 4. Enhanced Analysis Functions

Two analysis functions are now available:

```typescript
// Original function (now uses improved chunking)
const result1 = await analyzeContract(text, role, onProgress);

// New enhanced function with full options
const result2 = await analyzeContractWithSemanticChunking(text, role, onProgress, {
  chunkSize: 4000,
  overlap: 300,
  useDocling: false
});
```

## Usage Examples

### Basic Semantic Chunking

```typescript
import { processPdfText } from './services/pdfProcessingService';

const chunks = await processPdfText(pdfText, {
  chunkSize: 4000,
  overlap: 300
});
```

### With Custom Parameters

```typescript
const chunks = await processPdfText(pdfText, {
  chunkSize: 2000,    // Smaller chunks
  overlap: 200,       // Less overlap
  useDocling: false   // Use regex fallback
});
```

### Testing the Implementation

Run the test file to see the chunking in action:

```bash
npx tsx test-chunking.ts
```

This will demonstrate:
- Different chunk sizes and their effects
- How semantic boundaries are preserved
- Quality analysis of chunk structure

## Chunking Quality Improvements

### Before (Simple Character Splitting)
```
Chunk 1: "This agreement is entered into between Company A and Company B. 2. TERMS AND CONDITIONS The following terms and conditions shall apply: 2.1 Payment Terms Payment shall be made within 30 days of invoice receipt. Late payments will incur a 1.5% monthly interest charge. 2.2 Delivery Schedule - First delivery: Within 2 weeks of contract signing - Second delivery: Within 4 weeks of contract signing - Final delivery: Within 6 weeks of contract signing 2.3 Quality Standards All products must meet the following specifications: a) Material grade: 316L stainless steel b) Surface finish: Ra 0.8 μm maximum c) Dimensional tolerance: ±0.1mm 3. LIABILITY AND INDEMNIFICATION Neither party shall be liable for indirect damages arising from this agreement. Each party agrees to indemnify the other against claims resulting from their own negligence. 4. TERMINATION This agreement may be terminated by either party with 30 days written notice. Upon termination, all outstanding obligations must be fulfilled. 5. GOVERNING LAW This agreement shall be governed by the laws of the State of California. SCHEDULE A - TECHNICAL SPECIFICATIONS Item    Description    Quantity    Unit Price 1       Component A    100         $25.00 2       Component B    50          $45.00 3       Component C    25          $85.00 APPENDIX B - DELIVERY LOCATIONS Location 1: 123 Main Street, San Francisco, CA 94105 Location 2: 456 Oak Avenue, Los Angeles, CA 90210 Location 3: 789 Pine Road, San Diego, CA 92101"
```

### After (Semantic Chunking)
```
Chunk 1: "CONTRACT AGREEMENT

1. PARTIES
This agreement is entered into between Company A and Company B.

2. TERMS AND CONDITIONS
The following terms and conditions shall apply:

2.1 Payment Terms
Payment shall be made within 30 days of invoice receipt. Late payments will incur a 1.5% monthly interest charge.

2.2 Delivery Schedule
- First delivery: Within 2 weeks of contract signing
- Second delivery: Within 4 weeks of contract signing
- Final delivery: Within 6 weeks of contract signing"

Chunk 2: "2.2 Delivery Schedule
- First delivery: Within 2 weeks of contract signing
- Second delivery: Within 4 weeks of contract signing
- Final delivery: Within 6 weeks of contract signing

2.3 Quality Standards
All products must meet the following specifications:
a) Material grade: 316L stainless steel
b) Surface finish: Ra 0.8 μm maximum
c) Dimensional tolerance: ±0.1mm

3. LIABILITY AND INDEMNIFICATION
Neither party shall be liable for indirect damages arising from this agreement. Each party agrees to indemnify the other against claims resulting from their own negligence."
```

## Benefits

1. **Better Context Preservation**: Headings stay with their content
2. **Improved LLM Performance**: More coherent chunks lead to better analysis
3. **Reduced Information Loss**: Overlap only where needed
4. **Flexible Configuration**: Adjustable chunk sizes and overlap
5. **Fallback Support**: Works without external dependencies
6. **Future-Proof**: Ready for advanced parsing services like Docling

## Integration with Existing Code

The new chunking system is backward compatible. Existing code using `analyzeContract` will automatically benefit from the improved chunking without any changes required.

For new implementations or when you want more control, use `analyzeContractWithSemanticChunking` with custom options.

## Performance Considerations

- **Memory Usage**: The semantic parsing is more memory-intensive than simple splitting
- **Processing Time**: Initial parsing takes slightly longer but results in better chunks
- **Chunk Count**: May produce more chunks than simple splitting due to better boundary detection
- **Quality vs Speed**: The trade-off favors quality for better LLM analysis results

## Future Enhancements

1. **Table Detection**: Improved table structure recognition
2. **List Hierarchy**: Better handling of nested lists
3. **Document Type Detection**: Specialized chunking for different document types
4. **Language Support**: Multi-language heading and structure detection
5. **Custom Patterns**: User-defined semantic boundary patterns
