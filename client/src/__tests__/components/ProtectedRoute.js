import { isAuthenticated, getUser, getUserRole, logout } from '../../components/ProtectedRoute';

describe('ProtectedRoute auth helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when token or user is missing', () => {
    localStorage.setItem('token', 'token-only');
    expect(isAuthenticated()).toBe(false);

    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ role: 'student' }));
    expect(isAuthenticated()).toBe(false);
  });

  it('returns true when token and valid user are present', () => {
    localStorage.setItem('token', 'token-value');
    localStorage.setItem('user', JSON.stringify({ role: 'teacher', name: 'Test' }));

    expect(isAuthenticated()).toBe(true);
    expect(getUser()).toEqual({ role: 'teacher', name: 'Test' });
    expect(getUserRole()).toBe('teacher');
  });

  it('clears invalid user JSON and treats session as unauthenticated', () => {
    localStorage.setItem('token', 'token-value');
    localStorage.setItem('user', '{invalid-json');

    expect(getUser()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('logout clears stored auth information', () => {
    localStorage.setItem('token', 'token-value');
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));

    logout();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});