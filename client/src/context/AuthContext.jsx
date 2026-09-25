import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe, loginUser, registerUser } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('userToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('userToken');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await getMe();
        if (res.data && res.data.user) {
          setUser(res.data.user);
          setToken(storedToken);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Session check failed:', err.response?.data?.error || err.message);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await loginUser({ email, password });
    const { token: receivedToken, user: receivedUser } = res.data;
    localStorage.setItem('userToken', receivedToken);
    setToken(receivedToken);
    setUser(receivedUser);
    return receivedUser;
  };

  const register = async (name, email, password) => {
    const res = await registerUser({ name, email, password });
    const { token: receivedToken, user: receivedUser } = res.data;
    localStorage.setItem('userToken', receivedToken);
    setToken(receivedToken);
    setUser(receivedUser);
    return receivedUser;
  };

  const logout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('hostToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
