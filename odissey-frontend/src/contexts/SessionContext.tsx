import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionData, Message } from '../types';
import { TokenManager, createSession } from '../api';
import { API_URL } from '../config';

interface SessionContextType {
  currentSession: SessionData | null;
  messages: Message[];
  isSessionLoading: boolean;
  isInteracting: boolean;
  
  // Session management
  startSession: (worldId: string) => Promise<void>;
  resetSession: (worldId: string) => Promise<void>;
  endSession: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEYS = {
  SESSION: 'odyssey_current_session',
  MESSAGES: 'odyssey_session_messages',
} as const;

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  // Load persisted session on mount
  useEffect(() => {
    loadPersistedSession();
  }, []);

  // Auto-save session state when it changes
  useEffect(() => {
    if (currentSession && messages.length > 0) {
      saveSessionState();
    }
  }, [currentSession, messages]);

  const startSession = async (worldId: string) => {
    setIsSessionLoading(true);
    try {
      const token = await TokenManager.getValidToken();
      const session = await createSession(token, worldId);
      
      setCurrentSession(session);
      
      const welcomeMessage: Message = {
        type: 'narrator',
        text: 'Welcome to your adventure! What would you like to do?',
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    } finally {
      setIsSessionLoading(false);
    }
  };

  const resetSession = async (worldId: string) => {
    // Clear current state
    setCurrentSession(null);
    setMessages([]);
    setIsInteracting(false);
    
    // Clear storage
    await clearSessionStorage();
    
    // Start new session
    await startSession(worldId);
  };

  const endSession = async () => {
    setCurrentSession(null);
    setMessages([]);
    setIsInteracting(false);
    
    await clearSessionStorage();
  };

  const sendMessage = async (message: string) => {
    if (!currentSession) {
      throw new Error('No active session');
    }
    
    setIsInteracting(true);
    
    try {
      const token = await TokenManager.getValidToken();
      
      // Add user message immediately
      const userMessage: Message = {
        type: 'user',
        text: message,
        timestamp: new Date()
      };
      
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      
      // Send message and get response
      const response = await fetch(`${API_URL}/sessions/${currentSession.sessionId}/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      const narratorMessage: Message = {
        type: 'narrator',
        text: data.response,
        timestamp: new Date()
      };
      
      const finalMessages = [...updatedMessages, narratorMessage];
      setMessages(finalMessages);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    } finally {
      setIsInteracting(false);
    }
  };

  // Storage helpers
  const saveSessionState = async () => {
    try {
      if (currentSession) {
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentSession));
      }
      if (messages.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
      }
    } catch (error) {
      console.error('Failed to save session state:', error);
    }
  };

  const loadPersistedSession = async () => {
    try {
      const [sessionData, messagesData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SESSION),
        AsyncStorage.getItem(STORAGE_KEYS.MESSAGES)
      ]);
      
      if (sessionData) {
        setCurrentSession(JSON.parse(sessionData));
      }
      
      if (messagesData) {
        const parsedMessages = JSON.parse(messagesData);
        setMessages(parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load persisted session:', error);
    }
  };

  const clearSessionStorage = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.SESSION),
        AsyncStorage.removeItem(STORAGE_KEYS.MESSAGES)
      ]);
    } catch (error) {
      console.error('Failed to clear session storage:', error);
    }
  };

  const value: SessionContextType = {
    currentSession,
    messages,
    isSessionLoading,
    isInteracting,
    startSession,
    resetSession,
    endSession,
    sendMessage,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}; 