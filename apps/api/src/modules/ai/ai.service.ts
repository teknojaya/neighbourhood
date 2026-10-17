import {
  AI_LIMITS,
  type AiStatus,
  type ExtractNeedsBody,
  type ExtractNeedsResponse,
  NeedsExtractionSchema,
} from '@neighbourhood/shared';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import type { StructuredGenerator } from './gemini.adapter.js';
import { buildNeedsInput, NEEDS_JSON_SCHEMA, NEEDS_SYSTEM_INSTRUCTION } from './needs.prompt.js';

export class AiService {
  /** `generator` is null when GEMINI_API_KEY/GEMINI_MODEL are missing. */
  constructor(
    private readonly generator: StructuredGenerator | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  status(): AiStatus {
    return this.generator
      ? { available: true, model: this.generator.model, reason: 'ok' }
      : { available: false, reason: 'not_configured' };
  }

  async extractNeeds(body: ExtractNeedsBody): Promise<ExtractNeedsResponse> {
    const generator = this.requireGenerator();
    const today = body.today ?? this.now().toISOString().slice(0, 10);
    const raw = await generator.generateJson({
      task: 'needs_extraction',
      systemInstruction: NEEDS_SYSTEM_INSTRUCTION,
      input: buildNeedsInput(body.text, today),
      jsonSchema: NEEDS_JSON_SCHEMA,
      maxOutputTokens: AI_LIMITS.maxOutputTokens,
      timeoutMs: AI_LIMITS.requestTimeoutMs,
    });
    const parsed = NeedsExtractionSchema.safeParse(raw);
    if (!parsed.success) {
      // Log only the failing paths — never the content.
      logger.warn('ai_output_invalid', {
        task: 'needs_extraction',
        paths: parsed.error.issues
          .slice(0, 5)
          .map((i) => i.path.join('.'))
          .join(','),
      });
      throw new HttpError('AI_INVALID_OUTPUT', 'The AI response did not match the expected format. Please try again.');
    }
    return { extraction: parsed.data, model: generator.model, requiresUserReview: true };
  }

  private requireGenerator(): StructuredGenerator {
    if (!this.generator) {
      throw new HttpError('AI_NOT_CONFIGURED', 'AI assistance is not configured on this server');
    }
    return this.generator;
  }
}
