const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function checkSite(site, username, batchDeadlineAt) {
  const now = Date.now();

  if (now > batchDeadlineAt) {
    return {
      status: 'unknown',
      reason: 'deadline_exceeded',
      httpStatus: null
    };
  }

  // Check regex constraint
  if (site.regexCheck) {
    try {
      const regex = new RegExp(site.regexCheck);
      if (!regex.test(username)) {
        return {
          status: 'skipped',
          reason: 'regex_mismatch',
          httpStatus: null
        };
      }
    } catch (e) {
      return {
        status: 'skipped',
        reason: 'invalid_regex',
        httpStatus: null
      };
    }
  }

  // Build final URL
  let finalUrl;
  try {
    const encoded = encodeURIComponent(username);
    finalUrl = site.url.replace('{}', encoded);

    // SSRF guard: verify host didn't change
    const templateHost = new URL(site.url.replace('{}', 'x')).host;
    const finalHost = new URL(finalUrl).host;

    if (templateHost !== finalHost) {
      return {
        status: 'unknown',
        reason: 'host_mismatch_rejected',
        httpStatus: null
      };
    }
  } catch (e) {
    return {
      status: 'unknown',
      reason: 'url_build_failed',
      httpStatus: null
    };
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeoutMs = Math.min(4500, Math.max(1000, batchDeadlineAt - Date.now()));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetchStart = Date.now();

  try {
    const response = await fetch(finalUrl, {
      method: site.request_method || 'GET',
      headers: {
        'User-Agent': DEFAULT_UA,
        ...(site.headers || {})
      },
      body: site.request_method === 'POST' ? JSON.stringify(site.request_payload || {}) : undefined,
      redirect: 'follow',
      signal: controller.signal,
      timeout: timeoutMs
    });

    const responseTimeMs = Date.now() - fetchStart;

    switch (site.errorType) {
      case 'status_code': {
        const notFoundCode = site.errorCode || 404;
        if (response.status === notFoundCode) {
          return { status: 'not_found', reason: null, httpStatus: response.status, responseTimeMs };
        }
        if (response.ok) {
          return { status: 'found', reason: null, httpStatus: response.status, responseTimeMs };
        }
        return {
          status: 'unknown',
          reason: 'unexpected_status',
          httpStatus: response.status,
          responseTimeMs
        };
      }

      case 'message': {
        if (response.status >= 500 || response.status === 403) {
          return {
            status: 'unknown',
            reason: 'server_error',
            httpStatus: response.status,
            responseTimeMs
          };
        }

        try {
          const body = await readTextCapped(response, 200000);
          const errorMsgs = Array.isArray(site.errorMsg) ? site.errorMsg : [site.errorMsg];

          const isNotFound = errorMsgs.some(msg => body.includes(msg));

          if (isNotFound) {
            return { status: 'not_found', reason: null, httpStatus: response.status, responseTimeMs };
          }

          if (response.ok) {
            return { status: 'found', reason: null, httpStatus: response.status, responseTimeMs };
          }

          return {
            status: 'unknown',
            reason: 'unexpected_status',
            httpStatus: response.status,
            responseTimeMs
          };
        } catch (e) {
          return {
            status: 'unknown',
            reason: 'body_read_failed',
            httpStatus: response.status,
            responseTimeMs
          };
        }
      }

      case 'response_url': {
        if (!response.ok) {
          return {
            status: 'unknown',
            reason: 'unexpected_status',
            httpStatus: response.status,
            responseTimeMs
          };
        }

        const normalizedFinal = normalizeUrl(finalUrl);
        const normalizedResponse = normalizeUrl(response.url);

        if (normalizedFinal !== normalizedResponse) {
          return { status: 'not_found', reason: null, httpStatus: response.status, responseTimeMs };
        }

        return { status: 'found', reason: null, httpStatus: response.status, responseTimeMs };
      }

      default:
        return {
          status: 'unknown',
          reason: 'unsupported_error_type',
          httpStatus: null
        };
    }
  } catch (err) {
    const responseTimeMs = Date.now() - fetchStart;

    if (err.name === 'AbortError') {
      return {
        status: 'unknown',
        reason: 'timeout',
        httpStatus: null,
        responseTimeMs
      };
    }

    return {
      status: 'unknown',
      reason: 'network_error',
      httpStatus: null,
      responseTimeMs
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

async function readTextCapped(response, maxBytes) {
  const chunk = await response.text();
  return chunk.slice(0, maxBytes);
}

module.exports = { checkSite };
