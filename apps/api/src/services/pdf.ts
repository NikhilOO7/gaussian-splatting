import pdfParse from 'pdf-parse';

export interface PDFContent {
  text: string;
  numPages: number;
  info?: any;
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFContent> {
  try {
    const data = await pdfParse(pdfBuffer);

    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function fetchAndExtractPDF(url: string): Promise<PDFContent> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await extractTextFromPDF(buffer);
  } catch (error) {
    console.error('Error fetching and extracting PDF:', error);
    throw new Error(`Failed to fetch and extract PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function chunkText(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start = end - overlap;
  }

  return chunks;
}
