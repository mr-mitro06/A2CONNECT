import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const USERS = {
  'abhi123': { id: 'user_abhi', name: 'Abhi', role: 'admin' },
  'arya123': { id: 'user_arya', name: 'Arya', role: 'admin' }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from local storage on mount
  useEffect(() => {
    const savedCode = localStorage.getItem('shadowtalk_session');
    if (savedCode && USERS[savedCode]) {
      setUser(USERS[savedCode]);
    }
    setIsLoading(false);
  }, []);

  const login = (code) => {
    if (USERS[code]) {
      const loggedInUser = USERS[code];
      setUser(loggedInUser);
      localStorage.setItem('shadowtalk_session', code);
      return { success: true, user: loggedInUser };
    }
    return { success: false, error: 'Invalid access code' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('shadowtalk_session');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
