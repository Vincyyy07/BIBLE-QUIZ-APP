/**
 * Quiz Code Generator
 * Generates readable, unambiguous quiz codes.
 * Excludes: O (looks like 0), I (looks like 1), S (looks like 5), L
 */

const SAFE_CHARS = 'ABCDEFGHJKMNPQRTUVWXYZ23456789';

/**
 * Generate a random quiz code of specified length
 * @param {number} length - Code length (default 6)
 * @returns {string} - e.g. "BIBLE7", "GRACE4"
 */
const generateCode = (length = 6) => {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return code;
};

/**
 * Generate a unique quiz code that doesn't already exist in DB
 * @param {Function} checkExists - async fn(code) => boolean
 * @returns {string} - unique code
 */
const generateUniqueCode = async (checkExists) => {
  let code;
  let attempts = 0;
  do {
    code = generateCode(6);
    attempts++;
    if (attempts > 100) {
      // Fallback to longer code to avoid infinite loop
      code = generateCode(8);
    }
  } while (await checkExists(code));
  return code;
};

module.exports = { generateCode, generateUniqueCode };
