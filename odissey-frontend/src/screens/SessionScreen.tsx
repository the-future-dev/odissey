import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useSession } from '../contexts/SessionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

interface ParsedOption {
  number: number;
  text: string;
}

export const SessionScreen: React.FC<Props> = ({ route, navigation }) => {
  const { worldId, worldTitle } = route.params;
  const { 
    currentSession, 
    messages, 
    isSessionLoading, 
    isInteracting,
    isStreaming,
    streamingMessage,
    startSession,
    sendMessage: sendSessionMessage,
    sendMessageStream 
  } = useSession();
  const [inputText, setInputText] = useState('');
  const [availableOptions, setAvailableOptions] = useState<ParsedOption[]>([]);
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const dotsOpacity = useRef(new Animated.Value(0.3)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Parse options from the latest narrator message
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.type === 'narrator') {
      const options = parseOptionsFromText(lastMessage.text);
      setAvailableOptions(options);
    } else if (isStreaming && streamingMessage) {
      const options = parseOptionsFromText(streamingMessage);
      setAvailableOptions(options);
    }
  }, [messages, streamingMessage]);

  const parseOptionsFromText = (text: string): ParsedOption[] => {
    const lines = text.split('\n');
    const options: ParsedOption[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Match patterns like "1) Some text" or "1. Some text" or "1 - Some text"
      const match = trimmed.match(/^(\d+)[\)\.\-\s]+(.+)$/);
      if (match) {
        const number = parseInt(match[1]);
        const text = match[2].trim();
        if (number >= 1 && number <= 10 && text.length > 0) { // Support up to 10 options
          options.push({ number, text });
        }
      }
    }
    
    return options;
  };

  const handleOptionSelect = (option: ParsedOption) => {
    // Set the input to show the selected option
    setInputText(`${option.number}) ${option.text}`);
  };

  const handleQuickSend = async (optionText: string) => {
    if (isInteracting) return;

    try {
      await sendMessageStream(optionText);
    } catch (error) {
      console.error('Failed to send option:', error);
    }
  };

  useEffect(() => {
    // Only start a new session if we don't have a current session
    // or if the current session is for a different world
    if (!currentSession || currentSession.worldId !== worldId) {
      initializeSession();
    }
  }, [worldId]);

  // Cursor blinking animation
  useEffect(() => {
    if (isStreaming) {
      const blink = () => {
        Animated.sequence([
          Animated.timing(cursorOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false, // Use JS driver for web compatibility
          }),
          Animated.timing(cursorOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
        ]).start(blink);
      };
      blink();
    } else {
      cursorOpacity.setValue(1);
    }
  }, [isStreaming]);

  // Thinking dots animation
  useEffect(() => {
    if (isInteracting && !isStreaming) {
      const animate = () => {
        Animated.sequence([
          Animated.timing(dotsOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false, // Use JS driver for web compatibility
          }),
          Animated.timing(dotsOpacity, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: false,
          }),
        ]).start(animate);
      };
      animate();
    } else {
      dotsOpacity.setValue(0.3);
    }
  }, [isInteracting, isStreaming]);

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, streamingMessage]);

  const initializeSession = async () => {
    try {
      await startSession(worldId);
    } catch (error) {
      console.error('Failed to create session:', error);
      // You could add a user-friendly error state here
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isInteracting) return;

    const messageToSend = inputText.trim();
    setInputText(''); // Clear input immediately for better UX

    try {
      // Use streaming for a better experience
      await sendMessageStream(messageToSend);
    } catch (error) {
      console.error('Streaming and all fallbacks failed:', error);
      // Restore input text if all methods fail
      setInputText(messageToSend);
    }
  };

  if (isSessionLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Starting your adventure...</Text>
      </View>
    );
  }

  // Add error state if session failed to load
  if (!currentSession) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to start adventure</Text>
        <TouchableOpacity 
          style={styles.errorButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorButtonText}>← Back to Worlds</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={initializeSession}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{worldTitle || 'Adventure'}</Text>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message, index) => (
          <View 
            key={index} 
            style={[
              styles.messageCard,
              message.type === 'user' ? styles.userMessage : styles.narratorMessage
            ]}
          >
            <Text style={[
              styles.messageText,
              message.type === 'user' ? styles.userMessageText : styles.narratorMessageText
            ]}>
              {message.text}
            </Text>
          </View>
        ))}
        {isStreaming && streamingMessage && (
          <View style={[styles.messageCard, styles.narratorMessage, styles.streamingMessage]}>
            <View style={styles.streamingTextContainer}>
              <Text style={styles.narratorMessageText}>{streamingMessage}</Text>
              <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>|</Animated.Text>
            </View>
          </View>
        )}
        {isInteracting && !isStreaming && (
          <View style={[styles.messageCard, styles.narratorMessage]}>
            <View style={styles.thinkingTextContainer}>
              <Text style={styles.narratorMessageText}>The narrator is thinking</Text>
              <Animated.Text style={[styles.thinkingDots, { opacity: dotsOpacity }]}>...</Animated.Text>
            </View>
          </View>
        )}

        {/* Show option buttons when available */}
        {availableOptions.length > 0 && !isInteracting && (
          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>Quick Actions:</Text>
            {availableOptions.map((option) => (
              <TouchableOpacity
                key={option.number}
                style={styles.optionButton}
                onPress={() => handleQuickSend(`${option.number}) ${option.text}`)}
              >
                <Text style={styles.optionNumber}>{option.number}</Text>
                <Text style={styles.optionText}>{option.text}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.optionsHint}>Or type your own response below</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Choose an option above or type your own action..."
          multiline
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity 
          style={[styles.sendButton, (!inputText.trim() || isInteracting) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isInteracting}
        >
          <Text style={styles.sendButtonText}>
            {isStreaming ? 'Streaming...' : isInteracting ? 'Sending...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  backButton: {
    fontSize: 16,
    color: '#8B5CF6',
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#8B5CF6',
  },
  narratorMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  narratorMessageText: {
    color: '#1E293B',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#A1A1AA',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  streamingMessage: {
    backgroundColor: '#F8F9FF',
    borderColor: '#8B5CF6',
    borderWidth: 2,
    boxShadow: '0px 2px 4px rgba(139, 92, 246, 0.1)',
    elevation: 2,
  },
  cursor: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  thinkingDots: {
    color: '#8B5CF6',
    fontSize: 16,
  },
  streamingTextContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  thinkingTextContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  optionsContainer: {
    padding: 16,
    backgroundColor: '#F8F9FF',
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginRight: 8,
    minWidth: 20,
  },
  optionText: {
    fontSize: 16,
    color: '#1E293B',
    flex: 1,
    lineHeight: 22,
  },
  optionsHint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
}); 