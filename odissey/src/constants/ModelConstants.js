import { HF_API_TOKEN_READ } from '@env';

const HF_API_TOKEN = HF_API_TOKEN_READ;
const NARRATOR_MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"; // "google/gemma-2-2b-it";//"HuggingFaceTB/SmolLM2-1.7B-Instruct";
const SPEECH_RECOGNITION_MODEL_NAME = "openai/whisper-large-v3-turbo"; //"openai/whisper-large-v3-turbo";
const TEXT_TO_AUDIO_MODEL_NAME = "facebook/fastspeech2-en-ljspeech"; //"suno/bark";

export {
  HF_API_TOKEN,
  NARRATOR_MODEL_NAME,
  TEXT_TO_AUDIO_MODEL_NAME,
  SPEECH_RECOGNITION_MODEL_NAME
};

