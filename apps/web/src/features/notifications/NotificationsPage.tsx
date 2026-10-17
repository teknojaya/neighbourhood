import { PlannedModule } from '../../components/ui';
import { t } from '../../i18n';

export function NotificationsPage() {
  return <PlannedModule title={t('module.notifications.title')} body={t('module.notifications.body')} />;
}
