# Open Food Facts

← [[Services & Integrations]]

**Website:** https://world.openfoodfacts.org
**Type:** Open-source food/barcode database
**Cost:** Free, no API key required

## Used for in Pantre
- Barcode lookup **fallback** when a scanned item isn't found in the local USDA database
- API: `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`

## Notes
- Primary barcode source is the local 454,366-entry USDA database bundled in the app (34MB JSON)
- Open Food Facts only called when local DB misses
