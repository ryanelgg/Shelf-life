// Run with: node scripts/processFoods.mjs
// Reads all USDA FoodData Central datasets and outputs src/data/foodDatabase.ts

import fs from 'fs';

// ── Category mappers ────────────────────────────────────────────────────────

function mapByDescription(name) {
  const d = name.toLowerCase();
  if (d.match(/apple|banana|berry|strawberr|blueberr|raspberr|blackberr|grape|melon|watermelon|cantaloupe|orange|peach|pear|pineapple|plum|mango|papaya|kiwi|fig|date|cherry|apricot|nectarine|coconut|avocado|lemon|lime|grapefruit|tangerine|clementine/)) return 'Produce';
  if (d.match(/broccoli|carrot|celery|cucumber|lettuce|spinach|kale|tomato|onion|garlic|potato|pepper|zucchini|squash|mushroom|asparagus|artichoke|beet|cabbage|cauliflower|corn|eggplant|green bean|pea|radish|arugula|chard|collard|turnip|parsnip|leek|shallot|scallion|fennel|watercress|endive|radicchio/)) return 'Produce';
  if (d.match(/milk|cheese|yogurt|butter|cream|cheddar|mozzarella|brie|gouda|parmesan|ricotta|cottage cheese|sour cream|half.and.half|whipping cream|kefir|ghee|colby|provolone|gruyere|manchego|camembert|feta|bleu cheese|blue cheese/)) return 'Dairy';
  if (d.match(/beef|chicken|pork|turkey|lamb|veal|duck|bison|venison|steak|ground meat|hamburger|meatball|hot dog|sausage|bacon|ham|salami|prosciutto|pepperoni|bratwurst|chorizo|kielbasa|liverwurst|bologna|pastrami|corned beef|pulled pork|ribs|tenderloin|sirloin|ribeye|brisket|chuck|roast|loin|chop/)) return 'Meat';
  if (d.match(/salmon|tuna|shrimp|crab|lobster|tilapia|cod|halibut|scallop|clam|oyster|mussel|sardine|anchovy|trout|bass|snapper|mahi|swordfish|catfish|herring|mackerel|pollock|flounder|sole|sea bass|crayfish|squid|octopus/)) return 'Seafood';
  if (d.match(/bread|pasta|rice|flour|oat|cereal|noodle|tortilla|bagel|roll|wheat|barley|quinoa|couscous|farro|bulgur|millet|rye|cracker|granola|cornmeal|grits|polenta|pretzel|pita|lavash|brioche|focaccia|ciabatta|sourdough|baguette|croissant|pancake|waffle|biscuit mix|muffin mix/)) return 'Grains';
  if (d.match(/frozen/)) return 'Frozen';
  if (d.match(/canned|tinned|bean|lentil|chickpea|black bean|kidney bean|navy bean|pinto bean|soup|broth|stock/)) return 'Canned';
  if (d.match(/chip|snack|popcorn|candy|chocolate|cookie|brownie|cake|pie|pudding|jello|gummy|lollipop|caramel|toffee|fudge|licorice|marshmallow|trail mix|nut mix|granola bar|energy bar|protein bar|rice cake/)) return 'Snacks';
  if (d.match(/juice|soda|water|coffee|tea|lemonade|smoothie|shake|cocoa|cider|punch|sport.drink|energy drink|kombucha|wine|beer|champagne|spirits|whiskey|vodka|rum|gin|tequila|brandy|liqueur/)) return 'Beverages';
  if (d.match(/sauce|ketchup|mustard|mayo|mayonnaise|dressing|vinegar|oil|spice|salt|pepper|seasoning|condiment|salsa|hot sauce|relish|pickle|chutney|jelly|jam|honey|syrup|peanut butter|almond butter|tahini|hummus|guacamole|soy sauce|teriyaki|worcestershire|sriracha|ranch|bbq/)) return 'Condiments';
  if (d.match(/cake|muffin|pastry|donut|doughnut|pie|tart|scone|danish|eclair|crepe|waffle|cupcake/)) return 'Bakery';
  if (d.match(/deli|lunch meat|cold cut|pastrami|roast beef/)) return 'Deli';
  return null;
}

// Maps USDA branded food categories to our app categories
function mapBrandedCategory(brandedCat, name) {
  if (!brandedCat) return mapByDescription(name);
  const c = brandedCat.toLowerCase();
  if (c.match(/produce|fruit|vegetable|fresh/)) return 'Produce';
  if (c.match(/dairy|milk|cheese|yogurt|butter|cream/)) return 'Dairy';
  if (c.match(/meat|poultry|beef|pork|chicken|turkey|lamb|sausage|bacon|hot dog|deli/)) return 'Meat';
  if (c.match(/seafood|fish|shrimp|shellfish/)) return 'Seafood';
  if (c.match(/bread|grain|cereal|pasta|rice|flour|cracker|tortilla|baked good|bakery|roll|bagel|biscuit/)) return 'Grains';
  if (c.match(/frozen/)) return 'Frozen';
  if (c.match(/canned|soup|broth|bean/)) return 'Canned';
  if (c.match(/snack|chip|candy|cookie|chocolate|confection|dessert|cake|mix|granola|bar|popcorn/)) return 'Snacks';
  if (c.match(/beverage|drink|juice|water|soda|coffee|tea|wine|beer|alcohol|spirit/)) return 'Beverages';
  if (c.match(/sauce|condiment|dressing|seasoning|spice|oil|vinegar|spread|butter|jam|jelly|syrup|honey/)) return 'Condiments';
  if (c.match(/bakery|pastry|donut|muffin|cupcake|croissant/)) return 'Bakery';
  // Fall back to description-based mapping
  return mapByDescription(name);
}

function mapLocation(category) {
  return { Produce: 'fridge', Dairy: 'fridge', Meat: 'fridge', Seafood: 'fridge', Grains: 'pantry', Frozen: 'freezer', Canned: 'pantry', Snacks: 'pantry', Beverages: 'pantry', Condiments: 'fridge', Bakery: 'counter', Deli: 'fridge', Other: 'pantry' }[category] ?? 'pantry';
}

function mapShelfLife(category) {
  return { Produce: 7, Dairy: 10, Meat: 3, Seafood: 2, Grains: 365, Frozen: 180, Canned: 730, Snacks: 60, Beverages: 180, Condiments: 180, Bakery: 5, Deli: 5, Other: 14 }[category] ?? 14;
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function cleanName(raw) {
  return raw
    .replace(/,.*$/, '')           // drop everything after first comma
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Load all datasets ───────────────────────────────────────────────────────

console.log('Loading datasets...');

const foundation1 = JSON.parse(fs.readFileSync('./scripts/foundationDownload.json', 'utf8'));
const foundation2 = JSON.parse(fs.readFileSync('./scripts/FoodData_Central_foundation_food_json_2025-12-18.json', 'utf8'));
const srLegacy    = JSON.parse(fs.readFileSync('./scripts/FoodData_Central_sr_legacy_food_json_2018-04.json', 'utf8'));
const survey      = JSON.parse(fs.readFileSync('./scripts/surveyDownload.json', 'utf8'));
const branded     = JSON.parse(fs.readFileSync('./scripts/branded-slim.json', 'utf8'));

console.log('Foundation 1:', foundation1.FoundationFoods?.length);
console.log('Foundation 2:', foundation2.FoundationFoods?.length);
console.log('SR Legacy:',    srLegacy.SRLegacyFoods?.length);
console.log('Survey:',       survey.SurveyFoods?.length);
console.log('Branded:',      branded.length);

// ── Process each dataset ───────────────────────────────────────────────────

const seen = new Set();
const results = [];

function addItem(rawName, categoryFn) {
  const cleaned = cleanName(rawName);
  const name = titleCase(cleaned);
  const key = name.toLowerCase();
  if (seen.has(key) || name.length < 3 || name.length > 60) return;

  const category = categoryFn();
  if (!category) return;

  seen.add(key);
  results.push({
    name,
    category,
    location: mapLocation(category),
    shelfLifeDays: mapShelfLife(category),
    estimatedValue: 3.99,
  });
}

// Foundation + SR Legacy + Survey — description-based
const genericItems = [
  ...(foundation1.FoundationFoods ?? []),
  ...(foundation2.FoundationFoods ?? []),
  ...(srLegacy.SRLegacyFoods ?? []),
  ...(survey.SurveyFoods ?? []),
];

for (const item of genericItems) {
  const raw = item.description;
  if (!raw) continue;
  addItem(raw, () => mapByDescription(raw));
}

// Branded — use brandedFoodCategory field
for (const item of branded) {
  if (!item.name) continue;
  addItem(item.name, () => mapBrandedCategory(item.category, item.name));
}

// ── Sort and trim ──────────────────────────────────────────────────────────

results.sort((a, b) => a.name.localeCompare(b.name));
console.log(`\nTotal unique items: ${results.length}`);

// Distribute evenly across categories — cap each category so total ~8000
const categories = ['Produce','Dairy','Meat','Seafood','Grains','Frozen','Canned','Snacks','Beverages','Condiments','Bakery','Deli'];
const perCategory = 666; // ~8000 total across 12 categories
const trimmed = [];
const catCount = {};
for (const item of results) {
  const c = item.category;
  if (!catCount[c]) catCount[c] = 0;
  if (catCount[c] < perCategory) {
    trimmed.push(item);
    catCount[c]++;
  }
}

console.log(`Trimmed to: ${trimmed.length} items`);
console.log('By category:', catCount);

const outDir = './src/data';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Write the full database as a JSON file for lazy-loading
fs.writeFileSync('./public/foodDatabase-full.json', JSON.stringify(results));
console.log(`Wrote full database (${results.length} items) to public/foodDatabase-full.json`);

// Write the trimmed set as the bundled TS module
const output = `// Auto-generated from USDA FoodData Central — do not edit manually
// Datasets: Foundation Foods, SR Legacy, Survey (WWEIA), Branded Foods
// ${trimmed.length} items bundled | full ${results.length}-item DB lazy-loaded from /foodDatabase-full.json
// Run scripts/processFoods.mjs to regenerate

export interface FoodEntry {
  name: string;
  category: string;
  location: string;
  shelfLifeDays: number;
  estimatedValue: number;
}

export const foodDatabase: FoodEntry[] = ${JSON.stringify(trimmed)};

let fullDatabase: FoodEntry[] | null = null;
let fullDbLoading = false;
let fullDbCallbacks: ((db: FoodEntry[]) => void)[] = [];

export function preloadFullDatabase() {
  if (fullDatabase || fullDbLoading) return;
  fullDbLoading = true;
  fetch('/foodDatabase-full.json')
    .then(r => r.json())
    .then(data => {
      fullDatabase = data;
      fullDbLoading = false;
      fullDbCallbacks.forEach(cb => cb(data));
      fullDbCallbacks = [];
    })
    .catch(() => { fullDbLoading = false; });
}

export function searchFoods(query: string, limit = 6): FoodEntry[] {
  if (query.trim().length < 2) return [];
  const q = query.toLowerCase();
  const db = fullDatabase ?? foodDatabase;
  const startsWith = db.filter(f => f.name.toLowerCase().startsWith(q));
  const contains   = db.filter(f => !f.name.toLowerCase().startsWith(q) && f.name.toLowerCase().includes(q));
  return [...startsWith, ...contains].slice(0, limit);
}
`;

fs.writeFileSync('./src/data/foodDatabase.ts', output);
console.log(`✅ Wrote ${trimmed.length} bundled items to src/data/foodDatabase.ts`);
