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
    startSession,
    resetSession,
    sendMessage 
  } = useSession();

  const [inputText, setInputText] = useState('');
  const [availableOptions, setAvailableOptions] = useState<ParsedOption[]>([]);
  const dotsOpacity = useRef(new Animated.Value(0.3)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize session when component mounts or worldId changes
  useEffect(() => {
    if (!currentSession || currentSession.worldId !== worldId) {
      initializeSession();
    }
  }, [worldId]);

  // Parse options from latest narrator message
  useEffect(() => {
    const textToParse = messages.length > 0 && messages[messages.length - 1]?.type === 'narrator' 
      ? messages[messages.length - 1].text 
      : '';
    
    if (textToParse) {
      const options = parseOptionsFromText(textToParse);
      setAvailableOptions(options);
    }
  }, [messages]);

  // Handle thinking animation
  useEffect(() => {
    if (isInteracting) {
      startThinkingAnimation();
    } else {
      dotsOpacity.setValue(0.3);
    }
  }, [isInteracting]);

  // Auto-scroll when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const parseOptionsFromText = (text: string): ParsedOption[] => {
    const lines = text.split('\n');
    const options: ParsedOption[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+)[\)\.\-\s]+(.+)$/);
      if (match) {
        const number = parseInt(match[1]);
        const text = match[2].trim();
        if (number >= 1 && number <= 10 && text.length > 0) {
          options.push({ number, text });
        }
      }
    }
    
    return options;
  };

  const startThinkingAnimation = () => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(dotsOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.timing(dotsOpacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start(animate);
    };
    animate();
  };

  const initializeSession = async () => {
    try {
      await startSession(worldId);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isInteracting) return;

    const messageToSend = inputText.trim();
    setInputText('');

    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
      setInputText(messageToSend);
    }
  };

  const handleQuickSend = async (optionText: string) => {
    if (isInteracting) return;

    try {
      await sendMessage(optionText);
    } catch (error) {
      console.error('Failed to send option:', error);
    }
  };

  const handleResetWorld = async () => {
    if (isInteracting) return;

    try {
      await resetSession(worldId);
    } catch (error) {
      console.error('Failed to reset world:', error);
    }
  };

  // Loading state
  if (isSessionLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.statusText}>Starting your adventure...</Text>
      </View>
    );
  }

  // Error state - session failed to load
  if (!currentSession) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to start adventure</Text>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.actionButtonText}>← Back to Worlds</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]} 
          onPress={initializeSession}
        >
          <Text style={styles.actionButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Worlds</Text>
        </TouchableOpacity>
        <Text style={styles.worldTitle} numberOfLines={1}>
          {worldTitle}
        </Text>
        <TouchableOpacity 
          style={styles.resetButton} 
          onPress={handleResetWorld}
          disabled={isInteracting}
        >
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer} 
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message, index) => (
          <View 
            key={index} 
            style={[
              styles.messageContainer, 
              message.type === 'user' ? styles.userMessage : styles.narratorMessage
            ]}
          >
            <Text style={[
              styles.messageText,
              message.type === 'user' ? styles.userMessageText : styles.narratorMessageText
            ]}>
              {message.text}
            </Text>
            <Text style={styles.messageTime}>
              {message.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
            </Text>
          </View>
        ))}

        {/* Show thinking indicator when processing */}
        {isInteracting && (
          <View style={[styles.messageContainer, styles.narratorMessage]}>
            <View style={styles.thinkingContainer}>
              <Animated.Text style={[styles.thinkingDots, { opacity: dotsOpacity }]}>
                •••
              </Animated.Text>
              <Text style={styles.thinkingText}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Options */}
      {availableOptions.length > 0 && !isInteracting && (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>Quick Actions:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.optionsScrollContent}
          >
            {availableOptions.map((option) => (
              <TouchableOpacity
                key={option.number}
                style={styles.optionButton}
                onPress={() => handleQuickSend(option.text)}
              >
                <Text style={styles.optionNumber}>{option.number}</Text>
                <Text style={styles.optionText} numberOfLines={2}>
                  {option.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="What do you do next?"
            placeholderTextColor="#666"
            multiline
            maxLength={500}
            editable={!isInteracting}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              (!inputText.trim() || isInteracting) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isInteracting}
          >
            <Text style={[
              styles.sendButtonText,
              (!inputText.trim() || isInteracting) && styles.sendButtonTextDisabled
            ]}>
              Send
            </Text>
          </TouchableOpacity>
        </View>
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
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    fontSize: 16,
    color: '#8B5CF6',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#8B5CF6',
    marginRight: 16,
  },
  worldTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
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
  messageTime: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  thinkingDots: {
    color: '#8B5CF6',
    fontSize: 16,
  },
  thinkingText: {
    fontSize: 14,
    color: '#1E293B',
    marginLeft: 8,
  },
  optionsContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  optionsScrollContent: {
    padding: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginRight: 12,
    minWidth: 20,
  },
  optionText: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    flex: 1,
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
  sendButtonTextDisabled: {
    color: '#9CA3AF',
  },
  statusText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#64748B',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
}); 