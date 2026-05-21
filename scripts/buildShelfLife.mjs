// Builds src/data/shelfLife.ts from official FDA/USDA FoodKeeper guidelines
// Source: https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/storage-times
// Run with: node scripts/buildShelfLife.mjs

import fs from 'fs';

// Each entry: [keywords[], fridgeDays, freezerDays, pantryDays]
// Days are median of the FDA/USDA range. null = not recommended for that storage.
const RAW_DATA = [
  // ── Meat (raw) ───────────────────────────────────────────────────────────
  [['chicken breast', 'chicken thigh', 'chicken leg', 'chicken wing', 'chicken raw', 'raw chicken'], 2, 270, null],
  [['ground beef', 'ground turkey', 'ground pork', 'ground chicken', 'ground meat', 'ground bison'], 2, 120, null],
  [['steak', 'beef steak', 'sirloin', 'ribeye', 'tenderloin', 'flank steak', 'strip steak'], 5, 365, null],
  [['beef roast', 'chuck roast', 'pot roast', 'brisket'], 5, 365, null],
  [['pork chop', 'pork loin', 'pork tenderloin', 'pork roast'], 5, 270, null],
  [['bacon'], 7, 30, null],
  [['ham', 'cooked ham'], 7, 60, null],
  [['sausage raw', 'italian sausage', 'bratwurst', 'breakfast sausage'], 2, 60, null],
  [['hot dog', 'frankfurter', 'wiener'], 14, 60, null],
  [['deli meat', 'lunch meat', 'cold cuts', 'salami', 'pepperoni', 'prosciutto', 'pastrami', 'bologna', 'turkey breast sliced'], 5, 60, null],
  [['lamb chop', 'lamb roast', 'rack of lamb', 'lamb shank'], 5, 270, null],
  [['veal'], 5, 270, null],
  [['duck', 'goose'], 2, 180, null],
  [['turkey whole', 'whole turkey'], 2, 365, null],
  [['liver', 'organ meat', 'giblets'], 2, 90, null],
  [['corned beef'], 7, 90, null],

  // ── Seafood (raw) ───────────────────────────────────────────────────────
  [['salmon', 'tuna steak', 'mahi', 'swordfish', 'halibut', 'cod', 'tilapia', 'bass', 'snapper', 'fish fillet', 'fish steak'], 2, 90, null],
  [['shrimp', 'prawns'], 2, 365, null],
  [['crab', 'lobster', 'crayfish'], 2, 90, null],
  [['scallops'], 2, 90, null],
  [['clams', 'mussels', 'oysters'], 2, 90, null],
  [['squid', 'octopus', 'calamari'], 2, 90, null],
  [['sardines', 'anchovies', 'herring', 'mackerel'], 2, 90, null],
  [['smoked salmon', 'lox'], 14, 90, null],

  // ── Cooked meat & leftovers ──────────────────────────────────────────────
  [['cooked chicken', 'rotisserie chicken', 'fried chicken'], 4, 120, null],
  [['cooked beef', 'cooked steak', 'cooked roast'], 4, 90, null],
  [['cooked pork', 'cooked chops'], 4, 90, null],
  [['cooked fish', 'cooked salmon', 'cooked shrimp'], 4, 90, null],
  [['cooked pasta', 'leftover pasta'], 5, 60, null],
  [['cooked rice', 'leftover rice'], 5, 60, null],
  [['leftovers', 'cooked food'], 4, 90, null],
  [['soup', 'stew', 'chili'], 4, 90, null],
  [['casserole'], 4, 90, null],
  [['pizza'], 4, 60, null],

  // ── Eggs & Dairy ────────────────────────────────────────────────────────
  [['eggs', 'egg'], 35, 365, null],
  [['egg whites', 'egg yolks'], 4, 365, null],
  [['hard boiled egg', 'boiled egg'], 7, null, null],
  [['whole milk', 'skim milk', '2% milk', 'milk'], 7, 90, null],
  [['cream', 'heavy cream', 'whipping cream', 'half and half'], 7, 120, null],
  [['sour cream'], 21, null, null],
  [['butter', 'unsalted butter', 'salted butter'], 90, 270, 14],
  [['cheddar cheese', 'colby cheese', 'swiss cheese', 'parmesan', 'romano', 'hard cheese'], 180, 270, null],
  [['mozzarella', 'provolone', 'gouda', 'muenster', 'semi-soft cheese'], 21, 180, null],
  [['brie', 'camembert', 'feta', 'ricotta', 'cottage cheese', 'cream cheese', 'soft cheese'], 14, 180, null],
  [['shredded cheese', 'sliced cheese'], 21, 180, null],
  [['yogurt', 'greek yogurt'], 14, 60, null],
  [['kefir'], 14, null, null],
  [['ice cream', 'gelato', 'sorbet', 'frozen yogurt'], null, 60, null],
  [['whipped cream'], 7, null, null],

  // ── Produce — Fruits ────────────────────────────────────────────────────
  [['apples'], 42, null, 14],
  [['bananas'], null, null, 4],
  [['strawberries', 'strawberry'], 7, 365, null],
  [['blueberries', 'blueberry'], 10, 365, null],
  [['raspberries', 'blackberries', 'raspberry', 'blackberry'], 3, 365, null],
  [['grapes'], 14, null, null],
  [['oranges', 'clementines', 'tangerines', 'mandarin'], 21, null, 10],
  [['lemons', 'limes', 'lemon', 'lime'], 21, null, 14],
  [['grapefruit'], 21, null, 14],
  [['avocado'], 4, null, 3],
  [['mango', 'mangoes'], 7, 365, 4],
  [['pineapple'], 7, 365, 3],
  [['peaches', 'nectarines', 'plums', 'apricots', 'peach', 'nectarine'], 7, 365, 4],
  [['pears', 'pear'], 7, 365, 5],
  [['watermelon'], 14, null, 7],
  [['cantaloupe', 'honeydew', 'melon'], 7, null, 5],
  [['kiwi', 'kiwifruit'], 21, null, 7],
  [['cherries', 'cherry'], 7, 365, null],
  [['figs', 'fig'], 7, null, 3],
  [['dates', 'date'], 30, null, 90],
  [['coconut'], 7, null, null],
  [['papaya'], 7, 365, 3],

  // ── Produce — Vegetables ────────────────────────────────────────────────
  [['lettuce', 'romaine', 'iceberg', 'mixed greens', 'salad greens', 'spring mix'], 10, null, null],
  [['spinach', 'kale', 'arugula', 'chard', 'collard greens', 'leafy greens'], 7, 365, null],
  [['broccoli', 'cauliflower'], 14, 365, null],
  [['carrots', 'carrot'], 28, 365, null],
  [['celery'], 14, null, null],
  [['cucumber', 'cucumbers'], 7, null, null],
  [['bell pepper', 'peppers', 'jalapeño', 'jalapeno'], 14, 365, null],
  [['tomatoes', 'tomato', 'cherry tomatoes'], 14, null, 5],
  [['potatoes', 'potato', 'russet potato', 'yukon gold', 'sweet potato', 'yam'], null, 365, 56],
  [['onions', 'onion', 'yellow onion', 'red onion', 'white onion'], null, null, 60],
  [['garlic', 'garlic cloves', 'garlic bulb'], null, null, 150],
  [['mushrooms', 'mushroom', 'shiitake', 'portobello'], 7, 365, null],
  [['asparagus'], 5, 365, null],
  [['corn', 'sweet corn', 'corn on the cob'], 3, 365, null],
  [['green beans', 'snap beans', 'string beans'], 7, 365, null],
  [['peas', 'snow peas', 'sugar snap peas'], 7, 365, null],
  [['zucchini', 'summer squash'], 7, 365, null],
  [['butternut squash', 'acorn squash', 'winter squash'], 90, 365, null],
  [['beets', 'beet'], 14, 365, null],
  [['cabbage', 'red cabbage', 'napa cabbage', 'savoy cabbage'], 14, null, null],
  [['eggplant'], 7, 365, null],
  [['leeks', 'leek', 'scallions', 'green onions'], 14, null, null],
  [['radishes', 'radish'], 14, null, null],
  [['artichoke', 'artichokes'], 7, null, null],
  [['brussels sprouts'], 7, 365, null],
  [['fennel'], 7, null, null],
  [['ginger', 'fresh ginger'], 21, null, 7],
  [['herbs fresh', 'basil', 'cilantro', 'parsley', 'mint', 'dill', 'thyme', 'rosemary', 'chives'], 14, null, null],

  // ── Bread & Bakery ──────────────────────────────────────────────────────
  [['bread', 'white bread', 'wheat bread', 'sourdough', 'sandwich bread'], 14, 90, 7],
  [['bagels', 'bagel'], 14, 90, 5],
  [['english muffin', 'english muffins'], 14, 90, 7],
  [['pita bread', 'pita', 'lavash', 'flatbread'], 14, 90, 7],
  [['tortillas', 'flour tortilla', 'corn tortilla'], 21, 90, 7],
  [['croissants', 'croissant'], 7, 30, 2],
  [['muffins', 'muffin'], 7, 90, 4],
  [['donuts', 'donut', 'doughnuts'], 7, 60, 2],
  [['rolls', 'dinner rolls', 'hamburger buns', 'hot dog buns'], 14, 90, 5],
  [['cake', 'cupcakes', 'cupcake'], 7, 90, 4],
  [['pie'], 7, 90, 3],
  [['cookies', 'cookie'], 14, 180, 30],
  [['crackers', 'cracker'], null, null, 90],
  [['granola bar', 'granola bars', 'energy bar', 'protein bar'], null, null, 90],

  // ── Grains & Pantry staples ──────────────────────────────────────────────
  [['white rice', 'rice'], null, null, 1825],
  [['brown rice'], null, null, 180],
  [['pasta', 'spaghetti', 'penne', 'fettuccine', 'rotini', 'dry pasta'], null, null, 730],
  [['oats', 'rolled oats', 'oatmeal', 'steel cut oats'], null, null, 365],
  [['flour', 'all purpose flour', 'whole wheat flour', 'bread flour'], null, null, 365],
  [['cereal', 'breakfast cereal', 'granola'], null, null, 180],
  [['quinoa'], null, null, 730],
  [['couscous'], null, null, 730],
  [['barley', 'farro', 'bulgur'], null, null, 365],
  [['cornmeal', 'grits', 'polenta'], null, null, 365],
  [['bread crumbs', 'panko'], null, null, 180],
  [['popcorn', 'popcorn kernels'], null, null, 365],
  [['pretzels', 'pretzel'], null, null, 90],

  // ── Canned & Packaged ────────────────────────────────────────────────────
  [['canned beans', 'black beans canned', 'chickpeas canned', 'kidney beans canned'], null, null, 1825],
  [['canned tomatoes', 'diced tomatoes', 'crushed tomatoes', 'tomato paste', 'tomato sauce'], null, null, 1095],
  [['canned tuna', 'canned salmon', 'canned sardines'], null, null, 1825],
  [['canned corn', 'canned peas', 'canned vegetables'], null, null, 1095],
  [['canned soup', 'soup canned', 'chicken broth canned', 'beef broth canned'], null, null, 1095],
  [['canned fruit', 'peaches canned', 'pears canned'], null, null, 1095],
  [['coconut milk canned', 'coconut cream'], null, null, 1095],
  [['dried beans', 'dried lentils', 'lentils', 'split peas', 'dried chickpeas'], null, null, 1095],
  [['peanut butter'], null, null, 90],
  [['almond butter', 'nut butter'], null, null, 90],
  [['honey'], null, null, 3650],
  [['maple syrup'], 365, null, 180],
  [['jam', 'jelly', 'preserves', 'marmalade'], 365, null, 180],
  [['olive oil', 'vegetable oil', 'canola oil', 'coconut oil'], null, null, 365],
  [['vinegar', 'apple cider vinegar', 'balsamic vinegar', 'red wine vinegar'], null, null, 1825],
  [['soy sauce', 'tamari', 'coconut aminos'], null, null, 730],
  [['hot sauce', 'sriracha', 'tabasco', 'buffalo sauce'], 365, null, 365],
  [['ketchup'], 365, null, 365],
  [['mustard', 'dijon mustard', 'yellow mustard'], 365, null, 365],
  [['mayonnaise', 'mayo'], 60, null, null],
  [['salad dressing', 'ranch dressing', 'italian dressing', 'caesar dressing'], 90, null, null],
  [['salsa'], 14, null, 365],
  [['bbq sauce', 'barbecue sauce'], 120, null, 365],
  [['worchestershire sauce', 'worcestershire'], 365, null, 365],
  [['tahini'], 90, null, 90],
  [['hummus'], 7, null, null],
  [['guacamole'], 4, null, null],

  // ── Frozen ──────────────────────────────────────────────────────────────
  [['frozen vegetables', 'frozen broccoli', 'frozen peas', 'frozen corn', 'frozen spinach'], null, 300, null],
  [['frozen fruit', 'frozen berries', 'frozen mango', 'frozen peaches'], null, 365, null],
  [['frozen pizza'], null, 60, null],
  [['frozen meals', 'frozen dinner', 'tv dinner'], null, 90, null],
  [['frozen waffles', 'frozen pancakes'], null, 90, null],
  [['frozen burritos', 'frozen burritos'], null, 90, null],
  [['ice cream', 'frozen yogurt', 'gelato'], null, 60, null],

  // ── Beverages ────────────────────────────────────────────────────────────
  [['orange juice', 'apple juice', 'juice'], 7, 365, null],
  [['almond milk', 'oat milk', 'soy milk', 'coconut milk carton', 'plant milk'], 10, null, null],
  [['wine', 'red wine', 'white wine', 'rosé'], 5, null, 365],
  [['beer'], 7, null, 180],
  [['sparkling water', 'seltzer', 'club soda'], null, null, 365],
  [['coffee beans', 'ground coffee', 'coffee'], null, null, 180],
  [['tea bags', 'tea', 'green tea'], null, null, 730],
];

// ── Build lookup map ────────────────────────────────────────────────────────

const shelfLifeMap = {};

for (const [keywords, fridgeDays, freezerDays, pantryDays] of RAW_DATA) {
  const entry = { fridgeDays, freezerDays, pantryDays };
  for (const kw of keywords) {
    shelfLifeMap[kw.toLowerCase()] = entry;
  }
}

// ── Lookup function ────────────────────────────────────────────────────────

function lookupShelfLife(foodName, location) {
  const name = foodName.toLowerCase();

  // Try exact match first, then partial
  for (const [kw, entry] of Object.entries(shelfLifeMap)) {
    if (name.includes(kw) || kw.includes(name)) {
      const days = location === 'fridge' ? entry.fridgeDays
                 : location === 'freezer' ? entry.freezerDays
                 : entry.pantryDays;
      if (days) return days;
    }
  }
  return null;
}

// ── Write output ────────────────────────────────────────────────────────────

const output = `// Auto-generated from FDA/USDA FoodKeeper guidelines
// Source: fsis.usda.gov/food-safety/safe-food-handling/storage-times
// Run scripts/buildShelfLife.mjs to regenerate

export interface ShelfLifeEntry {
  fridgeDays: number | null;
  freezerDays: number | null;
  pantryDays: number | null;
}

const shelfLifeMap: Record<string, ShelfLifeEntry> = ${JSON.stringify(shelfLifeMap, null, 2)};

export function lookupShelfLife(foodName: string, location: string): number | null {
  const name = foodName.toLowerCase();
  // Try longest keyword match first for most specific result
  let bestMatch: ShelfLifeEntry | null = null;
  let bestLen = 0;
  for (const [kw, entry] of Object.entries(shelfLifeMap)) {
    if ((name.includes(kw) || kw.includes(name)) && kw.length > bestLen) {
      bestMatch = entry;
      bestLen = kw.length;
    }
  }
  if (!bestMatch) return null;
  return location === 'fridge' ? bestMatch.fridgeDays
       : location === 'freezer' ? bestMatch.freezerDays
       : bestMatch.pantryDays;
}
`;

const outDir = './src/data';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync('./src/data/shelfLife.ts', output);
console.log(`✅ Wrote ${Object.keys(shelfLifeMap).length} keyword entries to src/data/shelfLife.ts`);
