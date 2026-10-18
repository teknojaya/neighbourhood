# Messages and saved items

Messages show the related product thumbnail in the conversation list and thread.
All conversations has a back chevron. The + beside the composer opens the camera
or photo library. Send up to two JPEG/PNG/WebP photos per message, each at most
4 MB, with or without text. Failed uploads retain retry/remove controls. The
server normalizes WebP and strips source metadata. Closed threads are read-only.

Photos use private `conversation-attachments/` bucket paths. An unsent photo is
readable only by its uploader; sending atomically binds it to one message and
allows only that conversation's participants to read it. Bearer-authenticated
blob reads never expose a public bucket URL. Upload and send retries are
idempotent. Pending uploads expire after 24 hours; the API maintenance timer
and operator maintenance job clean pending and untracked expired files.

Saved items are private bookmarks for actual products. They differ from Saved
needs, which represent things a neighbour wants to find. Bookmark controls work
on Home, Explore, item details and Ask results. Open Saved items from Profile
or Saved needs. Saving does not reserve stock. An unavailable listing remains a
removable title. Ask can read bookmarks or prepare save/remove approval cards.

## Setup and verification

The migration adds `saved_listings` and `conversation_attachments`. With the
configured database and bucket:

```sh
npm run db:deploy -w @neighbourhood/api
npm run seed:playground -w @neighbourhood/api
```

The seeder adds three non-owned bookmarks to each account/scenario. Repeating it
preserves existing records, but restores its three sample bookmarks if removed.
It does not seed private neighbour photo messages. To try those, sign in as
owner and neighbour in separate browsers and open a shared conversation.

With local PostgreSQL, Auth/Storage emulators, API and web running:

```sh
npm run smoke:conversations-saved
npm run smoke:ask-agent
npm run smoke:ui-refinements
```

The first smoke creates disposable users and a photographed listing, checks
bookmark persistence/removal/privacy, product thumbnails, the back chevron,
uploader-only pending reads, photo-only sending and the other participant's
browser image. It verifies bucket bytes and removes its records and objects.
Phone 320/440 and desktop 1440 captures stay ignored under the web review folder.
Automated map captures use synthetic tiles. Physical camera/keyboard behavior
still needs device verification.
