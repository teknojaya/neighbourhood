import type { MarketplaceAction } from '@neighbourhood/shared';

export function MarketplacePreview({ action }: { action: MarketplaceAction }) {
  const fields: Array<[string, string | number | null | undefined]> = [];
  switch (action.operation) {
    case 'listing_publish': fields.push(['Item', action.body.title], ['Description', action.body.description], ['Category', action.body.category], ['Offering', action.body.mode], ['Condition', action.body.condition], ['Quantity', action.body.quantity], ['Pickup area', action.body.areaLabel], ['Private pickup instructions', action.body.pickupInstructions], ['Maximum loan days', action.body.lending?.maxLoanDays], ['Best before', action.body.bestBefore], ['Photos', action.attachmentIds.length]); break;
    case 'listing_edit': fields.push(...Object.entries(action.body).filter(([,v]) => typeof v === 'string' || typeof v === 'number').map(([k,v]) => [k.replaceAll('_', ' '), v as string | number] as [string, string | number])); break;
    case 'listing_transition': fields.push(['New status', action.body.to]); break;
    case 'loan_request': fields.push(['From', action.body.startDate], ['Return by', action.body.endDate], ['Message', action.body.message]); break;
    case 'loan_transition': fields.push(['New status', action.body.to], ['Return condition', action.body.returnConditionNote]); break;
    case 'deposit_propose': for (const item of action.body.items) fields.push([item.title, item.quantity], ['Best before', item.bestBefore]); break;
    case 'deposit_review': fields.push(['Decision', action.body.to], ['Accepted quantities', action.body.acceptedQuantities?.join(', ')], ['Review note', action.body.reviewNote]); break;
    case 'stock_adjust': fields.push(['Quantity change', action.body.delta], ['Reason', action.body.reason], ['Note', action.body.note]); break;
    case 'member_update': fields.push(['Role', action.role], ['Status', action.status]); break;
    case 'profile_preferences': fields.push(['Language', action.preferredLanguage], ['Search radius in km', action.searchRadiusKm]); break;
    case 'community_create': fields.push(['Community', action.body.name], ['Area', action.body.areaLabel], ['Joining', action.body.joinPolicy]); break;
    case 'point_create': fields.push(['Point', action.body.name], ['Partner', action.body.partnerName], ['Address', action.body.exactAddress], ['Public address consent', String(action.body.publicAddressConsent)]); break;
  }
  if (action.operation === 'listing_publish' || action.operation === 'listing_edit') {
    const appliance = action.body.appliance;
    if (appliance) fields.push(['Working status', appliance.workingStatus], ['Brand', appliance.brand], ['Model', appliance.model], ['Weight (kg)', appliance.approxWeightKg], ['Dimensions (cm)', appliance.dimensionsCm ? `${appliance.dimensionsCm.width} × ${appliance.dimensionsCm.height} × ${appliance.dimensionsCm.depth}` : 'Not confirmed'], ['Power', appliance.powerRequirement], ['Pickup floor', appliance.access.floorLevel ?? 'Not confirmed'], ['Elevator', appliance.access.elevatorAvailable == null ? 'Not confirmed' : appliance.access.elevatorAvailable ? 'Yes' : 'No'], ['Dismantling', appliance.access.requiresDismantling == null ? 'Not confirmed' : appliance.access.requiresDismantling ? 'Required' : 'Not required'], ['Installation', appliance.access.requiresInstallation == null ? 'Not confirmed' : appliance.access.requiresInstallation ? 'Required' : 'Not required'], ['Helpers', appliance.access.suggestedHelpers ?? 'Not confirmed'], ['Access notes', appliance.access.notes]);
    if (action.body.lending) fields.push(['Loan notes', action.body.lending.notes], ['Deposit required', action.body.lending.depositRequired ? 'Yes' : 'No']);
  }
  if (action.operation === 'point_create') fields.push(['Public area', action.body.areaLabel], ['Point latitude', action.body.location.lat], ['Point longitude', action.body.location.lng]);
  return <dl className="space-y-2 text-sm">{fields.filter(([,v]) => v !== undefined && v !== null && v !== '').map(([label, value], i) => <div key={i}><dt className="font-medium text-stone-600">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>;
}
