import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { API_URL } from '../config';
import { GoogleTokenManager } from '../api/googleAuth';
import { CrossPlatformOAuthService } from '../services/CrossPlatformOAuthService';
import { ErrorHandlingService, ErrorDisplayInfo } from '../services/ErrorHandlingService';

type Props = NativeStackScreenProps<RootStackParamList, 'GoogleAuth'>;

export const GoogleAuthScreen: React.FC<Props> = ({ navigation }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [errorInfo, setErrorInfo] = useState<ErrorDisplayInfo | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const oauthService = CrossPlatformOAuthService.getInstance();
  const errorHandler = ErrorHandlingService.getInstance();

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const existingAuth = await oauthService.checkExistingAuth();
      if (existingAuth.isAuthenticated && existingAuth.user) {
        setUser(existingAuth.user);
        // Navigate to world selection if already authenticated
        navigation.replace('MainTabs');
      }
    } catch (error) {
      // Failed to check existing auth, proceed with normal flow
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Prevent multiple simultaneous attempts
    if (oauthService.isAuthenticationInProgress()) {
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);
      
      const result = await oauthService.authenticate();
      
      if (result.success) {
        setUser(result.user);
        setErrorInfo(null);
        setRetryAttempts(0);
        handleAuthSuccess(result.user);
      } else if (result.cancelled) {
        setAuthError('Authentication was cancelled. Please try again.');
        setErrorInfo(null);
      } else {
        const errorDisplayInfo = errorHandler.getErrorDisplayInfo(new Error(result.error || 'Authentication failed'));
        setErrorInfo(errorDisplayInfo);
        setAuthError(errorDisplayInfo.message);
        setRetryAttempts(prev => prev + 1);
      }
    } catch (error) {
      errorHandler.logError(error, 'google_signin');
      const errorDisplayInfo = errorHandler.getErrorDisplayInfo(error);
      setErrorInfo(errorDisplayInfo);
      setAuthError(errorDisplayInfo.message);
      setRetryAttempts(prev => prev + 1);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAuthSuccess = async (user?: any) => {
    setIsAuthenticating(false);
    if (user) setUser(user);
    
    navigation.replace('MainTabs');
  };

  const handleTryAgain = async () => {
    setAuthError(null);
    setErrorInfo(null);
    setIsAuthenticating(false);
    setIsCheckingAuth(false);
    
    // Clear any existing auth state if this is a retry after multiple attempts
    if (retryAttempts > 2) {
      try {
        await oauthService.signOut();
        setRetryAttempts(0);
      } catch (error) {
        errorHandler.logError(error, 'clear_auth_state');
      }
    }
  };

  const handleRetryAuthentication = async () => {
    if (errorInfo?.retryable) {
      await handleGoogleSignIn();
    } else {
      await handleTryAgain();
    }
  };

  // Loading state while checking existing auth
  if (isCheckingAuth) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.statusText}>Checking authentication...</Text>
      </View>
    );
  }

  // Authentication in progress
  if (isAuthenticating) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Odyssey</Text>
            <Text style={styles.subtitle}>AI-Powered Storytelling</Text>
          </View>

          <View style={styles.authContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.authText}>Authenticating...</Text>
            <Text style={styles.authSubtext}>
              Complete the sign-in in your browser. We'll bring you back automatically!
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={handleTryAgain}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Error state
  if (authError) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Odyssey</Text>
            <Text style={styles.subtitle}>AI-Powered Storytelling</Text>
          </View>

          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {errorInfo?.severity === 'critical' ? '🚫' : 
               errorInfo?.severity === 'high' ? '⚠️' : 
               errorInfo?.retryable ? '🔄' : '❌'} {errorInfo?.title || 'Authentication Failed'}
            </Text>
            <Text style={styles.errorDescription}>{authError}</Text>
            
            {retryAttempts > 1 && (
              <Text style={styles.retryInfo}>
                Attempt {retryAttempts}/3
              </Text>
            )}
            
            {errorInfo?.userFriendlyCode && (
              <Text style={styles.errorCode}>
                Error Code: {errorInfo.userFriendlyCode}
              </Text>
            )}
          </View>

          <View style={styles.errorActions}>
            {errorInfo?.retryable && (
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={handleRetryAuthentication}
              >
                <Text style={styles.primaryButtonText}>
                  {retryAttempts > 1 ? 'Retry Authentication' : 'Try Again'}
                </Text>
              </TouchableOpacity>
            )}
            
            {!errorInfo?.retryable || retryAttempts > 2 ? (
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={handleTryAgain}
              >
                <Text style={styles.secondaryButtonText}>Start Over</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  // Main authentication screen
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome to Odyssey</Text>
          <Text style={styles.subtitle}>AI-Powered Interactive Storytelling</Text>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>
            Have you ever wanted to be a wizard in the Harry Potter world? 
            Odyssey lets you become the first character in your favorite stories!
          </Text>
          
          <View style={styles.pocBadge}>
            <Text style={styles.pocBadgeText}>✨ PROOF OF CONCEPT ✨</Text>
          </View>
        </View>

        <View style={styles.authContainer}>
          <TouchableOpacity 
            style={styles.googleButton} 
            onPress={handleGoogleSignIn}
            disabled={isAuthenticating}
          >
            <Text style={styles.googleButtonText}>
              🔐 Sign in with Google
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.authNote}>
            Welcome to Odyssey!
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1B4B',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#C7D2FE',
    textAlign: 'center',
  },
  descriptionContainer: {
    marginVertical: 24,
  },
  description: {
    fontSize: 16,
    color: '#E0E7FF',
    textAlign: 'center',
    lineHeight: 24,
  },
  pocBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8B5CF6',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  pocBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8B5CF6',
    letterSpacing: 1,
  },
  authContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 16,
    minWidth: 250,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  authNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  authText: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  authSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  errorContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: '#FCA5A5',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
    alignSelf: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
    textAlign: 'center',
  },
  retryInfo: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorCode: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  errorActions: {
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignSelf: 'center',
  },
  secondaryButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 