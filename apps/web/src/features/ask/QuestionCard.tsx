import type { AskPart } from '@neighbourhood/shared';
import { ActionPill } from '../../components/ui';

export function QuestionCard({ part, onReply, disabled = false, active = true }: { part: Extract<AskPart, { kind: 'questions' }>; onReply(text: string): void; disabled?: boolean; active?: boolean }) {
  if (!active) return null;
  return <div className="flex flex-wrap gap-2" aria-label="Suggested replies">{part.questions[0]?.options.map(option => <ActionPill key={option} type="button" disabled={disabled} onClick={() => onReply(option.replaceAll('_', ' '))}>{option.replaceAll('_', ' ')}</ActionPill>)}</div>;
}
