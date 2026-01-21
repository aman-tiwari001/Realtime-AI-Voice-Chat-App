import { createServer } from 'node:http';
import { WebSocketServer, type RawData } from 'ws';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';
import { mkdir } from 'node:fs/promises';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { transcribeAudio } from './services/stt';
import { addUserChatMessage, getUserChatHistory } from './services/context';
import { SYSTEM_PROMPT } from './constant';
import { groqChat } from './services/llm';
import { streamAudioFromText } from './services/tts';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT) || 5000;
const AUDIO_DIR = join(__dirname, '../audio-recordings');

mkdir(AUDIO_DIR, { recursive: true }).catch(console.error);

const httpServer = createServer((req, res) => {
	res.writeHead(200);
	res.end('OK');
});

httpServer.listen(PORT, () => {
	console.log(`HTTP & WebSocket server listening on port ${PORT}`);
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
	console.log('Client connected');
	const userId = randomUUID();
	addUserChatMessage(userId, {
		role: 'system',
		content: SYSTEM_PROMPT,
	});

	let sessionId = Date.now();

	ws.on('message', async (message: RawData) => {
		if (message instanceof Buffer) {
			try {
				const text = message.toString('utf-8');
				const data = JSON.parse(text);

				if (data.type === 'recording_start') {
					console.log('Recording started');
					sessionId = Date.now();
					ws.send(JSON.stringify({ type: 'recording_started', sessionId }));
				} else if (data.type === 'audio_complete') {
					console.log('Receiving complete audio file...');
					const audioBuffer = Buffer.from(data.data, 'base64');

					// Transcribe audio
					const transcription = (await transcribeAudio(audioBuffer)) as {
						text: string;
					};
					console.log('Transcription:', transcription.text);

					addUserChatMessage(userId, {
						role: 'user',
						content: transcription.text,
					});

					// Get complete LLM response
					const llmResponse = await groqChat(getUserChatHistory(userId));
					console.log('LLM Response:', llmResponse);

					addUserChatMessage(userId, {
						role: 'assistant',
						content: llmResponse,
					});

					// Send text response for display
					ws.send(
						JSON.stringify({ type: 'transcription', text: transcription.text }),
					);
					ws.send(JSON.stringify({ type: 'response_text', text: llmResponse }));

					// Signal audio stream start
					ws.send(JSON.stringify({ type: 'audio_start' }));

					// Stream TTS audio chunks to client
					await streamAudioFromText(llmResponse, (chunk) => {
						if (ws.readyState === ws.OPEN) {
							ws.send(chunk);
						}
					});

					// Signal audio stream end
					ws.send(JSON.stringify({ type: 'audio_end' }));
				} else if (data.type === 'connection') {
					console.log('Client message:', data.message);
					ws.send(JSON.stringify({ type: 'welcome', message: 'Server ready' }));
				}
			} catch (error) {
				console.error('Error parsing message:', error);
			}
		}
	});

	ws.on('close', () => {
		console.log('Client disconnected');
	});

	ws.on('error', (error) => {
		console.error('WebSocket error:', error);
	});

	ws.send(
		JSON.stringify({ type: 'connected', message: 'WebSocket server ready' }),
	);
});
