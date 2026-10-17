import { AI_LIMITS, type NeedsExtraction } from '@neighbourhood/shared';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { Alert, Button, Card } from '../../components/ui';
import { hasMessage, t } from '../../i18n';
import { ApiError } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { useAiStatus, useExtractNeeds } from './useNeeds';

export function NeedsAssistantPage() {
  const status = useAiStatus();
  const extract = useExtractNeeds();
  const online = useOnline();
  const [text, setText] = useState('');

  const unavailable = status.data && !status.data.available;
  const canSubmit = online && !extract.isPending && !unavailable && text.trim().length >= 3;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit) extract.mutate(text.trim());
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('needs.title')}</h1>
        <p className="text-stone-600">{t('needs.intro')}</p>
      </div>

      {status.isPending && <Alert>{t('needs.checking')}</Alert>}
      {unavailable && <Alert tone="warning">{t('needs.unavailable')}</Alert>}
      {status.isError && <Alert tone="error">{errorText(status.error)}</Alert>}

      <Card>
        <form className="space-y-3" onSubmit={onSubmit}>
          <label htmlFor="needs-text" className="sr-only">
            {t('needs.title')}
          </label>
          <textarea
            id="needs-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={AI_LIMITS.needsTextMaxChars}
            rows={5}
            placeholder={t('needs.placeholder')}
            className="block w-full resize-y rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            aria-describedby="needs-privacy"
          />
          <div className="flex items-center justify-between text-xs text-stone-500">
            <p id="needs-privacy" className="pr-3">
              {t('needs.privacy')}
            </p>
            <span className="shrink-0 tabular-nums">
              {t('needs.chars', { count: text.length, max: AI_LIMITS.needsTextMaxChars })}
            </span>
          </div>
          {!online && <Alert tone="warning">{t('error.OFFLINE')}</Alert>}
          {extract.isError && <Alert tone="error">{errorText(extract.error)}</Alert>}
          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {extract.isPending ? t('needs.submitting') : t('needs.submit')}
          </Button>
        </form>
      </Card>

      {extract.data && <ExtractionResult extraction={extract.data.extraction} />}
    </div>
  );
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const key = `error.${err.code}`;
    if (hasMessage(key)) return t(key);
  }
  return t('error.generic');
}

function ExtractionResult({ extraction }: { extraction: NeedsExtraction }) {
  const { items, timing, clarificationQuestions, outOfScope } = extraction;
  return (
    <section aria-live="polite" className="space-y-3">
      <h2 className="text-lg font-semibold">{t('needs.resultTitle')}</h2>
      <Alert tone="info">{t('needs.resultNote')}</Alert>

      {outOfScope.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-semibold">{t('needs.outOfScope')}</h3>
          <ul className="space-y-2 text-sm">
            {outOfScope.map((o, i) => (
              <li key={i}>
                {t(`needs.oos.${o.kind}`)}
                {o.kind === 'medicine' && (
                  <>
                    {' '}
                    <Link to="/medicine" className="font-semibold text-brand-800 underline">
                      {t('needs.medicineLink')}
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3">
        <h3 className="font-semibold">{t('needs.items')}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-stone-600">{t('needs.noItems')}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((item, i) => (
              <li key={i} className="space-y-1 py-2 first:pt-0 last:pb-0">
                <p className="font-medium">{item.name}</p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Chip>{t('needs.category')}: {item.category.replace('_', ' ')}</Chip>
                  <Chip>{t(`needs.preference.${item.preference}`)}</Chip>
                  {item.quantity !== null && <Chip>{t('needs.quantity', { value: item.quantity })}</Chip>}
                  {item.attributes.map((a, j) => (
                    <Chip key={j}>
                      {a.name}: {a.value}
                    </Chip>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-1 text-sm">
        <h3 className="font-semibold">{t('needs.timing')}</h3>
        {timing.neededBy === null && timing.loanDurationDays === null ? (
          <p className="text-stone-600">{t('needs.noTiming')}</p>
        ) : (
          <>
            {timing.neededBy && <p>{t('needs.neededBy', { date: timing.neededBy })}</p>}
            {timing.loanDurationDays && <p>{t('needs.duration', { days: timing.loanDurationDays })}</p>}
          </>
        )}
        {timing.originalText && <p className="text-stone-500">“{timing.originalText}”</p>}
      </Card>

      {clarificationQuestions.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-semibold">{t('needs.questions')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {clarificationQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{children}</span>;
}
