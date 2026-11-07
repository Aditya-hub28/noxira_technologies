import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const StudentAuthContext = createContext(null);

export function StudentAuthProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.studentMe()
      .then(data => { if (mounted && data?.student) setStudent(data.student); })
      .catch(() => { /* not logged in */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.studentLogin({ email, password });
    setStudent(data.student);
    return data.student;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await api.studentRegister({ name, email, password });
    setStudent(data.student);
    return data.student;
  }, []);

  const logout = useCallback(async () => {
    try { await api.studentLogout(); } catch (e) { /* clear locally regardless */ }
    setStudent(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.studentMe();
      if (data?.student) setStudent(data.student);
    } catch (e) { /* keep current state */ }
  }, []);

  return (
    <StudentAuthContext.Provider value={{ student, loading, login, register, logout, refresh }}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth() {
  return useContext(StudentAuthContext);
}
