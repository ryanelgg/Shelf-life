# USDA FoodData Central

← [[Services & Integrations]]

**Website:** https://fdc.nal.usda.gov
**Type:** US government food & nutrition database
**Cost:** Free, no API key required

## Used for in Pantre
- Source of the **local barcode database** bundled inside the app
- 454,366 barcodes → processed into a 34MB JSON file
- Original source was ~3.1GB raw data, processed once with a streaming parser
- **Not called at runtime** — data lives locally in the app bundle

## Notes
- If the USDA database needs updating, re-download from fdc.nal.usda.gov and re-run the processing script
- [[Open Food Facts]] is used as a live fallback for anything not in this local DB
