import { useState } from 'react';
import type { AskPart } from '@neighbourhood/shared';
import { ActionPill, Button, Card, TextField } from '../../components/ui';

export function QuestionCard({ part, onReply, disabled = false }: { part: Extract<AskPart, { kind: 'questions' }>; onReply(text: string): void; disabled?: boolean }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  return <Card><form className="space-y-4" onSubmit={event => { event.preventDefault(); onReply(part.questions.map((item, index) => `${item.question} ${answers[index]?.trim() ?? ''}`).join('\n')); }}>
    <p className="text-sm text-stone-600">A few details will help me get this right. Choose an option or write your answer.</p>
    {part.questions.map((item, index) => <fieldset key={index} disabled={disabled} className="space-y-2"><legend className="mb-2 text-sm font-semibold">{item.question}</legend><div className="flex flex-wrap gap-2">{item.options.map(option => <ActionPill key={option} type="button" className="aria-pressed:border-brand-700 aria-pressed:bg-brand-50" aria-pressed={answers[index] === option} onClick={() => setAnswers(old => ({ ...old, [index]: option }))}>{option}</ActionPill>)}</div><TextField label="Your answer" aria-label={`Answer: ${item.question}`} value={answers[index] ?? ''} maxLength={240} required onChange={event => setAnswers(old => ({ ...old, [index]: event.target.value }))} /></fieldset>)}
    <Button type="submit" disabled={disabled || part.questions.some((_, index) => !answers[index]?.trim())}>Use these answers</Button><p className="text-xs text-stone-600">This fills your message. Review it, then send.</p>
  </form></Card>;
}
