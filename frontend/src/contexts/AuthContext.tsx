import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { GoogleTokenManager } from '../api/googleAuth';
import { ErrorHandlingService } from '../services/ErrorHandlingService';

export interface User {
  id: number;
  email: string;
  name: string;
  picture_url?: string;
  language?: string;
}

interface AuthContextType {
  // Authentication state
  user: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  
  // Authentication methods
  checkAuth: () => Promise<boolean>;
  signOut: () => Promise<void>;
  handleAuthError: (error: any) => Promise<void>;
  
  // Navigation callback for auth errors
  setOnAuthRequired: (callback: () => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [onAuthRequired, setOnAuthRequired] = useState<(() => void) | null>(null);
  
  const errorHandler = ErrorHandlingService.getInstance();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    try {
      setIsAuthLoading(true);
      
      const authResult = await GoogleTokenManager.checkExistingAuth();
      
      if (authResult.isAuthenticated && authResult.user) {
        setUser(authResult.user);
        setIsAuthenticated(true);
        return true;
      } else {
        setUser(null);
        setIsAuthenticated(false);
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await GoogleTokenManager.logout();
      setUser(null);
      setIsAuthenticated(false);
      
      // Navigate to auth screen if callback is set
      if (onAuthRequired) {
        onAuthRequired();
      }
    } catch (error) {
      console.error('Sign out failed:', error);
      errorHandler.logError(error, 'sign_out');
    }
  };

  const handleAuthError = async (error: any): Promise<void> => {
    console.error('Authentication error detected:', error);
    
    // Clear authentication state
    setUser(null);
    setIsAuthenticated(false);
    
    try {
      await GoogleTokenManager.clearAuth();
    } catch (clearError) {
      console.error('Failed to clear auth state:', clearError);
    }

    // Automatically navigate to auth screen
    if (onAuthRequired) {
      onAuthRequired();
    }

    // Log the error
    errorHandler.logError(error, 'auth_error');
  };

  const setOnAuthRequiredCallback = (callback: () => void) => {
    setOnAuthRequired(() => callback);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isAuthLoading,
      checkAuth,
      signOut,
      handleAuthError,
      setOnAuthRequired: setOnAuthRequiredCallback,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 