import { useState } from 'react';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { FOOD_EMOJI } from '../types';
import type { FoodCategory, ShoppingItem } from '../types';

export function ShoppingListScreen() {
  const { shoppingLists, toggleShoppingItem, addShoppingList, removeShoppingList, updateShoppingList, recipes, pantryItems } = useStore();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [addingToList, setAddingToList] = useState<string | null>(null);

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    addShoppingList({
      id: `sl-${Date.now()}`,
      name: newListName.trim(),
      items: [],
      createdDate: new Date().toISOString().split('T')[0],
    });
    setNewListName('');
    setShowNewForm(false);
  };

  const handleAddItemToList = (listId: string) => {
    if (!newItemName.trim()) return;
    const list = shoppingLists.find(l => l.id === listId);
    if (!list) return;

    const newItem: ShoppingItem = {
      id: `si-${Date.now()}`,
      name: newItemName.trim(),
      category: 'Other' as FoodCategory,
      quantity: 1,
      unit: 'pcs',
      checked: false,
    };

    updateShoppingList(listId, {
      items: [...list.items, newItem],
    });
    setNewItemName('');
    setAddingToList(null);
  };

  // Generate smart suggestions based on recipes with missing ingredients
  const suggestions = recipes.flatMap(r =>
    r.missingIngredients.map(ing => ({
      name: ing,
      fromRecipe: r.name,
    }))
  ).filter((s, i, arr) => arr.findIndex(a => a.name === s.name) === i).slice(0, 8);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '-12px' }}>
          <AvocadoMascot size={34} />
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Smart Lists</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Auto-generated shopping lists</p>
          </div>
        </div>
        <button
          className="btn-solid"
          onClick={() => setShowNewForm(true)}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '10px',
            color: 'var(--accent-dark)',
            fontFamily: 'Syne, sans-serif',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          + New List
        </button>
      </div>

      {/* New list form */}
      {showNewForm && (
        <Card className="card-enter">
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Create New List</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              placeholder="List name..."
              onKeyDown={e => e.key === 'Enter' && handleCreateList()}
              autoFocus
              style={{
                flex: 1,
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontFamily: 'Syne, sans-serif',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              className="btn-solid"
              onClick={handleCreateList}
              style={{
                padding: '10px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '10px',
                color: 'var(--accent-dark)',
                fontFamily: 'Syne, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Create
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                border: '1px solid var(--tab-border)',
                borderRadius: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'Syne, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Smart suggestions */}
      {suggestions.length > 0 && (
        <Card className="card-enter stagger-1">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px' }}>💡</span>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Recipe Suggestions</div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Missing ingredients from your saved recipes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                borderRadius: '16px',
                border: '1px solid var(--tab-border)',
                background: 'var(--input-bg)',
                fontSize: '11px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>from {s.fromRecipe}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Shopping lists */}
      {shoppingLists.map((list, idx) => {
        const checkedCount = list.items.filter(i => i.checked).length;
        const totalCount = list.items.length;
        const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

        return (
          <Card key={list.id} className={`card-enter stagger-${Math.min(idx + 2, 6)}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{list.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {checkedCount}/{totalCount} items • {list.createdDate}
                </div>
              </div>
              <button
                onClick={() => removeShoppingList(list.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '14px', padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {totalCount > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <ProgressBar value={progress} color="var(--accent)" height={4} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {list.items.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleShoppingItem(list.id, item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: item.checked ? 'rgba(139, 195, 74, 0.06)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '6px',
                    border: item.checked ? '2px solid var(--accent)' : '2px solid var(--tab-border)',
                    background: item.checked ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}>
                    {item.checked && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: item.checked ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    transition: 'all 0.2s',
                  }}>
                    {FOOD_EMOJI[item.category]} {item.name}
                  </span>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>

            {/* Add item to list */}
            {addingToList === list.id ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="Add item..."
                  onKeyDown={e => e.key === 'Enter' && handleAddItemToList(list.id)}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'Syne, sans-serif',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  className="btn-solid"
                  onClick={() => handleAddItemToList(list.id)}
                  style={{
                    padding: '8px 14px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--accent-dark)',
                    fontFamily: 'Syne, sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingToList(list.id)}
                style={{
                  marginTop: '8px',
                  background: 'none',
                  border: '1px dashed var(--tab-border)',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'Syne, sans-serif',
                  width: '100%',
                }}
              >
                + Add item
              </button>
            )}
          </Card>
        );
      })}

      {shoppingLists.length === 0 && !showNewForm && (
        <Card className="card-enter stagger-2" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📝</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>No shopping lists yet</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Create a list or we'll suggest items based on your recipes!
          </div>
          <button
            className="btn-solid"
            onClick={() => setShowNewForm(true)}
            style={{
              padding: '12px 24px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '12px',
              color: 'var(--accent-dark)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Create Your First List
          </button>
        </Card>
      )}
    </div>
  );
}
