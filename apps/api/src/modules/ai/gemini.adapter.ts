import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';

export interface StructuredRequest {
  task: string; systemInstruction: string; input: string;
  jsonSchema: Record<string, unknown>; maxOutputTokens: number; timeoutMs: number;
}
export interface StructuredGenerator { readonly model: string; generateJson(req: StructuredRequest): Promise<unknown> }
export interface JsonModelClient {
  generateContent(params: GenerateContentParameters): Promise<Pick<GenerateContentResponse, 'text' | 'candidates'>>;
}
/** The configured model rejects array-length keywords in structured outputs.
 * Zod still enforces all array bounds after generation; tools keep their own schema.
 */
export function geminiOutputSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const clean = (value: unknown): unknown => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !['maxItems', 'minItems', '$schema'].includes(key)).map(([key, child]) => [key, clean(child)])) : value;
  return clean(schema) as Record<string, unknown>;
}
/** Typed, stateless structured generation. Validation and grounding belong to the caller. */
export class GeminiAdapter implements StructuredGenerator {
  private readonly client: JsonModelClient;
  constructor(readonly model: string, apiKey: string, client?: JsonModelClient) { this.client = client ?? new GoogleGenAI({ apiKey }).models; }
  async generateJson(req: StructuredRequest): Promise<unknown> {
    const started = Date.now();
    try {
      const response = await this.client.generateContent({ model: this.model, contents: req.input,
        config: { systemInstruction: req.systemInstruction, responseMimeType: 'application/json', responseJsonSchema: geminiOutputSchema(req.jsonSchema),
          maxOutputTokens: req.maxOutputTokens, abortSignal: AbortSignal.timeout(req.timeoutMs) } });
      if (response.candidates?.some(candidate => candidate.finishReason === 'MAX_TOKENS') || !response.text) throw new HttpError('AI_INVALID_OUTPUT', 'The AI response did not finish');
      try { const result: unknown = JSON.parse(response.text); logger.info('ai_call_completed', { task: req.task, model: this.model, durationMs: Date.now() - started }); return result; }
      catch (error) { if (error instanceof HttpError) throw error; throw new HttpError('AI_INVALID_OUTPUT', 'The AI service returned malformed output'); }
    } catch (error) {
      const failure = error instanceof HttpError ? error : mapGeminiError(error);
      logger.warn('ai_call_failed', { task: req.task, model: this.model, code: failure.code, upstreamStatus: upstreamStatus(error) ?? null, durationMs: Date.now() - started });
      throw failure;
    }
  }
}

function upstreamStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { status?: unknown; statusCode?: unknown };
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  return undefined;
}

/** Maps SDK/HTTP failures to stable API error codes. Never echoes upstream text. */
export function mapGeminiError(err: unknown): HttpError {
  const name = err instanceof Error ? err.name : '';
  if (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    name === 'APIConnectionTimeoutError' ||
    name === 'RequestTimeoutError' ||
    name === 'APIUserAbortError' ||
    name === 'RequestAbortedError'
  ) {
    return new HttpError('AI_TIMEOUT', 'The AI service took too long to respond');
  }
  const status = upstreamStatus(err);
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  if (status === 429) return new HttpError('AI_QUOTA_EXCEEDED', 'AI quota or rate limit reached. Please try again later.');
  if (status === 401 || status === 403) {
    return new HttpError('AI_NOT_CONFIGURED', 'The AI service rejected the server credentials');
  }
  if (status === 404 || (status === 400 && message.includes('model'))) {
    return new HttpError('AI_MODEL_UNAVAILABLE', 'The configured AI model is not available');
  }
  if (status === 400) return new HttpError('AI_INPUT_REJECTED', 'The AI service could not process this input');
  return new HttpError('AI_UPSTREAM_ERROR', 'The AI service is temporarily unavailable');
}
