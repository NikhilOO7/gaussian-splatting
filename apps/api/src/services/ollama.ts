import { generateText } from 'ai';
import { ollama } from 'ollama-ai-provider';

const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const model = process.env.OLLAMA_MODEL || 'llama3.1:8b';

export interface OllamaResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function generateCompletion(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): Promise<OllamaResponse> {
  try {
    const result = await generateText({
      model: ollama(model, { baseURL }),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      maxTokens: 4096,
    });

    return {
      text: result.text,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      } : undefined,
    };
  } catch (error) {
    console.error('Error generating completion:', error);
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      throw new Error('Ollama server not running. Start it with: ollama serve');
    }
    
    throw new Error(`Failed to generate completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateStructuredCompletion<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: any,
  temperature: number = 0.7,
  retries: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const enhancedSystemPrompt = systemPrompt + `

CRITICAL: Your response must be ONLY valid JSON. No markdown, no explanations, no text before or after the JSON.
Start your response with { and end with }. Do not use \`\`\`json or any other formatting.`;

      const result = await generateCompletion(enhancedSystemPrompt, userPrompt, temperature);
      
      const parsed = parseJSONResponse<T>(result.text);
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt}/${retries} failed:`, lastError.message);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.error('All attempts failed, returning empty result');
  return getEmptyResult<T>();
}

function parseJSONResponse<T>(text: string): T {
  const jsonPatterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /(\{[\s\S]*\})/,
    /(\[[\s\S]*\])/,
  ];

  let jsonText = text.trim();

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (match) {
      jsonText = match[1].trim();
      break;
    }
  }

  jsonText = jsonText
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ');

  jsonText = jsonText.replace(/[\x00-\x1F\x7F]/g, ' ');

  try {
    return JSON.parse(jsonText) as T;
  } catch (e) {
    const objectMatch = jsonText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T;
      } catch (e2) {
      }
    }

    throw new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

function getEmptyResult<T>(): T {
  return {
    entities: [],
    relationships: [],
    resolvedEntities: [],
    resolvedRelationships: [],
    accepted: [],
    rejected: [],
    confidenceAdjustments: [],
  } as unknown as T;
}

export async function checkOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/api/tags`);
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    const hasModel = data.models?.some((m: any) => 
      m.name === model || m.name.startsWith(model.split(':')[0])
    );
    
    if (!hasModel) {
      console.warn(`Model ${model} not found. Available models:`, 
        data.models?.map((m: any) => m.name).join(', '));
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

export async function warmupModel(): Promise<void> {
  console.log('Warming up Ollama model...');
  try {
    await generateCompletion(
      'You are a helpful assistant.',
      'Say "ready" in one word.',
      0.1
    );
    console.log('Ollama model warmed up successfully');
  } catch (error) {
    console.error('Failed to warm up model:', error);
  }
}