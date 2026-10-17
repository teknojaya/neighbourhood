import { PlannedModule } from '../../components/ui';
import { t } from '../../i18n';

export function MessagesPage() {
  return <PlannedModule title={t('module.messages.title')} body={t('module.messages.body')} />;
}
