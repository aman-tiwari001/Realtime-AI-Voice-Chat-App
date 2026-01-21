import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { config } from 'dotenv';

config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
	throw new Error('Missing ELEVENLABS_API_KEY in environment variables');
}

export const transcribeAudio = async (
	audioBuffer: any,
): Promise<{ text: string }> => {
	const elevenlabs = new ElevenLabsClient({
		apiKey: process.env.ELEVENLABS_API_KEY,
	});

	const audioBlob = new Blob([audioBuffer], {
		type: 'audio/m4a',
	});

	const transcription = await elevenlabs.speechToText.convert({
		file: audioBlob,
		modelId: 'scribe_v2',
		tagAudioEvents: false,
		diarize: false,
	});

	return transcription as { text: string };
};
