import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('pd_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('pd_token');
      const storedUser = localStorage.getItem('pd_user');

      if (storedToken && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          const res = await authAPI.getMe();
          setUser(res.data);
          localStorage.setItem('pd_user', JSON.stringify(res.data));
        } catch {
          localStorage.removeItem('pd_token');
          localStorage.removeItem('pd_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('pd_token', newToken);
    localStorage.setItem('pd_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const register = useCallback(async (data) => {
    const res = await authAPI.register(data);
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('pd_token', newToken);
    localStorage.setItem('pd_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pd_token');
    localStorage.removeItem('pd_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.getMe();
      const freshUser = res.data;
      setUser(freshUser);
      localStorage.setItem('pd_user', JSON.stringify(freshUser));
      return freshUser;
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
      return null;
    }
  }, []);

  const updateProfile = useCallback(async (data) => {
    const res = await authAPI.updateProfile(data);
    const updated = res.data;
    setUser(updated);
    localStorage.setItem('pd_user', JSON.stringify(updated));
    return updated;
  }, []);

  const isAuthenticated = !!token && !!user;
  const isCustomer = user?.role === 'customer';
  const isOwner = user?.role === 'shop_owner';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, updateProfile, isAuthenticated, isCustomer, isOwner, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
