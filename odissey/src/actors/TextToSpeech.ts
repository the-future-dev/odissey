import { HF_API_TOKEN_READ, TEXT_TO_AUDIO_MODEL_NAME } from '../constants/Models';
import { writeAsStringAsync, documentDirectory, EncodingType } from 'expo-file-system';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { AudioData } from '../constants/RequestsInterfaces';

class TextToAudio {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async queryAWS_API(text: string): Promise<AudioData> {
    try {
      const response = await fetch(`https://48v7qtqwq3.execute-api.us-east-1.amazonaws.com/staging/synthesize?text=${encodeURIComponent(text)}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const sound = new Audio.Sound();
      let uri = "";

      if (Platform.OS === 'web') {
        const blob = await response.blob();
        uri = URL.createObjectURL(blob);
        await sound.loadAsync({ uri });
      } else {
        const arrayBuffer = await response.arrayBuffer();
        uri = await this.saveAudioFile(arrayBuffer);
        await sound.loadAsync({ uri });
      }

      return { uri, sound };
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  private async saveAudioFile(arrayBuffer: ArrayBuffer): Promise<string> {
    const path = `${documentDirectory}temp_audio.mp3`;
    const uint8Array = new Uint8Array(arrayBuffer);
    await writeAsStringAsync(path, this.arrayBufferToBase64(uint8Array), {
      encoding: EncodingType.Base64,
    });

    return path;
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  public async textToAudio(text: string): Promise<AudioData> {
    return this.queryAWS_API(text);
  }
}

const textToSpeechInstance = new TextToAudio(process.env.AWS_API_KEY || "");
export default textToSpeechInstance;