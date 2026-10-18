# Seed photos

`products/` contains bundled sample JPEGs for the seeded marketplace, including
the original seven generated assets, the supplied Indonesian household/food
enrichment, and a distinct hanging-jacket photo generated with the built-in tool
on 2026-10-18. There are no remote image dependencies or personal uploads here.

The seed uploads matched photos through the existing listing image service,
normalizes them to WebP and stores them in your configured private bucket. It
does not replace an existing photo unless `--refresh-photos` is explicitly used.
The catalog in `scripts/seed-catalog.ts` assigns one unique photo to one product
or clearly described bundle. There are no title regexes or category fallback
photos: noodles do not get a fried-rice photo, and a ladder does not get a drill.
The seed validates all source files and normalized image hashes before writes.
Use `--photos-dir` to supply a complete set of title-specific JPEGs.

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
| `indonesian-groceries.jpg` | Sealed jasmine rice bag, instant noodles packets, and cooking oil bottle |
| `kitchen-condiments.jpg` | Sweet soy sauce (kecap manis), chili sambal jar, biscuit tin, and spice jars |
| `household-medicine.jpg` | Amber eucalyptus oil bottle (minyak kayu putih), paracetamol blister pack, medical gauze, and thermometer |
| `cobek-mortar.jpg` | Traditional Indonesian volcanic stone mortar and pestle (cobek & ulekan batu) with wooden cooking spatula |
| `cleaning-supplies.jpg` | Traditional palm-fiber broom (sapu ijuk), plastic dustpan (pengki), and hot-water thermos flask |
| `cotton-clothing.jpg` | Folded cotton jackets and a plain scarf |
| `cotton-clothing-hanging.jpg` | Two olive/cream jackets and a charcoal scarf on a rail; current seed clothing photo, distinct from the folded image used in earlier resident chat demos |
| `tableware.jpg` | Ivory ceramic dinner plates and bowls |
| `rice-cooker.jpg` | White and brushed-steel electric rice cooker |
| `tool-kit.jpg` | Cordless drill and household hand-tool case |
| `walking-aid.jpg` | Aluminum walking frame with rubber feet and grips |
| `folding-wheelchair.jpg` | Standard chrome and black folding wheelchair with hand rims and footrests |
| `paracetamol-tablets.jpg` | Single blister pack of 500mg paracetamol tablets on neutral wooden tabletop |
| `sack-of-rice.jpg` | Single 5kg woven polypropylene sack of rice standing upright with stitched seam |
| `nasi-goreng.jpg` | Freshly cooked Indonesian Nasi Goreng fried rice portion in eco container with fried egg, cucumber and kerupuk |
| `community-rice-meals.jpg` | User-supplied photograph of boxed rice meals for community sharing; converted to JPEG at its original resolution on 2026-10-18 |

Repository copies are optimized to 960px wide JPEGs. Images are sample assets,
not proof of actual stock, condition, dimensions or quantities.
