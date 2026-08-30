import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type {
  User,
  CompanyWithRole,
  LoginDto,
  RegisterDto,
} from './types';
import {
  loginUser,
  registerUser,
  logoutUser,
  getMeProfile,
} from './api';
import { setAccessToken, setActiveCompanyId, getActiveCompanyId } from '../../lib/auth-token';

interface AuthContextType {
  user: User | null;
  companies: CompanyWithRole[];
  activeCompany: CompanyWithRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginDto) => Promise<void>;
  register: (data: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  switchCompany: (companyId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<CompanyWithRole[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyWithRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const switchCompany = (companyId: string) => {
    const selected = companies.find((c) => c.id === companyId);
    if (selected) {
      setActiveCompany(selected);
      setActiveCompanyId(selected.id);
    }
  };

  const handleAuthSuccess = (userData: User, companyList: CompanyWithRole[], token: string) => {
    setUser(userData);
    setCompanies(companyList);
    setAccessToken(token);
    setIsAuthenticated(true);

    const savedCompanyId = getActiveCompanyId();
    const mapped = companyList.find((c) => c.id === savedCompanyId);
    if (mapped) {
      setActiveCompany(mapped);
      setActiveCompanyId(mapped.id);
    } else if (companyList.length > 0) {
      setActiveCompany(companyList[0]);
      setActiveCompanyId(companyList[0].id);
    }
  };

  const clearAuth = () => {
    setUser(null);
    setCompanies([]);
    setActiveCompany(null);
    setAccessToken(null);
    setActiveCompanyId(null);
    setIsAuthenticated(false);
  };

  const login = async (data: LoginDto) => {
    try {
      const result = await loginUser(data);
      handleAuthSuccess(result.user, result.companies, result.accessToken);
    } catch (err) {
      clearAuth();
      throw err;
    }
  };

  const register = async (data: RegisterDto) => {
    try {
      const result = await registerUser(data);
      handleAuthSuccess(result.user, result.companies, result.accessToken);
    } catch (err) {
      clearAuth();
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } finally {
      clearAuth();
    }
  };

  // Run initial session check on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const profile = await getMeProfile();
        setUser(profile.user);
        setCompanies(profile.companies);
        setIsAuthenticated(true);

        const savedCompanyId = getActiveCompanyId();
        const mapped = profile.companies.find((c) => c.id === savedCompanyId);
        if (mapped) {
          setActiveCompany(mapped);
          setActiveCompanyId(mapped.id);
        } else if (profile.companies.length > 0) {
          setActiveCompany(profile.companies[0]);
          setActiveCompanyId(profile.companies[0].id);
        }
      } catch {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    void checkSession();

    // Event listener for async token expiration
    const handleExpired = () => {
      clearAuth();
    };
    window.addEventListener('auth_session_expired', handleExpired);

    return () => {
      window.removeEventListener('auth_session_expired', handleExpired);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        activeCompany,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        switchCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
