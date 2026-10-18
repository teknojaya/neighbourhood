// Browser smoke tests use clearly labelled local tiles, never public map traffic.
export const syntheticMapTile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e7ede8"/><path d="M0 110H256M110 0V256" stroke="#fff" stroke-width="18"/><text x="12" y="30" fill="#57534e" font-family="sans-serif" font-size="14">Synthetic test map tile</text></svg>';

export async function stubMapTiles(context) {
  await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: syntheticMapTile }));
}
