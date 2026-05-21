// Auto-generated USDA data is stored in public JSON files so it doesn't bloat the JS bundle.
// Core search DB: /foodDatabase-core.json
// Full search DB: /foodDatabase-full.json

export interface FoodEntry {
  name: string;
  category: string;
  location: string;
  shelfLifeDays: number;
  estimatedValue: number;
}

let coreDatabase: FoodEntry[] | null = null;
let fullDatabase: FoodEntry[] | null = null;
let coreDatabasePromise: Promise<FoodEntry[]> | null = null;
let fullDatabasePromise: Promise<FoodEntry[]> | null = null;

async function loadDatabase(path: string): Promise<FoodEntry[]> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json() as Promise<FoodEntry[]>;
}

export function preloadCoreDatabase() {
  if (coreDatabase) return Promise.resolve(coreDatabase);
  if (coreDatabasePromise) return coreDatabasePromise;

  coreDatabasePromise = loadDatabase('/foodDatabase-core.json')
    .then((data) => {
      coreDatabase = data;
      return data;
    })
    .catch(() => {
      coreDatabasePromise = null;
      return [];
    });

  return coreDatabasePromise;
}

export function preloadFullDatabase() {
  if (fullDatabase) return Promise.resolve(fullDatabase);
  if (fullDatabasePromise) return fullDatabasePromise;

  fullDatabasePromise = loadDatabase('/foodDatabase-full.json')
    .then((data) => {
      fullDatabase = data;
      return data;
    })
    .catch(() => {
      fullDatabasePromise = null;
      return [];
    });

  return fullDatabasePromise;
}

function searchDatabase(db: FoodEntry[], query: string, limit: number) {
  const startsWith: FoodEntry[] = [];
  for (const food of db) {
    if (food.name.toLowerCase().startsWith(query)) {
      startsWith.push(food);
      if (startsWith.length >= limit) {
        return startsWith;
      }
    }
  }

  const contains: FoodEntry[] = [];
  const remaining = limit - startsWith.length;
  if (remaining <= 0) return startsWith;

  for (const food of db) {
    const lowerName = food.name.toLowerCase();
    if (!lowerName.startsWith(query) && lowerName.includes(query)) {
      contains.push(food);
      if (contains.length >= remaining) break;
    }
  }

  return [...startsWith, ...contains];
}

export function searchFoods(query: string, limit = 6): FoodEntry[] {
  if (query.trim().length < 2) return [];

  const normalizedQuery = query.toLowerCase();
  const database = fullDatabase ?? coreDatabase;
  if (!database) {
    void preloadCoreDatabase();
    return [];
  }

  return searchDatabase(database, normalizedQuery, limit);
}

void preloadCoreDatabase();
