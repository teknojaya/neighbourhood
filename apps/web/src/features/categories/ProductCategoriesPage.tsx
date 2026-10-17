import { ITEM_CATEGORIES } from '@neighbourhood/shared';
import { Link } from 'react-router';
import { Card } from '../../components/ui';
import { t } from '../../i18n';

/** Categories are part of ordinary listing discovery. */
export function ProductCategoriesPage() {
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">{t('module.categories.title')}</h1>
    <p className="text-sm text-stone-600">{t('module.categories.body')}</p>
    <ul className="grid grid-cols-2 gap-3">
      {ITEM_CATEGORIES.map((category) => <li key={category}>
        <Link to={`/explore?category=${category}`} className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          <Card className="flex h-full min-h-24 items-center font-semibold text-brand-800">{t(`category.${category}`)}</Card>
        </Link>
      </li>)}
    </ul>
  </div>;
}
