import { ITEM_CATEGORIES } from '@neighbourhood/shared';
import { Link } from 'react-router';
import { PageHeading } from '../../components/ui';
import { t } from '../../i18n';

/** Categories are part of ordinary listing discovery. */
export function ProductCategoriesPage() {
  return <div className="space-y-4">
    <PageHeading title="Product categories">Browse free items and things to borrow by category.</PageHeading>
    <ul className="divide-y divide-stone-200">
      {ITEM_CATEGORIES.map((category) => <li key={category}>
        <Link to={`/explore?category=${category}`} className="flex min-h-16 items-center justify-between gap-3 py-4 font-semibold text-brand-800 hover:text-brand-700">
          <span>{t(`category.${category}`)}</span><span className="text-sm font-normal">Browse</span>
        </Link>
      </li>)}
    </ul>
  </div>;
}
