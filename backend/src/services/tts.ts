import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as dotenv from 'dotenv';

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
	throw new Error('Missing ELEVENLABS_API_KEY in environment variables');
}

const elevenlabs = new ElevenLabsClient({
	apiKey: ELEVENLABS_API_KEY,
});

// Stream audio chunks to a callback as they're generated
export const streamAudioFromText = async (
	text: string,
	onChunk: (chunk: Buffer) => void,
): Promise<void> => {
	const audioStream = await elevenlabs.textToSpeech.stream(
		'1qEiC6qsybMkmnNdVMbK', // Voice ID
		{
			modelId: 'eleven_multilingual_v2',
			text,
			outputFormat: 'mp3_22050_32',
			voiceSettings: {
				stability: 0.5,
				similarityBoost: 0.75,
				speed: 1.0,
			},
		},
	);

	for await (const chunk of audioStream) {
		onChunk(Buffer.from(chunk));
	}
};
