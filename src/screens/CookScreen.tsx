import { useState, useMemo } from 'react';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { getFreshnessStatus, FOOD_EMOJI } from '../types';
import type { Recipe } from '../types';

type FilterTag = 'all' | 'quick' | 'easy' | 'healthy' | 'vegetarian';

export function CookScreen() {
  const { recipes, pantryItems } = useStore();
  const [filter, setFilter] = useState<FilterTag>('all');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  // Sort recipes by how many expiring items they use
  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
      const aExpiring = a.matchedItemIds.filter(id => {
        const item = pantryItems.find(p => p.id === id);
        if (!item) return false;
        const status = getFreshnessStatus(item.expirationDate);
        return status === 'expiring' || status === 'expiring-soon';
      }).length;
      const bExpiring = b.matchedItemIds.filter(id => {
        const item = pantryItems.find(p => p.id === id);
        if (!item) return false;
        const status = getFreshnessStatus(item.expirationDate);
        return status === 'expiring' || status === 'expiring-soon';
      }).length;
      return bExpiring - aExpiring;
    });
  }, [recipes, pantryItems]);

  const filteredRecipes = useMemo(() => {
    if (filter === 'all') return sortedRecipes;
    if (filter === 'quick') return sortedRecipes.filter(r => r.cookTime <= 15);
    if (filter === 'easy') return sortedRecipes.filter(r => r.difficulty === 'easy');
    if (filter === 'healthy') return sortedRecipes.filter(r => r.tags.includes('healthy') || r.tags.includes('omega-3'));
    if (filter === 'vegetarian') return sortedRecipes.filter(r => r.tags.includes('vegetarian'));
    return sortedRecipes;
  }, [sortedRecipes, filter]);

  const totalSavings = recipes.reduce((s, r) => s + r.savingsEstimate, 0);

  const getExpiringItemsInRecipe = (recipe: Recipe) => {
    return recipe.matchedItemIds.map(id => {
      const item = pantryItems.find(p => p.id === id);
      if (!item) return null;
      const status = getFreshnessStatus(item.expirationDate);
      return { ...item, status };
    }).filter(Boolean);
  };

  const getDifficultyColor = (d: string) => {
    if (d === 'easy') return 'var(--fresh)';
    if (d === 'medium') return 'var(--expiring-soon)';
    return 'var(--expired)';
  };

  return (
    <div className="screen-enter" style={{
      flex: 1,
      overflowY: 'auto',
      padding: '20px 16px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '-12px' }}>
        <AvocadoMascot size={34} />
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Cook This</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Recipes from what you have</p>
        </div>
      </div>

      {/* Savings hero */}
      <Card className="card-enter stagger-1" style={{
        textAlign: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, var(--safe-gradient-1), var(--safe-gradient-2))',
        border: '1px solid rgba(139, 195, 74, 0.2)',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Total savings potential
        </div>
        <div className="mono" style={{ fontSize: '38px', fontWeight: 500, color: 'var(--accent)', lineHeight: 1.1 }}>
          ${totalSavings.toFixed(2)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          by cooking with what's in your pantry
        </div>
      </Card>

      {/* Filter tags */}
      <div className="card-enter stagger-2" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        {([
          { id: 'all' as FilterTag, label: 'All' },
          { id: 'quick' as FilterTag, label: '< 15 min' },
          { id: 'easy' as FilterTag, label: 'Easy' },
          { id: 'healthy' as FilterTag, label: 'Healthy' },
          { id: 'vegetarian' as FilterTag, label: 'Vegetarian' },
        ]).map(f => (
          <button
            key={f.id}
            className="btn-pill"
            onClick={() => setFilter(f.id)}
            style={{
              padding: '7px 14px',
              borderRadius: '20px',
              border: filter === f.id ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
              background: filter === f.id ? 'var(--accent-dim)' : 'transparent',
              color: filter === f.id ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Syne, sans-serif',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Recipe cards */}
      {filteredRecipes.map((recipe, i) => {
        const isExpanded = expandedRecipe === recipe.id;
        const matchedItems = getExpiringItemsInRecipe(recipe);
        const hasExpiring = matchedItems.some(item => item && (item.status === 'expiring' || item.status === 'expiring-soon'));

        return (
          <Card
            key={recipe.id}
            className={`card-enter stagger-${Math.min(i + 3, 6)}`}
            onClick={() => setExpandedRecipe(isExpanded ? null : recipe.id)}
            style={{
              border: hasExpiring ? '1px solid rgba(255, 152, 0, 0.3)' : undefined,
              cursor: 'pointer',
            }}
          >
            {/* Recipe header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                {hasExpiring && (
                  <div style={{
                    display: 'inline-block',
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--expiring-soon)',
                    background: 'rgba(255, 152, 0, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    marginBottom: '4px',
                  }}>
                    Uses expiring items
                  </div>
                )}
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{recipe.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.4 }}>
                  {recipe.description}
                </div>
              </div>
              <div className="mono" style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--accent)',
                flexShrink: 0,
                marginLeft: '12px',
              }}>
                ${recipe.savingsEstimate.toFixed(2)}
              </div>
            </div>

            {/* Meta badges */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: isExpanded ? '12px' : '0' }}>
              <span style={{
                padding: '3px 8px', borderRadius: '8px',
                background: 'var(--accent-dim)', color: 'var(--accent)',
                fontSize: '10px', fontWeight: 600,
              }}>
                {recipe.cookTime} min
              </span>
              <span style={{
                padding: '3px 8px', borderRadius: '8px',
                background: 'rgba(139, 195, 74, 0.1)',
                color: getDifficultyColor(recipe.difficulty),
                fontSize: '10px', fontWeight: 600, textTransform: 'capitalize',
              }}>
                {recipe.difficulty}
              </span>
              <span style={{
                padding: '3px 8px', borderRadius: '8px',
                background: 'var(--input-bg)', color: 'var(--text-muted)',
                fontSize: '10px', fontWeight: 600,
              }}>
                {recipe.servings} servings
              </span>
              {recipe.matchedItemIds.length > 0 && (
                <span style={{
                  padding: '3px 8px', borderRadius: '8px',
                  background: 'var(--accent-dim)', color: 'var(--accent)',
                  fontSize: '10px', fontWeight: 600,
                }}>
                  {recipe.matchedItemIds.length} pantry items
                </span>
              )}
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Ingredients */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Ingredients</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {recipe.ingredients.map((ing, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: ing.fromPantry ? 'var(--accent)' : 'var(--text-muted)',
                          flexShrink: 0,
                        }} />
                        <span style={{ color: ing.fromPantry ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {ing.amount} {ing.name}
                        </span>
                        {ing.fromPantry && (
                          <span style={{ fontSize: '9px', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                            In pantry
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Missing items */}
                {recipe.missingIngredients.length > 0 && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--accent-dim)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Missing: </span>
                    {recipe.missingIngredients.join(', ')}
                  </div>
                )}

                {/* Steps */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Steps</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recipe.steps.map((step, j) => (
                      <div key={j} style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                        <span className="mono" style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'var(--accent-dim)', color: 'var(--accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 600, flexShrink: 0,
                        }}>
                          {j + 1}
                        </span>
                        <span style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {recipe.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      border: '1px solid var(--tab-border)',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Expand indicator */}
            <div style={{
              textAlign: 'center',
              marginTop: '8px',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}>
              {isExpanded ? '▲ Less' : '▼ Tap for recipe'}
            </div>
          </Card>
        );
      })}

      {filteredRecipes.length === 0 && (
        <Card className="card-enter stagger-3" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍳</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>No matching recipes</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Try a different filter or add more items to your pantry</div>
        </Card>
      )}
    </div>
  );
}
