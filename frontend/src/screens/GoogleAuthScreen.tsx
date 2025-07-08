import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { API_URL } from '../config';
import { GoogleTokenManager } from '../api/googleAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'GoogleAuth'>;

export const GoogleAuthScreen: React.FC<Props> = ({ navigation }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const existingAuth = await GoogleTokenManager.checkExistingAuth();
      if (existingAuth.isAuthenticated && existingAuth.user) {
        setUser(existingAuth.user);
        // Navigate to world selection if already authenticated
        navigation.replace('WorldSelection');
      }
    } catch (error) {
      console.warn('Failed to check existing auth:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);

      const authUrl = `${API_URL}/auth/google`;
      
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Browser: Use popup with event listeners
        await handleBrowserAuth(authUrl);
      } else {
        // Mobile: Use Linking with focus detection
        const supported = await Linking.canOpenURL(authUrl);
        if (supported) {
          await Linking.openURL(authUrl);
          setupMobileAuthListener();
        } else {
          throw new Error('Cannot open authentication URL');
        }
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      setAuthError('Failed to start authentication. Please try again.');
      setIsAuthenticating(false);
    }
  };

  const handleBrowserAuth = async (authUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Open popup
      const popup = window.open(
        authUrl,
        'google-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups and try again.'));
        return;
      }

      let resolved = false;

      // Listen for postMessage from popup
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== new URL(authUrl).origin) return;
        
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          if (!resolved) {
            resolved = true;
            cleanup();
            // Store the auth data immediately from the message
            if (event.data.token) {
              GoogleTokenManager.storeToken(event.data.token);
            }
            if (event.data.user) {
              GoogleTokenManager.storeUser(event.data.user);
              handleAuthSuccess(event.data.user);
            } else {
              handleAuthSuccess();
            }
            resolve();
          }
        }
      };

      // Use periodic auth checking instead of popup.closed (which triggers COOP errors)
      const authChecker = setInterval(async () => {
        if (!resolved) {
          const authResult = await GoogleTokenManager.checkExistingAuth();
          if (authResult.isAuthenticated && authResult.user) {
            resolved = true;
            cleanup();
            handleAuthSuccess(authResult.user);
            resolve();
          }
        }
      }, 1000);

      const cleanup = () => {
        window.removeEventListener('message', messageListener);
        clearInterval(authChecker);
        // Close popup without checking .closed property to avoid COOP errors
        try {
          popup.close();
        } catch (error) {
          // Ignore any errors when closing popup
        }
      };

      window.addEventListener('message', messageListener);

      // Timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error('Authentication timed out'));
        }
      }, 300000); // 5 minutes
    });
  };

  const setupMobileAuthListener = () => {
    // For mobile apps, listen for app focus events
    const handleAppStateChange = async () => {
      await checkAuthCompletion();
    };

    // Simple timeout check for mobile
    setTimeout(async () => {
      await checkAuthCompletion();
    }, 5000);
  };

  const checkAuthCompletion = async () => {
    try {
      const authResult = await GoogleTokenManager.checkExistingAuth();
      if (authResult.isAuthenticated && authResult.user) {
        handleAuthSuccess(authResult.user);
        return true;
      }
      
      // If still no auth after popup close, show error
      if (isAuthenticating) {
        setAuthError('Authentication was not completed. Please try again.');
        setIsAuthenticating(false);
      }
      return false;
    } catch (error) {
      console.warn('Auth completion check failed:', error);
      if (isAuthenticating) {
        setAuthError('Authentication verification failed. Please try again.');
        setIsAuthenticating(false);
      }
      return false;
    }
  };

  const handleAuthSuccess = (user?: any) => {
    setIsAuthenticating(false);
    if (user) setUser(user);
    navigation.replace('WorldSelection');
  };

  const handleTryAgain = () => {
    setAuthError(null);
    setIsAuthenticating(false);
    setIsCheckingAuth(false);
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
            <Text style={styles.errorText}>⚠️ Authentication Failed</Text>
            <Text style={styles.errorDescription}>{authError}</Text>
          </View>

          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleTryAgain}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
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
            <Text style={styles.googleButtonText}>🔐 Sign in with Google</Text>
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
}); 