/**
 * PDF Text Extraction Module
 * Extracts text content from PDF files for Phoenix to analyze
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
}

/**
 * Extract text content from a PDF buffer
 * Uses pdf-parse v2 library for robust extraction
 */
export async function extractPDFText(buffer: Buffer): Promise<ExtractedPDFContent> {
  try {
    // Validate PDF signature
    const bufferStr = buffer.toString('latin1');
    if (!bufferStr.startsWith('%PDF')) {
      throw new Error('Invalid PDF file: missing PDF signature');
    }

    // Parse PDF using pdf-parse v2
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    
    // Extract text from all pages
    const pageTexts: string[] = [];
    let extractedText = '';
    
    if (textResult.pages && textResult.pages.length > 0) {
      for (const page of textResult.pages) {
        const pageText = page.text || '';
        
        if (pageText.trim()) {
          pageTexts.push(pageText.trim());
          extractedText += pageText + '\n\n';
        }
      }
    } else if (textResult.text) {
      // Fallback: use the text property directly
      extractedText = textResult.text;
      pageTexts.push(textResult.text);
    }

    // If still no text, try basic extraction as fallback
    if (extractedText.trim().length === 0) {
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

    // Extract metadata
    const metadata: ExtractedPDFContent['metadata'] = {};
    
    // Get metadata from parser if available
    try {
      const infoResult = await parser.getInfo();
      if (infoResult && typeof infoResult === 'object') {
        const info = infoResult as any;
        if (info.title) metadata.title = info.title;
        if (info.author) metadata.author = info.author;
        if (info.subject) metadata.subject = info.subject;
        if (info.creator) metadata.creator = info.creator;
        if (info.producer) metadata.producer = info.producer;
      }
    } catch (e) {
      // Metadata extraction failed, continue without it
    }

    const pageCount = pageTexts.length || 1;

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
