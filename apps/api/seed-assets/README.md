# Seed photos

`products/` contains seven self-contained JPEG assets generated with the built-in
image-generation tool on 2026-10-17. They are intended for the seeded marketplace
records. There are no remote image dependencies or personal uploads here.

The seed uploads matched photos through the existing listing image service,
normalizes them to WebP and stores them in your configured private bucket. It
does not replace an existing photo. Books, pantry goods, clothing, tableware,
rice cookers, tools and walking aids share their corresponding asset where the
seeded product title matches. Other products retain the honest no-photo state;
use `--photos-dir` to supply additional title-specific JPEGs.

The same prompt template was used for each asset:

> Create one product photograph asset for a neighbourhood sharing marketplace
> seed dataset. Subject: [subject below]. Photorealistic ordinary used-but-well-
> cared-for household goods. Natural soft daylight, simple warm beige tabletop
> and plain off-white wall, three-quarter view, centered complete objects with
> generous margin for a 4:3 thumbnail crop. Honest everyday texture, no people,
> no text, no watermark, no branding, no decorative UI. Save as an independent
> single photograph, not a collage.

| File | Subject |
|---|---|
| `picture-books.jpg` | Three illustrated children's picture books, one open to animal illustrations |
| `pantry-staples.jpg` | Sealed bags of rice, beans and lentils |
| `cotton-clothing.jpg` | Folded cotton jackets and a plain scarf |
| `tableware.jpg` | Ivory ceramic dinner plates and bowls |
| `rice-cooker.jpg` | White and brushed-steel electric rice cooker |
| `tool-kit.jpg` | Cordless drill and household hand-tool case |
| `walking-aid.jpg` | Aluminum walking frame with rubber feet and grips |

Repository copies are optimized to 960px wide JPEGs. Images are sample assets,
not proof of actual stock, condition, dimensions or quantities.
