import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { studentMe, studentLogin, studentSignup, studentLogout } from '../services/api';

const StudentAuthContext = createContext(null);

export function StudentAuthProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check current student session on mount
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await studentMe();
        if (isMounted && res && res.success && res.student) {
          setStudent(res.student);
        }
      } catch (err) {
        // 401 or network error simply means logged out, no toast or loud error
        if (isMounted) {
          setStudent(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await studentLogin(credentials);
    if (res && res.success && res.student) {
      setStudent(res.student);
    }
    return res;
  }, []);

  const signup = useCallback(async (payload) => {
    const res = await studentSignup(payload);
    if (res && res.success && res.student) {
      setStudent(res.student);
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await studentLogout();
    } catch (err) {
      // Ignore logout errors
    } finally {
      setStudent(null);
    }
  }, []);

  const value = {
    student,
    loading,
    login,
    signup,
    logout
  };

  return (
    <StudentAuthContext.Provider value={value}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth() {
  const context = useContext(StudentAuthContext);
  if (!context) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider');
  }
  return context;
}
