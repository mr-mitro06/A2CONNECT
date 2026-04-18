import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    const savedCode = localStorage.getItem('a2connect_session');
    if (savedCode && USERS[savedCode]) {
      const baseUser = USERS[savedCode];
      // Fetch fresh data from DB
      supabase.from('users').select('*').eq('id', baseUser.id).single()
        .then(({ data }) => {
          if (data) setUser({ ...baseUser, ...data });
          else setUser(baseUser);
        });
    }
    setIsLoading(false);
  }, []);

  const login = async (code) => {
    if (USERS[code]) {
      const baseUser = USERS[code];
      const { data: dbUser } = await supabase.from('users').select('*').eq('id', baseUser.id).single();
      const loggedInUser = dbUser ? { ...baseUser, ...dbUser } : baseUser;
      
      setUser(loggedInUser);
      localStorage.setItem('a2connect_session', code);
      return { success: true, user: loggedInUser };
    }
    return { success: false, error: 'Invalid access code' };
  };

  const refreshUser = async () => {
    if (!user) return;
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) setUser(prev => ({ ...prev, ...data }));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('a2connect_session');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
