import { ApiError } from '../../lib/api';
import { hasMessage, t } from '../../i18n';

export function featureError(error: unknown) {
  if (error instanceof ApiError) {
    const key = `error.${error.code}`;
    if (hasMessage(key)) return t(key);
  }
  return t('error.generic');
}
