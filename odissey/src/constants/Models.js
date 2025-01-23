import { HF_API_TOKEN_READ } from 'react-native-dotenv';

const NARRATOR_MODEL_NAME = "Qwen/Qwen2.5-72B-Instruct"; // "google/gemma-2-2b-it";//"Qwen/Qwen2.5-1.5B-Instruct";
const SPEECH_RECOGNITION_MODEL_NAME = "openai/whisper-large-v3-turbo"; //"openai/whisper-large-v3-turbo";
const TEXT_TO_AUDIO_MODEL_NAME = "facebook/fastspeech2-en-ljspeech"; //"suno/bark";

export {HF_API_TOKEN_READ, NARRATOR_MODEL_NAME, TEXT_TO_AUDIO_MODEL_NAME, SPEECH_RECOGNITION_MODEL_NAME}

