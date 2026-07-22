module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed', message: 'Use POST request' });
    return;
  }

  try {
    const { imageUrl, imageBase64 } = req.body || {};

    if (!imageUrl && !imageBase64) {
      res.status(400).json({
        error: 'invalid_input',
        message: 'Provide either imageUrl or imageBase64'
      });
      return;
    }

    // For now, return a placeholder response
    // In production, this would call Yandex Images or similar
    // Since we're in a sandboxed environment, actual image search may be blocked

    res.status(200).json({
      results: [],
      message: 'Reverse image search requires network access to external services. Please upload via the web interface.',
      method: 'yandex-images-placeholder'
    });
  } catch (err) {
    res.status(500).json({
      error: 'internal_error',
      message: err.message
    });
  }
};
