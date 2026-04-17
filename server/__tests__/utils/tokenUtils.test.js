const crypto = require('crypto');
const { generateToken, hashToken } = require('../../utils/tokenUtils');

describe('tokenUtils', () => {
  it('generateToken should return a 64-character hex token', () => {
    const token = generateToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(token).toHaveLength(64);
  });

  it('generateToken should generate different values across calls', () => {
    const tokenA = generateToken();
    const tokenB = generateToken();

    expect(tokenA).not.toBe(tokenB);
  });

  it('hashToken should produce deterministic sha256 hash output', () => {
    const token = 'reset-token-123';
    const expected = crypto.createHash('sha256').update(token).digest('hex');

    expect(hashToken(token)).toBe(expected);
  });

  it('hashToken should produce different hashes for different tokens', () => {
    const hashA = hashToken('token-a');
    const hashB = hashToken('token-b');

    expect(hashA).not.toBe(hashB);
  });
});