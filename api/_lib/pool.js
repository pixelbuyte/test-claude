async function runPool(items, concurrency, worker) {
  let i = 0;
  const results = new Array(items.length);

  async function runner() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch (err) {
        results[idx] = {
          status: 'unknown',
          reason: 'worker_error',
          error: err.message
        };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runner()
  );

  await Promise.all(workers);
  return results;
}

module.exports = { runPool };
