import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
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
  const optionsOpacity = useRef(new Animated.Value(1)).current;
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
    } else {
      setAvailableOptions([]);
    }
    
    // Always animate options container to visible since chat input is always there
    Animated.timing(optionsOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
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

  const handleQuickSend = async (optionNumber: number, optionText: string) => {
    if (isInteracting) return;

    // Send the choice number in a format the backend can detect
    const choiceMessage = `${optionNumber}`;

    try {
      await sendMessage(choiceMessage);
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
          <Ionicons name="chevron-back" size={24} color="#8B5CF6" />
          <Text style={styles.backButtonText}>Worlds</Text>
        </TouchableOpacity>
        <Text style={styles.worldTitle} numberOfLines={1}>
          {worldTitle}
        </Text>
        <TouchableOpacity 
          style={styles.resetButton} 
          onPress={handleResetWorld}
          disabled={isInteracting}
        >
          <Ionicons name="refresh" size={16} color="white" />
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
      {!isInteracting && (
        <Animated.View style={[styles.optionsContainer, { opacity: optionsOpacity }]}>
          {availableOptions.map((option, index) => (
            <TouchableOpacity
              key={option.number}
              style={styles.optionButton}
              onPress={() => handleQuickSend(option.number, option.text)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionNumber}>{index + 1})</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.optionTextScroll}
                  contentContainerStyle={styles.optionTextContainer}
                >
                  <Text style={styles.optionText}>
                    {option.text}
                  </Text>
                </ScrollView>
              </View>
            </TouchableOpacity>
          ))}
          
          {/* Chat Input as Last Option */}
          <View style={styles.chatOptionContainer}>
            <View style={styles.optionContent}>
              <Text style={styles.optionNumber}>{availableOptions.length + 1})</Text>
              <View style={styles.chatInputWrapper}>
                <TextInput
                  style={styles.chatInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type your custom action..."
                  placeholderTextColor="#666"
                  multiline
                  maxLength={500}
                  editable={!isInteracting}
                />
                <TouchableOpacity 
                  style={[
                    styles.chatSendButton, 
                    (!inputText.trim() || isInteracting) && styles.chatSendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!inputText.trim() || isInteracting}
                >
                  <Ionicons 
                    name="send" 
                    size={18} 
                    color={(!inputText.trim() || isInteracting) ? '#9CA3AF' : 'white'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#8B5CF6',
    marginLeft: 4,
    fontWeight: '500',
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
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
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
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#8B5CF6',
    maxWidth: '80%',
  },
  narratorMessage: {
    alignSelf: 'stretch',
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
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
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.3,
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
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  optionButton: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionNumber: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: 'bold',
    marginRight: 12,
    minWidth: 24,
  },
  optionTextScroll: {
    flex: 1,
    maxHeight: 24,
  },
  optionTextContainer: {
    alignItems: 'center',
    paddingRight: 20,
  },
  optionText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  chatOptionContainer: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chatInputWrapper: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    maxHeight: 80,
    backgroundColor: '#FAFAFA',
  },
  chatSendButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  chatSendButtonDisabled: {
    backgroundColor: '#A1A1AA',
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