import { AskActionSchema, AskAttachmentSchema, AskRunSchema, AskSessionSchema } from '@neighbourhood/shared';
import type { AskAction, AskAttachment, AskRun, AskSession } from '../../generated/prisma/client.js';

export const sessionDto = (row: AskSession) => AskSessionSchema.parse({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
export const runDto = (row: AskRun) => AskRunSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
export const attachmentDto = (row: AskAttachment) => AskAttachmentSchema.parse(row);
export const actionDto = (row: AskAction) => AskActionSchema.parse({ ...row, status: row.status === 'pending' && row.expiresAt.getTime() <= Date.now() ? 'expired' : row.status, expiresAt: row.expiresAt.toISOString() });
