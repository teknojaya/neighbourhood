import { GoogleGenAI } from '@google/genai';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';

/**
 * Server-only Gemini adapter (Gemini Developer API, Interactions API via
 * @google/genai). The API key never leaves this process.
 *
 * Usage follows https://ai.google.dev/gemini-api/docs/structured-output
 * (verified 2026-10-17): `ai.interactions.create({ model, input,
 * system_instruction, response_format: { type: 'text', mime_type:
 * 'application/json', schema } })` → `interaction.output_text`.
 */
export interface StructuredRequest {
  /** Used only for metrics/logs; never log prompts or inputs. */
  task: string;
  systemInstruction: string;
  input: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface StructuredGenerator {
  readonly model: string;
  /** Returns parsed JSON (unvalidated — callers must validate with Zod). */
  generateJson(req: StructuredRequest): Promise<unknown>;
}

/** Narrow view of the SDK surface we use, so tests can inject a fake. */
export interface InteractionsClient {
  create(
    params: {
      model: string;
      input: string;
      system_instruction: string;
      response_format: { type: 'text'; mime_type: 'application/json'; schema: Record<string, unknown> };
      generation_config: { max_output_tokens: number };
      store: boolean;
    },
    options: { timeout_ms: number; signal: AbortSignal },
  ): Promise<{ status?: string; output_text?: string }>;
}

export class GeminiAdapter implements StructuredGenerator {
  private readonly client: InteractionsClient;

  constructor(
    readonly model: string,
    apiKey: string,
    client?: InteractionsClient,
  ) {
    this.client = client ?? (new GoogleGenAI({ apiKey }).interactions as unknown as InteractionsClient);
  }

  async generateJson(req: StructuredRequest): Promise<unknown> {
    const started = Date.now();
    let interaction: { status?: string; output_text?: string };
    try {
      interaction = await this.client.create(
        {
          model: this.model,
          input: req.input,
          system_instruction: req.systemInstruction,
          response_format: { type: 'text', mime_type: 'application/json', schema: req.jsonSchema },
          generation_config: { max_output_tokens: req.maxOutputTokens },
          // Do not retain user needs text on the provider side beyond the call.
          store: false,
        },
        { timeout_ms: req.timeoutMs, signal: AbortSignal.timeout(req.timeoutMs) },
      );
    } catch (err) {
      const mapped = mapGeminiError(err);
      logger.warn('ai_call_failed', {
        task: req.task,
        model: this.model,
        code: mapped.code,
        upstreamStatus: upstreamStatus(err) ?? null,
        durationMs: Date.now() - started,
      });
      throw mapped;
    }

    logger.info('ai_call_completed', {
      task: req.task,
      model: this.model,
      status: interaction.status ?? 'unknown',
      durationMs: Date.now() - started,
    });

    if (interaction.status && interaction.status !== 'completed') {
      // e.g. "incomplete" when max_output_tokens was hit, or "failed".
      throw new HttpError(
        interaction.status === 'incomplete' ? 'AI_INVALID_OUTPUT' : 'AI_UPSTREAM_ERROR',
        `The AI service did not complete the request (${interaction.status})`,
      );
    }
    const text = interaction.output_text;
    if (!text) throw new HttpError('AI_INVALID_OUTPUT', 'The AI service returned an empty response');
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new HttpError('AI_INVALID_OUTPUT', 'The AI service returned malformed output');
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
