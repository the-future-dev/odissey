import React, { useState, useEffect } from 'react';

import { View, TextInput, Button, FlatList, Text, StyleSheet } from 'react-native';
import StoryController from '../actors/StoryController';
import narratorInstance from '../actors/Narrator';
import { loadStoryParameters } from '../actors/StoryParameters';

export default function HomeScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [storyController, setStoryController] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    initializeStory();
  }, []);

  const initializeStory = async () => {
    try {
      const parameters = await loadStoryParameters();
      const controller = new StoryController(parameters);
      setStoryController(controller);
      
      // 0: Get initial settings/system prompt
      const settingsPrompt = controller.initializeStory();
      
      // 1: Set up initial conversation with the settings prompt and get narrator's response
      setIsLoading(true);
      narratorInstance.setMessages([{ role: 'system', content: settingsPrompt }]);
      const response = await handleNarratorResponse();
      
      // Display the initial narrative
      setMessages([{ role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Error initializing story:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    try {
      setIsLoading(true);
      
      // 2: Add user message
      const userMessage = { role: 'user', content: message };
      setMessages(prev => [...prev, userMessage]);
      setMessage('');

      // 3: Get potential new system prompt from story controller
      const systemPrompt = storyController.getNextPrompt();
      
      // Update narrator's message history
      const updatedMessages = [
        ...narratorInstance.getMessages(),
        userMessage,
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : [])
      ];
      narratorInstance.setMessages(updatedMessages);

      // 4: Get and display narrator's response
      const response = await handleNarratorResponse();
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Error in chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNarratorResponse = async () => {
    try {
      const response = await narratorInstance.chat();
      
      // Handle both string and AsyncGenerator responses
      if (typeof response === 'string') {
        return response;
      }
      
      let responseText = '';
      
      // Handle AsyncGenerator
      for await (const chunk of response) {
        responseText = chunk;
        // Update messages in real-time with partial response
        setMessages(prev => {
          const newMessages = [...prev];
          // Update or add the assistant's message
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.role === 'assistant') {
            lastMessage.content = responseText;
          } else {
            newMessages.push({ role: 'assistant', content: responseText });
          }
          return newMessages;
        });
      }
      
      return responseText;
    } catch (error) {
      console.error('Error in narrator response:', error);
      throw error;
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.role === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      <Text style={styles.message}>{item.content}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, index) => index.toString()}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message"
          editable={!isLoading}
        />
        <Button 
          title={isLoading ? "Sending..." : "Send"} 
          onPress={sendMessage}
          disabled={isLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  message: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  messageContainer: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 10,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  // inputContainer: {
  //   flexDirection: 'row',
  //   padding: 10,
  // },
}); 