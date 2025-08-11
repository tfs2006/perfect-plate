function buildGroceryList(plan){
  const f = new Map();
  (plan.days || []).forEach(d =>
    (d.meals || []).forEach(m =>
      (m.items || []).forEach(it => {
        const name = (it.title || '').toLowerCase();
        if (!name) return;
        const key = name.split(/[,+()\-\u2013]/)[0].trim();
        if (!key) return;
        f.set(key, (f.get(key) || 0) + 1);
      })
    )
  );
  return Array.from(f.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([item, count]) => ({ item, count }));
}