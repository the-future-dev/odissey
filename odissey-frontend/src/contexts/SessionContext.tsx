import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionData, Message, CoherenceState } from '../types';
import {  
  interactWithStory, 
  interactWithStoryStream,
  TokenManager,
  createPersonalizedSession
} from '../api/SessionApi';

interface SessionContextType {
  currentSession: SessionData | null;
  messages: Message[];
  coherenceState: CoherenceState | null;
  isSessionLoading: boolean;
  isInteracting: boolean;
  isStreaming: boolean;
  streamingMessage: string;
  
  // Session management
  startSession: (worldId: string) => Promise<void>;
  endSession: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  sendMessageStream: (message: string) => Promise<void>;
  
  // Session state
  getSessionHistory: () => Message[];
  saveSessionState: () => Promise<void>;
  loadSessionState: (sessionId: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [coherenceState, setCoherenceState] = useState<CoherenceState | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');

  // Session management
  const startSession = async (worldId: string) => {
    setIsSessionLoading(true);
    try {
      const token = await TokenManager.getValidToken();
      const session = await createPersonalizedSession(token, worldId);
      
      setCurrentSession(session);
      
      // Create welcome message
      const welcomeMessage: Message = {
        type: 'narrator',
        text: session.worldState || 'Welcome to your adventure! What would you like to do?',
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
      await persistSessionData(session, [welcomeMessage]);
      
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    } finally {
      setIsSessionLoading(false);
    }
  };

  const endSession = async () => {
    setCurrentSession(null);
    setMessages([]);
    setCoherenceState(null);
    
    // Clear persisted session data
    await clearPersistedSessionData();
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
      
      // Send to backend and get response
      const response = await interactWithStory(token, currentSession.sessionId, message);
      
      // Add narrator response
      const narratorMessage: Message = {
        type: 'narrator',
        text: response.response,
        timestamp: new Date()
      };
      
      const finalMessages = [...updatedMessages, narratorMessage];
      setMessages(finalMessages);
      
      // Persist updated messages
      await persistMessages(finalMessages);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    } finally {
      setIsInteracting(false);
    }
  };

  const sendMessageStream = async (message: string) => {
    if (!currentSession) {
      throw new Error('No active session');
    }
    
    setIsStreaming(true);
    setStreamingMessage('');
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
      
      // Start streaming response
      await interactWithStoryStream(
        token,
        currentSession.sessionId,
        message,
        // onChunk
        (chunk: string) => {
          setStreamingMessage(prev => prev + chunk);
        },
        // onComplete
        (fullResponse: string) => {
          // Add complete narrator response to messages
          const narratorMessage: Message = {
            type: 'narrator',
            text: fullResponse,
            timestamp: new Date()
          };
          
          const finalMessages = [...updatedMessages, narratorMessage];
          setMessages(finalMessages);
          
          // Clear streaming state
          setStreamingMessage('');
          setIsStreaming(false);
          setIsInteracting(false);
          
          // Persist updated messages
          persistMessages(finalMessages);
        },
        // onError
        (error: string) => {
          console.error('Streaming error:', error);
          setStreamingMessage('');
          setIsStreaming(false);
          setIsInteracting(false);
          throw new Error(error);
        }
      );
      
    } catch (error) {
      console.error('Failed to send streaming message:', error);
      setStreamingMessage('');
      setIsStreaming(false);
      setIsInteracting(false);
      
      // Try fallback to regular message sending
      console.log('Attempting fallback to regular message sending');
      try {
        await sendMessage(message);
      } catch (fallbackError) {
        console.error('Both streaming and fallback messaging failed:', fallbackError);
        throw fallbackError;
      }
    }
  };

  // Utility functions for state management
  const getSessionHistory = (): Message[] => {
    return messages;
  };

  const saveSessionState = async () => {
    if (currentSession && messages.length > 0) {
      await persistSessionData(currentSession, messages);
    }
  };

  const loadSessionState = async (sessionId: string) => {
    try {
      const { session, sessionMessages } = await getPersistedSessionData();
      
      if (session && sessionMessages && session.sessionId === sessionId) {
        setCurrentSession(session);
        setMessages(sessionMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load session state:', error);
    }
  };

  // Private helper functions for data persistence
  const persistSessionData = async (session: SessionData, sessionMessages: Message[]) => {
    try {
      await AsyncStorage.setItem('odyssey_current_session', JSON.stringify(session));
      await AsyncStorage.setItem('odyssey_session_messages', JSON.stringify(sessionMessages));
    } catch (error) {
      console.error('Failed to persist session data:', error);
    }
  };

  const persistMessages = async (sessionMessages: Message[]) => {
    try {
      await AsyncStorage.setItem('odyssey_session_messages', JSON.stringify(sessionMessages));
    } catch (error) {
      console.error('Failed to persist messages:', error);
    }
  };

  const getPersistedSessionData = async () => {
    try {
      const savedSession = await AsyncStorage.getItem('odyssey_current_session');
      const savedMessages = await AsyncStorage.getItem('odyssey_session_messages');
      
      return {
        session: savedSession ? JSON.parse(savedSession) : null,
        sessionMessages: savedMessages ? JSON.parse(savedMessages) : null
      };
    } catch (error) {
      console.error('Failed to get persisted session data:', error);
      return { session: null, sessionMessages: null };
    }
  };

  const clearPersistedSessionData = async () => {
    try {
      await AsyncStorage.removeItem('odyssey_current_session');
      await AsyncStorage.removeItem('odyssey_session_messages');
    } catch (error) {
      console.error('Failed to clear persisted session data:', error);
    }
  };

  // Initialize any persisted session on app start
  useEffect(() => {
    const loadPersistedSession = async () => {
      try {
        const { session, sessionMessages } = await getPersistedSessionData();
        
        if (session && sessionMessages) {
          setCurrentSession(session);
          setMessages(sessionMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
        }
      } catch (error) {
        console.error('Failed to load persisted session:', error);
      }
    };

    loadPersistedSession();
  }, []);

  // Auto-save session state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveSessionState();
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [currentSession, messages]);

  const value = {
    currentSession,
    messages,
    coherenceState,
    isSessionLoading,
    isInteracting,
    isStreaming,
    streamingMessage,
    startSession,
    endSession,
    sendMessage,
    sendMessageStream,
    getSessionHistory,
    saveSessionState,
    loadSessionState
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