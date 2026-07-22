const sites = require('./_data/sites.json');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  // Count by category
  const categories = {};
  Object.values(sites).forEach(site => {
    const cat = site.category || 'misc';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const categoryList = Object.entries(categories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.status(200).json({
    total: Object.keys(sites).length,
    categories: categoryList
  });
};
