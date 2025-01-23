import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, FlatList, Text, StyleSheet } from 'react-native';
import StoryController from '../actors/StoryController';
import { saveStoryParameters, loadStoryParameters } from '../actors/StoryParameters';

export default function HomeScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [storyController, setStoryController] = useState(null);

  useEffect(() => {
    const initializeStory = async () => {
      const parameters = await loadStoryParameters();
      const controller = new StoryController(parameters);
      controller.initializeStory();
      setStoryController(controller);
      setMessages([{ key: controller.initializeStory() }]); // Start with the initial story
    };

    initializeStory();
  }, []);

  const sendMessage = () => {
    if (message.trim()) {
      setMessages([...messages, { key: message }]);
      setMessage('');
      // Here you can also call the storyController to get the next prompt
      if (storyController) {
        const nextPrompt = storyController.getNextPrompt();
        setMessages(prevMessages => [...prevMessages, nextPrompt]);
      }
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={({ item }) => <Text style={styles.message}>{item.key}</Text>}
      />
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="Type a message"
      />
      <Button title="Send" onPress={sendMessage} />
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
}); 