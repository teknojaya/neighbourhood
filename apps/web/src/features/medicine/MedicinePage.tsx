import { PlannedModule } from '../../components/ui';
import { t } from '../../i18n';

/** Informational only until the partner-mediated workflow ships. No medical advice. */
export function MedicinePage() {
  return <PlannedModule title={t('module.medicine.title')} body={t('module.medicine.body')} />;
}
