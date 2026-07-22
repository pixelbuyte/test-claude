const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_.-]{1,30}$/;

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  if (!VALID_USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      error: 'Username must be 1-30 characters (letters, numbers, ._-)'
    };
  }

  return { valid: true };
}

module.exports = { validateUsername, VALID_USERNAME_REGEX };
