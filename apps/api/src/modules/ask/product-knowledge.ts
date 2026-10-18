import { ItemCategorySchema, MAX_RADIUS_KM, MIN_RADIUS_KM, RADIUS_OPTIONS_KM } from '@neighbourhood/shared';

/** Curated product facts, grounded in implemented services. No resident data belongs here. */
export const PRODUCT_GUIDE = {
  overview: {
    name: 'NeighbourHood', purpose: 'A neighbourhood marketplace for donating useful physical goods and lending single items. One neighbour can both give and receive.',
    categories: ItemCategorySchema.options,
    limits: ['No payments, sale checkout, delivery booking, drivers, identity verification badge or reputation scores.', 'No category-specific assistance service. Categories describe ordinary products.', 'No promise of availability, notifications being delivered, or community membership until a live service confirms it.'],
  },
  roles: {
    neighbour: 'Neighbour is the baseline resident/account label, not a community membership role. You can browse, donate/share, request and borrow without first joining a community. A neighbour may have no community memberships at all.',
    member: 'Member belongs to one specific community. Open joining becomes active; approval-required joining stays pending until approved. Pending membership grants no volunteer privileges.',
    volunteer: 'An active volunteer in that community receives and checks physical deposits, accepts reviewed quantities, reviews inventory and records audited stock changes/collections. Volunteering is community-scoped.',
    moderator: 'An active moderator in that community can also manage membership, grant member/volunteer roles to other people and add consented partner points. Nobody changes their own role.',
    staff: 'Platform staff can create communities and grant/remove moderator roles. Staff is a separate server-granted platform role; it does not automatically make every user a volunteer or a moderator everywhere.',
    categoryEditor: 'Product category editor is a separate platform role for category management, not a collection-point volunteer role.',
    accountAnswers: 'Use my_account for the caller’s actual roles and membership statuses. Do not infer membership or permissions from the word neighbour, a display name, a community card, or an old answer.',
  },
  sharing: {
    donate: 'Donate / Share on Home opens the direct listing form. Give away means free to keep. Ask clarifies the next missing fact with one casual question, waits for the normal chat answer, then asks another only if needed. It never repeats known donation intent or presents a questionnaire. It prepares a private draft with the selected chat photos. Ask can prepare publication using a complete draft and the saved Profile pickup location; the resident must press Confirm on the approval card. Custom private pickup details use the secure review form. Photos remain attached through text follow-ups and publication.',
    requests: 'Requesting a donation does not reserve stock immediately. Approval reserves the available quantity; rejected, cancelled or expired reservations release it. Collected means the in-person pickup was confirmed. Follow server allowedActions.',
    pickup: 'Public cards show an area label and approximate distance, not exact coordinates or pickup instructions. An authorized request/loan participant can view pickup details after approval. The recipient arranges their own transport and helpers.',
    appliances: 'Show working condition and any known weight, dimensions, floor, elevator, dismantling, installation and helpers. Unknown means not confirmed. A photo cannot prove those facts.',
  },
  borrowing: {
    meaning: 'Borrow & return means one physical unit, with requested start and return dates and the owner’s maximum loan duration. Availability depends on dates; a visible listing is not a confirmed reservation.',
    lifecycle: 'Check loan availability, request dates, wait for owner approval, then confirm checkout and return after in-person handovers. Approved date ranges cannot overlap. Record returned condition and arrange overdue returns with the owner.',
  },
  points: {
    meaning: 'A community collection point is a physical partner place, such as a pantry or sharing box, where neighbours drop off donations and collect confirmed stock. It is not a chat room, reward point or delivery service.',
    deposit: 'Offering a deposit is only a proposal. Stock becomes available after an authorized volunteer or moderator receives the goods in person and accepts reviewed quantities. Stock changes are audited; expired goods cannot be offered.',
    location: 'A moderator creates the point using its own coordinates and secure address form with partner consent. The point never requires changing the moderator’s home location. Exact point addresses are public only with partner consent.',
    qr: 'A QR identifies the collection point. Scanning does not grant membership, staff or volunteer access, and it does not automatically approve or collect a deposit.',
  },
  saved_needs: {
    meaning: 'Saved needs are private structured things a neighbour wants to find. Ask prepares an editable review card and the neighbour confirms saving. Saved needs survive chat deletion.',
    matches: 'Open Saved needs and choose Find nearby matches, or ask the agent to match an existing need. Matches use a saved location and real eligible listings. There is no background-match or delivered-push guarantee and no direct edit endpoint for an already saved need; remove and save a corrected need.',
  },
  saved_items: {
    meaning: 'Saved items bookmark actual listings, separate from Saved needs for things still being sought. Use the bookmark on Home, Explore, item details or Ask results. Open Saved items from Profile or Saved needs. Saving does not reserve stock and unavailable items may remain as a removable title.',
    agent: 'Use list_saved_items to read the caller’s bookmarks. To save/remove a real listing in chat, prepare_marketplace_action with saved_item_add/saved_item_remove creates an approval card; Confirm applies it.',
  },
  location: {
    setup: 'Set a search location in Profile with device location or manual coordinates and save. Ask can open the same Profile location fields in a secure dialog and resume the chat after Save location and continue. Coordinates and public area are distinct: searchLocationSet checks coordinates; pickupLocationReady also needs a public neighbourhood/city/region label. If only the label is missing, Ask can prepare an areaLabel preference update for approval, preserving coordinates. A city name alone cannot set precise coordinates. Search uses the saved point, not an assumed live GPS location.',
    radiusKm: RADIUS_OPTIONS_KM,
    manualRadius: { min: MIN_RADIUS_KM, max: MAX_RADIUS_KM, unit: 'whole kilometres', explore: 'Search distance opens manual input directly below the map; Apply radius updates this search only. Profile can save a default.' },
    searchAnswers: 'Always name the radius checked. With no nearby results, the service separately checks the same query/category/offering up to 50 km and labels any farther matches. If that check is empty, say none found within that checked range at this time, never none anywhere or a promise that widening will help. Ask about radius only if useful and not already answered. Older results remain collapsible without repeated radius choices. Generic clothes/pakaian/baju searches use the clothing category; specific attributes stay specific. Borrow listings still need date availability and approval.',
    map: 'Explore opens with the caller’s saved search location and selected radius circle directly below its title. Search, offering, category and radius filters are below the map. Home also has a category dropdown beneath All/Free/Borrow; View all carries the offering and category into Explore. Changing the radius updates the search and circle. The map can be hidden. Panning does not move the search centre; change it in Profile. Product pins group matching items by rounded public area; their numbers are item counts, not exact pickup locations. No exact neighbour pickup pins are exposed.',
    loading: 'Skeletons appear only while Profile or item data is loading. With no saved location, the item query is paused and a location setup state is shown. Settled zero results are an empty state, not an endless skeleton.',
  },
  chat: {
    ask: 'Ask is the private AI assistant. History opens past sessions; + New chat starts a fresh composer. A session is created by the first send or photo, not just opening the tab.',
    images: 'The + beside the composer opens Take photo or Photo library. Up to two JPEG/PNG/WebP images per message, each at most 4 MB. Images suggest a draft, not proven condition or quantity.',
    replies: 'Replies stream live with thinking, reading, searching and preparation states. Stop cancels the active turn. After a dropped connection, reopen the session to recover durable history. Question and radius choices send a normal chat answer immediately; they never approve marketplace changes. Setup actions open real photo/location controls. The composer clears at Send and accepts the next draft while the agent works. Uploaded photos preview before sending and are attached to that same message. Sharing asks for a photo first unless already supplied. At least one photo is mandatory before publication; drafts can be kept private until a photo is supplied.',
    neighbourMessages: 'Messages in the header are human neighbour conversations tied to authorized requests or loans. They are separate from AI chat history. Product photos identify the related item. The + supports up to two JPEG/PNG/WebP photos per message, at most 4 MB each. Unsent photos are visible only to the uploader; after sending, only conversation participants can view them. Unsent photos expire after 24 hours. Closed conversations are read-only.',
    drafts: 'Unsent text and direct Share form drafts stay in account-scoped memory while navigating; refreshing or signing out clears them. Successful publication or explicit discard clears the Share draft.',
    confirmation: 'All proposed marketplace writes require the review card’s confirmation button. A chat message saying yes does not execute the action. Only a completed service receipt proves success.',
  },
  navigation: {
    home: '/', explore: '/explore', ask: '/needs', savedNeeds: '/needs/saved', savedItems: '/saved-items', donateShare: '/share',
    start: '/needs', activity: '/activity', requests: '/activity?tab=requests', loans: '/activity?tab=loans', sharedItems: '/activity?tab=giving',
    labels: 'Start in the bottom navigation opens Ask NeighbourHood. Activity opens Shared items first, followed by Requests and Loans. Wanna share? opens the direct sharing form. Notifications groups unread and read updates; opening an update marks it read.',
    communities: '/communities', messages: '/messages', updates: '/notifications', profile: '/profile', categories: '/categories',
  },
} as const;

export const PRODUCT_ORIENTATION = `NeighbourHood is for free donations and single-item loans, not buying/selling or delivery. Neighbour is the baseline account label; member, volunteer and moderator are community-scoped memberships, while staff and category editor are separate platform roles. Being a neighbour does not imply joining a community. A collection point is a physical partner pantry/sharing box; a volunteer checks physical deposits before stock appears. Saved needs are private and independent of chat history. Read get_product_guide to explain product terms, navigation and workflows; use my_account for the caller's real roles or location setup status. General explanations do not need community directory searches. Never replace product facts with plausible marketplace conventions.`;
