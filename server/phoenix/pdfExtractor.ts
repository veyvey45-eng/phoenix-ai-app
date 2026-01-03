/**
 * PDF Text Extraction Module
 * Extracts text content from PDF files for Phoenix to analyze
 */

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
}

/**
 * Extract text content from a PDF buffer
 * Uses a simple text extraction strategy for common PDFs
 */
export async function extractPDFText(buffer: Buffer): Promise<ExtractedPDFContent> {
  try {
    // Convert buffer to string to search for text patterns
    const bufferStr = buffer.toString('latin1');
    
    // Basic validation - check for PDF signature
    if (!bufferStr.startsWith('%PDF')) {
      throw new Error('Invalid PDF file: missing PDF signature');
    }

    // Extract text between BT (Begin Text) and ET (End Text) operators
    const textPattern = /BT([\s\S]*?)ET/g;
    const pageTexts: string[] = [];
    let extractedText = '';
    let match;

    while ((match = textPattern.exec(bufferStr)) !== null) {
      const textContent = match[1];
      
      // Extract text from Tj and TJ operators
      const textOperators = /\((.*?)\)\s*T[jJ]/g;
      let pageText = '';
      let textMatch;
      
      while ((textMatch = textOperators.exec(textContent)) !== null) {
        const text = textMatch[1];
        // Unescape PDF string escapes
        const unescaped = text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        pageText += unescaped + ' ';
      }
      
      if (pageText.trim()) {
        pageTexts.push(pageText.trim());
        extractedText += pageText + '\n\n';
      }
    }

    // If no text found with operators, try alternative extraction
    if (extractedText.trim().length === 0) {
      // Try to extract any readable text from the buffer
      const readableText = bufferStr
        .replace(/[^\x20-\x7E\n\r]/g, ' ')
        .split('\n')
        .filter(line => line.trim().length > 0)
        .join('\n');
      
      if (readableText.trim().length > 0) {
        extractedText = readableText;
        pageTexts.push(readableText);
      }
    }

    // Extract metadata from PDF info dictionary
    const infoPattern = /\/Info\s+(\d+)\s+0\s+R/;
    const infoMatch = bufferStr.match(infoPattern);
    
    const metadata: ExtractedPDFContent['metadata'] = {};

    if (infoMatch) {
      const infoObjNum = infoMatch[1];
      const infoPattern2 = new RegExp(`${infoObjNum}\\s+0\\s+obj([\\s\\S]*?)endobj`);
      const infoObj = bufferStr.match(infoPattern2);
      
      if (infoObj) {
        const infoContent = infoObj[1];
        
        // Extract metadata fields
        const titleMatch = infoContent.match(/\/Title\s*\((.*?)\)/);
        if (titleMatch && titleMatch[1]) {
          metadata.title = titleMatch[1];
        }
        
        const authorMatch = infoContent.match(/\/Author\s*\((.*?)\)/);
        if (authorMatch && authorMatch[1]) {
          metadata.author = authorMatch[1];
        }
        
        const subjectMatch = infoContent.match(/\/Subject\s*\((.*?)\)/);
        if (subjectMatch && subjectMatch[1]) {
          metadata.subject = subjectMatch[1];
        }
        
        const creatorMatch = infoContent.match(/\/Creator\s*\((.*?)\)/);
        if (creatorMatch && creatorMatch[1]) {
          metadata.creator = creatorMatch[1];
        }
        
        const producerMatch = infoContent.match(/\/Producer\s*\((.*?)\)/);
        if (producerMatch && producerMatch[1]) {
          metadata.producer = producerMatch[1];
        }
      }
    }

    // Estimate page count from page tree
    const pagesPattern = /\/Count\s+(\d+)/;
    const pagesMatch = bufferStr.match(pagesPattern);
    const pageCount = pagesMatch ? parseInt(pagesMatch[1], 10) : pageTexts.length || 1;

    return {
      text: extractedText.trim(),
      pages: pageCount,
      metadata,
      pageTexts: pageTexts.length > 0 ? pageTexts : [extractedText.trim()],
    };
  } catch (error) {
    console.error('Error extracting PDF:', error);
    throw new Error(`Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a specific page
 */
export async function extractPDFPage(buffer: Buffer, pageNumber: number): Promise<string> {
  try {
    const extracted = await extractPDFText(buffer);
    
    if (pageNumber < 1 || pageNumber > extracted.pageTexts.length) {
      throw new Error(`Invalid page number: ${pageNumber}. Document has ${extracted.pageTexts.length} pages.`);
    }

    return extracted.pageTexts[pageNumber - 1] || '';
  } catch (error) {
    console.error('Error extracting PDF page:', error);
    throw new Error(`Failed to extract PDF page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search for text in PDF
 */
export async function searchInPDF(buffer: Buffer, searchTerm: string): Promise<Array<{ page: number; text: string }>> {
  try {
    const extracted = await extractPDFText(buffer);
    const results: Array<{ page: number; text: string }> = [];
    const lowerSearchTerm = searchTerm.toLowerCase();

    for (let i = 0; i < extracted.pageTexts.length; i++) {
      const pageText = extracted.pageTexts[i];
      if (pageText.toLowerCase().includes(lowerSearchTerm)) {
        // Extract context around the match
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
  } catch (error) {
    console.error('Error searching PDF:', error);
    throw new Error(`Failed to search PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Summarize PDF content (basic - just extract first N characters)
 */
export async function summarizePDF(buffer: Buffer, maxLength: number = 500): Promise<string> {
  try {
    const extracted = await extractPDFText(buffer);
    
    // Simple summary: take first maxLength characters
    if (extracted.text.length <= maxLength) {
      return extracted.text;
    }

    // Find a good break point (end of sentence)
    let summary = extracted.text.substring(0, maxLength);
    const lastPeriod = summary.lastIndexOf('.');
    if (lastPeriod > maxLength - 100) {
      summary = extracted.text.substring(0, lastPeriod + 1);
    }

    return summary + '...';
  } catch (error) {
    console.error('Error summarizing PDF:', error);
    throw new Error(`Failed to summarize PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
