import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useSession } from '../contexts/SessionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

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
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const dotsOpacity = useRef(new Animated.Value(0.3)).current;
  const scrollViewRef = useRef<ScrollView>(null);

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
      console.error('Streaming failed, falling back to regular response:', error);
      // Fallback to non-streaming if streaming fails
      try {
        await sendSessionMessage(messageToSend);
      } catch (fallbackError) {
        console.error('Both streaming and regular messaging failed:', fallbackError);
        // Restore input text if both methods fail
        setInputText(messageToSend);
      }
    }
  };

  if (isSessionLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Starting your adventure...</Text>
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
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="What do you do next?"
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
}); 