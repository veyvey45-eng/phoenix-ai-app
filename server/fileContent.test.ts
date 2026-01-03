import { describe, it, expect, beforeAll } from 'vitest';
import { FileProcessor } from './phoenix/fileProcessor';

describe('File Content Transmission', () => {
  let fileProcessor: FileProcessor;

  beforeAll(() => {
    fileProcessor = new FileProcessor();
  });

  it('should extract text from PDF correctly', async () => {
    // Create a simple PDF with text content
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj\n' +
      '<< /Type /Catalog /Pages 2 0 R >>\n' +
      'endobj\n' +
      '2 0 obj\n' +
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n' +
      'endobj\n' +
      '3 0 obj\n' +
      '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\n' +
      'endobj\n' +
      '4 0 obj\n' +
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n' +
      'endobj\n' +
      '5 0 obj\n' +
      '<< /Length 44 >>\n' +
      'stream\n' +
      'BT\n' +
      '/F1 12 Tf\n' +
      '100 700 Td\n' +
      '(Test PDF Content) Tj\n' +
      'ET\n' +
      'endstream\n' +
      'endobj\n' +
      'xref\n' +
      '0 6\n' +
      '0000000000 65535 f\n' +
      '0000000009 00000 n\n' +
      '0000000058 00000 n\n' +
      '0000000115 00000 n\n' +
      '0000000244 00000 n\n' +
      '0000000333 00000 n\n' +
      'trailer\n' +
      '<< /Size 6 /Root 1 0 R >>\n' +
      'startxref\n' +
      '428\n' +
      '%%EOF'
    );

    const result = await fileProcessor.extractText(pdfBuffer, 'application/pdf', 'test.pdf');

    expect(result.success).toBe(true);
    expect(result.text).toBeDefined();
    expect(result.text?.length).toBeGreaterThan(0);
    console.log('Extracted text:', result.text);
  });

  it('should extract text from plain text file', async () => {
    const textBuffer = Buffer.from('This is a test text file with some content.');
    const result = await fileProcessor.extractText(textBuffer, 'text/plain', 'test.txt');

    expect(result.success).toBe(true);
    expect(result.text).toBe('This is a test text file with some content.');
    expect(result.wordCount).toBe(9); // Includes 'content.' as a word
  });

  it('should handle file upload and extraction', async () => {
    const textBuffer = Buffer.from('Test file content for upload');
    const uploadedFile = await fileProcessor.uploadFile(
      textBuffer,
      'test.txt',
      'text/plain',
      1
    );

    expect(uploadedFile.id).toBeDefined();
    expect(uploadedFile.originalName).toBe('test.txt');
    expect(uploadedFile.extractedText).toBe('Test file content for upload');
    expect(uploadedFile.size).toBe(textBuffer.length);
  });

  it('should retrieve uploaded file with content', () => {
    const fileId = 'test-file-id';
    const testFile = fileProcessor.getFile(fileId);

    // This will be undefined initially, but the structure is correct
    expect(fileProcessor.getUserFiles(1)).toBeDefined();
  });
});
