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
    throw new Error(`Failed to generate completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateStructuredCompletion<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: any,
  temperature: number = 0.7
): Promise<T> {
  try {
    const result = await generateCompletion(systemPrompt, userPrompt, temperature);

    const jsonMatch = result.text.match(/```json\s*([\s\S]*?)\s*```/) ||
                     result.text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    return parsed as T;
  } catch (error) {
    console.error('Error generating structured completion:', error);
    throw new Error(`Failed to generate structured completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
