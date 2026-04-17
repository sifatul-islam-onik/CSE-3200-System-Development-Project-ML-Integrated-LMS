jest.mock('axios', () => ({
  interceptors: {
    response: {
      use: jest.fn(),
    },
  },
}));

const { getToken, saveToken, clearToken, hasToken } = require('../../utils/tokenUtils');

describe('tokenUtils storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveToken stores token and getToken returns it', () => {
    saveToken('jwt-token-value');

    expect(getToken()).toBe('jwt-token-value');
    expect(hasToken()).toBe(true);
  });

  it('saveToken ignores empty values', () => {
    saveToken('');

    expect(getToken()).toBeNull();
    expect(hasToken()).toBe(false);
  });

  it('clearToken removes both token and user data', () => {
    localStorage.setItem('token', 'abc');
    localStorage.setItem('user', JSON.stringify({ role: 'student' }));

    clearToken();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(hasToken()).toBe(false);
  });
});