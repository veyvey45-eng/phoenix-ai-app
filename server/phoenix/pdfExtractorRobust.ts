/**
 * Robust PDF Text Extraction Module
 * Multiple extraction methods with fallbacks for maximum compatibility
 */

import { PDFParse } from 'pdf-parse';

export interface ExtractedPDFContent {
  text: string;
  pages: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
  pageTexts: string[];
  extractionMethod: string;
  confidence: number;
}

/**
 * Method 1: pdf-parse v2 - Primary extraction method
 */
async function extractWithPdfParse(buffer: Buffer): Promise<ExtractedPDFContent | null> {
  try {
    console.log('[PDFExtractor] Trying pdf-parse v2...');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    
    if (result.text && result.text.trim().length > 0) {
      console.log('[PDFExtractor] pdf-parse v2 success:', result.text.length, 'chars');
      return {
        text: result.text.trim(),
        pages: result.pages?.length || 1,
        metadata: {},
        pageTexts: [result.text.trim()],
        extractionMethod: 'pdf-parse-v2',
        confidence: 0.95
      };
    }
    return null;
  } catch (error) {
    console.error('[PDFExtractor] pdf-parse v2 failed:', error);
    return null;
  }
}

/**
 * Method 2: Basic text extraction from PDF binary
 * Extracts readable ASCII text from the PDF buffer
 */
function extractBasicText(buffer: Buffer): ExtractedPDFContent | null {
  try {
    console.log('[PDFExtractor] Trying basic text extraction...');
    const bufferStr = buffer.toString('latin1');
    
    // Extract text between stream/endstream tags
    const streamMatches = bufferStr.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g);
    let extractedText = '';
    
    if (streamMatches) {
      for (const match of streamMatches) {
        // Clean up the stream content
        const content = match
          .replace(/stream[\r\n]+/, '')
          .replace(/[\r\n]+endstream/, '')
          .replace(/[^\x20-\x7E\n\r]/g, ' ')
          .split('\n')
          .filter(line => line.trim().length > 3)
          .join('\n');
        
        if (content.trim().length > 0) {
          extractedText += content + '\n';
        }
      }
    }
    
    // Also try to extract text from BT/ET blocks (text objects)
    const textMatches = bufferStr.match(/BT[\s\S]*?ET/g);
    if (textMatches) {
      for (const match of textMatches) {
        // Extract text from Tj and TJ operators
        const tjMatches = match.match(/\(([^)]+)\)\s*Tj/g);
        if (tjMatches) {
          for (const tj of tjMatches) {
            const text = tj.replace(/\(([^)]+)\)\s*Tj/, '$1');
            if (text.length > 0) {
              extractedText += text + ' ';
            }
          }
        }
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\n\r]/g, '')
      .trim();
    
    if (extractedText.length > 50) {
      console.log('[PDFExtractor] Basic extraction success:', extractedText.length, 'chars');
      return {
        text: extractedText,
        pages: 1,
        metadata: {},
        pageTexts: [extractedText],
        extractionMethod: 'basic-binary',
        confidence: 0.6
      };
    }
    return null;
  } catch (error) {
    console.error('[PDFExtractor] Basic extraction failed:', error);
    return null;
  }
}

/**
 * Method 3: Regex-based extraction for specific patterns
 */
function extractWithRegex(buffer: Buffer): ExtractedPDFContent | null {
  try {
    console.log('[PDFExtractor] Trying regex extraction...');
    const bufferStr = buffer.toString('utf-8', 0, Math.min(buffer.length, 1000000));
    
    // Look for readable text patterns
    const readablePatterns = [
      /[A-Za-z]{3,}(?:\s+[A-Za-z]{3,})+/g,  // Words
      /[0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{2,4}/g,  // Dates
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,  // Emails
    ];
    
    let extractedText = '';
    for (const pattern of readablePatterns) {
      const matches = bufferStr.match(pattern);
      if (matches) {
        extractedText += matches.join(' ') + ' ';
      }
    }
    
    extractedText = extractedText.trim();
    
    if (extractedText.length > 100) {
      console.log('[PDFExtractor] Regex extraction success:', extractedText.length, 'chars');
      return {
        text: extractedText,
        pages: 1,
        metadata: {},
        pageTexts: [extractedText],
        extractionMethod: 'regex-patterns',
        confidence: 0.4
      };
    }
    return null;
  } catch (error) {
    console.error('[PDFExtractor] Regex extraction failed:', error);
    return null;
  }
}

/**
 * Main extraction function with multiple fallbacks
 */
export async function extractPDFTextRobust(buffer: Buffer): Promise<ExtractedPDFContent> {
  console.log('[PDFExtractor] Starting robust extraction, buffer size:', buffer.length);
  
  // Validate PDF signature
  const signature = buffer.toString('latin1', 0, 5);
  if (!signature.startsWith('%PDF')) {
    throw new Error('Invalid PDF file: missing PDF signature');
  }
  
  // Try each method in order of preference
  const methods = [
    extractWithPdfParse,
    () => Promise.resolve(extractBasicText(buffer)),
    () => Promise.resolve(extractWithRegex(buffer))
  ];
  
  for (const method of methods) {
    try {
      const result = await method(buffer);
      if (result && result.text.length > 0) {
        return result;
      }
    } catch (error) {
      console.error('[PDFExtractor] Method failed, trying next...');
    }
  }
  
  // If all methods fail, return a placeholder
  console.warn('[PDFExtractor] All extraction methods failed');
  return {
    text: '[Contenu PDF non extractible - le document peut contenir uniquement des images ou être protégé]',
    pages: 1,
    metadata: {},
    pageTexts: ['[Contenu non extractible]'],
    extractionMethod: 'none',
    confidence: 0
  };
}

/**
 * Extract text from a specific page (if supported)
 */
export async function extractPDFPage(buffer: Buffer, pageNumber: number): Promise<string> {
  const extracted = await extractPDFTextRobust(buffer);
  
  if (pageNumber < 1 || pageNumber > extracted.pageTexts.length) {
    return extracted.text; // Return all text if page not found
  }
  
  return extracted.pageTexts[pageNumber - 1] || extracted.text;
}

/**
 * Search for text in PDF
 */
export async function searchInPDF(buffer: Buffer, searchTerm: string): Promise<Array<{ page: number; text: string }>> {
  const extracted = await extractPDFTextRobust(buffer);
  const results: Array<{ page: number; text: string }> = [];
  const lowerSearchTerm = searchTerm.toLowerCase();

  for (let i = 0; i < extracted.pageTexts.length; i++) {
    const pageText = extracted.pageTexts[i];
    if (pageText.toLowerCase().includes(lowerSearchTerm)) {
      const index = pageText.toLowerCase().indexOf(lowerSearchTerm);
      const start = Math.max(0, index - 100);
      const end = Math.min(pageText.length, index + searchTerm.length + 100);
      const context = pageText.substring(start, end);

      results.push({
        page: i + 1,
        text: `...${context}...`,
      });
    }
  }

  return results;
}

/**
 * Get PDF summary
 */
export async function summarizePDF(buffer: Buffer, maxLength: number = 500): Promise<string> {
  const extracted = await extractPDFTextRobust(buffer);
  
  if (extracted.text.length <= maxLength) {
    return extracted.text;
  }

  let summary = extracted.text.substring(0, maxLength);
  const lastPeriod = summary.lastIndexOf('.');
  if (lastPeriod > maxLength - 100) {
    summary = extracted.text.substring(0, lastPeriod + 1);
  }

  return summary + '...';
}

export default {
  extractPDFTextRobust,
  extractPDFPage,
  searchInPDF,
  summarizePDF
};
