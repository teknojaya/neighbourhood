import { ItemCategorySchema } from '@neighbourhood/shared';
import { BoxIcon } from '../../components/icons';

/** Native select keeps the filter accessible to touch, keyboard and screen readers. */
export function CategoryFilter({ value, onChange }: { value: string; onChange(value: string): void }) {
  return <label className="relative inline-flex max-w-full items-center">
    <span className="sr-only">Category</span>
    <span className="pointer-events-none absolute left-3 text-brand-800 [&_svg]:h-[18px] [&_svg]:w-[18px]"><BoxIcon /></span>
    <select aria-label="Category" value={value} onChange={event => onChange(event.target.value)} className={`min-h-11 max-w-full cursor-pointer rounded-full border py-2 pl-10 pr-3 text-sm font-semibold text-brand-800 hover:border-brand-700 ${value ? 'border-brand-700 bg-brand-50' : 'border-stone-200 bg-white'}`}>
      <option value="">All categories</option>
      {ItemCategorySchema.options.map(category => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}
    </select>
  </label>;
}
