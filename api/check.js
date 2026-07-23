const { validateUsername } = require('./_lib/validateUsername');
const { checkSite } = require('./_lib/checkSite');
const { runPool } = require('./_lib/pool');
const sites = require('./_data/sites.json');

const BATCH_DEADLINE_MS = 8500;
const SERVER_CONCURRENCY = 6;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed', message: 'Use GET request' });
    return;
  }

  const { username, offset, limit } = req.query;

  // Validate username
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    res.status(400).json({
      error: 'invalid_username',
      message: usernameCheck.error
    });
    return;
  }

  // Validate offset
  let offsetNum = parseInt(offset, 10);
  if (isNaN(offsetNum) || offsetNum < 0) {
    res.status(400).json({
      error: 'invalid_range',
      message: 'offset must be a non-negative integer'
    });
    return;
  }

  // Validate limit
  let limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 12) {
    res.status(400).json({
      error: 'invalid_range',
      message: 'limit must be between 1 and 12'
    });
    return;
  }

  const siteNames = Object.keys(sites);
  const total = siteNames.length;

  // Return empty if out of range
  if (offsetNum >= total) {
    res.status(200).json({
      username,
      offset: offsetNum,
      limit: limitNum,
      total,
      results: []
    });
    return;
  }

  // Slice sites for this batch
  const batchSiteNames = siteNames.slice(offsetNum, offsetNum + limitNum);
  const batchSites = batchSiteNames.map(name => ({
    name,
    ...sites[name]
  }));

  // Set up deadline
  const batchDeadlineAt = Date.now() + BATCH_DEADLINE_MS;

  // Check sites concurrently
  const results = await runPool(
    batchSites,
    SERVER_CONCURRENCY,
    site => checkSite(site, username, batchDeadlineAt)
  );

  // Format results
  const formattedResults = batchSites.map((site, idx) => {
    const checkResult = results[idx] || {};
    return {
      site: site.name,
      category: site.category,
      url: site.url.replace('{}', encodeURIComponent(username)),
      urlMain: site.urlMain,
      status: checkResult.status || 'unknown',
      reason: checkResult.reason || null,
      httpStatus: checkResult.httpStatus || null,
      responseTimeMs: checkResult.responseTimeMs || 0,
      isNSFW: site.isNSFW || false
    };
  });

  res.status(200).json({
    username,
    offset: offsetNum,
    limit: limitNum,
    total,
    results: formattedResults
  });
};
