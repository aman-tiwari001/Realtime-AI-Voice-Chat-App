import { Pressable, Text, View, Alert, Animated } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import {
	useAudioRecorder,
	AudioModule,
	RecordingPresets,
	setAudioModeAsync,
	useAudioRecorderState,
	useAudioPlayer,
} from 'expo-audio';

import AudioWave from '@/components/audio-wave';
import { uint8ArrayToBase64 } from '@/utils';

export default function Index() {
	const [isConnected, setIsConnected] = useState(false);
	const [latency, setLatency] = useState<number | null>(null);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [responseText, setResponseText] = useState<string>('');

	const audioRecorder = useAudioRecorder({
		...RecordingPresets.LOW_QUALITY,
		sampleRate: 16000,
		numberOfChannels: 1,
		bitRate: 128000,
	});
	const recorderState = useAudioRecorderState(audioRecorder);

	// Refs for WebSocket and streaming state
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<number | null>(null);
	const reconnectAttemptsRef = useRef<number>(0);
	const maxReconnectAttempts = 5;
	const recordingEndTimeRef = useRef<number | null>(null);

	// Audio streaming refs
	const audioChunksRef = useRef<ArrayBuffer[]>([]);
	const audioPlayer = useAudioPlayer();

	// Animation ref for pulsing icon
	const scaleAnim = useRef(new Animated.Value(1)).current;

	// Play accumulated audio chunks
	const playAudio = useCallback(async () => {
		if (audioChunksRef.current.length === 0) return;
		try {
			setIsSpeaking(true);
			// Combine all chunks into single buffer
			const totalLength = audioChunksRef.current.reduce(
				(acc, chunk) => acc + chunk.byteLength,
				0,
			);
			const combined = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of audioChunksRef.current) {
				combined.set(new Uint8Array(chunk), offset);
				offset += chunk.byteLength;
			}

			// Save to temp file to play
			const filePath = `${FileSystem.cacheDirectory}response_audio.mp3`;
			await FileSystem.writeAsStringAsync(
				filePath,
				uint8ArrayToBase64(combined),
				{ encoding: 'base64' },
			);

			// Change audio source and play audio
			audioPlayer.replace(filePath);
			audioPlayer.play();

			// Calculate latency when audio actually starts playing
			if (recordingEndTimeRef.current) {
				const latencyMs = Date.now() - recordingEndTimeRef.current;
				if (latencyMs < 30000) {
					setLatency(latencyMs / 1000);
					console.log(`⏱ Total latency: ${(latencyMs / 1000).toFixed(2)}s`);
				}
				recordingEndTimeRef.current = null;
			}

			// Monitor playback completion
			const checkPlayback = setInterval(() => {
				if (!audioPlayer.playing) {
					setIsSpeaking(false);
					clearInterval(checkPlayback);
				}
			}, 100);
		} catch (error) {
			console.error('Error playing audio:', error);
			setIsSpeaking(false);
		}
	}, [audioPlayer]);

	// WebSocket connection function
	const connectWebSocket = useCallback(() => {
		try {
			if (!process.env.EXPO_PUBLIC_WEBSOCKET_URL) {
				console.error(
					'EXPO_PUBLIC_WEBSOCKET_URL is not defined in env variables',
				);
				return;
			}

			const ws = new WebSocket(process.env.EXPO_PUBLIC_WEBSOCKET_URL);
			ws.binaryType = 'arraybuffer';
			wsRef.current = ws;

			ws.onopen = () => {
				console.log('✅ Connected to WebSocket server');
				setIsConnected(true);
				reconnectAttemptsRef.current = 0;
				ws.send(JSON.stringify({ type: 'connection', message: 'Connected!' }));
			};

			ws.onmessage = (event) => {
				// Handle binary audio data
				if (event.data instanceof ArrayBuffer) {
					audioChunksRef.current.push(event.data);
					return;
				}

				const response =
					typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
				console.log('Message from server:', response.type);

				if (response.type === 'audio_start') {
					// Clear chunks for new audio stream
					const serverLatency = Date.now() - (recordingEndTimeRef.current || 0);
					console.log('Server latency: ', serverLatency / 1000, 's');
					audioChunksRef.current = [];
				} else if (response.type === 'audio_end') {
					// Play all received audio
					playAudio();
				} else if (response.type === 'response_text') {
					setResponseText(response.text);
					console.log('Response:', response.text);
				}
			};

			ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				setIsConnected(false);
			};

			ws.onclose = () => {
				console.log('🔌 Disconnected from WebSocket server');
				setIsConnected(false);

				// Attempt reconnection with exponential backoff
				if (reconnectAttemptsRef.current < maxReconnectAttempts) {
					const delay = Math.min(
						1000 * Math.pow(2, reconnectAttemptsRef.current),
						65000,
					);
					reconnectAttemptsRef.current += 1;

					console.log(
						`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`,
					);

					reconnectTimeoutRef.current = setTimeout(() => {
						connectWebSocket();
					}, delay);
				} else {
					console.error('❌ Max reconnection attempts reached');
					Alert.alert(
						'Connection Failed',
						'Unable to connect to server. Please check your connection and restart the app.',
					);
				}
			};
		} catch (error) {
			console.error('WebSocket connection error:', error);
		}
	}, [playAudio]);

	// Start recording (no streaming during recording)
	const startRecording = async () => {
		// Stop any playing audio
		if (audioPlayer.playing) {
			audioPlayer.pause();
		}
		setIsSpeaking(false);
		setResponseText(''); // Clear previous response
		setLatency(null); // Reset latency for new request

		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
			Alert.alert('Not connected', 'WebSocket is not connected');
			return;
		}

		// Reset recording end time ref
		recordingEndTimeRef.current = null;

		// Signal server that recording is starting
		wsRef.current.send(JSON.stringify({ type: 'recording_start' }));

		// Start recording
		await audioRecorder.prepareToRecordAsync();
		audioRecorder.record();
	};

	// Stop recording and send complete file
	const stopRecording = async () => {
		// Stop recording
		if (audioRecorder.isRecording) {
			await audioRecorder.stop();
			recordingEndTimeRef.current = Date.now();

			if (audioRecorder.uri) {
				console.log('Recording stopped,');

				// Read the complete audio file
				const base64Audio = await FileSystem.readAsStringAsync(
					audioRecorder.uri,
					{ encoding: 'base64' },
				);

				// Send complete file to server
				if (wsRef.current?.readyState === WebSocket.OPEN) {
					wsRef.current.send(
						JSON.stringify({
							type: 'audio_complete',
							data: base64Audio,
							format: 'm4a',
							timestamp: Date.now(),
						}),
					);
					console.log('✅ Audio file sent to server');
				}
			}
		}
	};

	// Request microphone permissions on mount
	useEffect(() => {
		(async () => {
			const status = await AudioModule.requestRecordingPermissionsAsync();
			if (!status.granted) {
				Alert.alert('Permission to access microphone was denied');
			}
			setAudioModeAsync({
				playsInSilentMode: true,
				allowsRecording: true,
			});
		})();
	}, []);

	// Animation effect for pulsing icon when speaking
	useEffect(() => {
		if (isSpeaking) {
			const pulseAnimation = Animated.loop(
				Animated.sequence([
					Animated.timing(scaleAnim, {
						toValue: 1.2,
						duration: 800,
						useNativeDriver: true,
					}),
					Animated.timing(scaleAnim, {
						toValue: 1,
						duration: 800,
						useNativeDriver: true,
					}),
				]),
			);
			pulseAnimation.start();
			return () => pulseAnimation.stop();
		} else {
			Animated.timing(scaleAnim, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}).start();
		}
	}, [isSpeaking, scaleAnim]);

	// Establish WebSocket connection on mount
	useEffect(() => {
		connectWebSocket();

		// Cleanup on unmount
		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				wsRef.current.close();
			}
		};
	}, [connectWebSocket]);

	return (
		<SafeAreaProvider
			style={{
				flex: 1,
			}}
		>
			<LinearGradient
				colors={[COLORS.primaryVariant, COLORS.secondaryVariant]}
				style={{
					flex: 1,
				}}
			>
				<View
					style={{
						flex: 1,
						justifyContent: 'space-between',
						alignItems: 'center',
						paddingVertical: 70,
					}}
				>
					<View style={{ alignItems: 'center' }}>
						<Text
							style={{
								fontSize: 25,
								fontWeight: 'semibold',
								color: COLORS.primary,
							}}
						>
							Aura Voice
						</Text>
						<Text
							style={{
								fontSize: 13,
								color: COLORS.primary,
								marginTop: 5,
							}}
						>
							{isConnected ? '● Connected' : '○ Disconnected'}
						</Text>
						{latency !== null && (
							<Text
								style={{
									fontSize: 13,
									color: COLORS.primary,
									marginTop: 10,
									fontWeight: '600',
								}}
							>
								⏱ Latency: {latency.toFixed(2)}s
							</Text>
						)}
					</View>
					<Text
						style={{
							color: '#ffffff',
							fontSize: 18,
							textAlign: 'center',
							position: 'absolute',
							top: 175,
							paddingHorizontal: 10,
							textShadowColor: COLORS.primary,
							textShadowOffset: { width: 0, height: 0 },
							textShadowRadius: 10,
							shadowColor: COLORS.primary,
							shadowOffset: { width: 0, height: 0 },
							shadowOpacity: 1,
							shadowRadius: 15,
						}}
					>
						{responseText.length > 175
							? responseText.slice(0, 175) + '...'
							: responseText}
					</Text>
					<Animated.Image
						source={require('../assets/images/splash-icon.png')}
						style={{
							width: 300,
							height: 300,
							marginTop: 20,
							shadowColor: COLORS.primaryVariant,
							shadowOffset: { width: 0, height: 10 },
							shadowOpacity: 1,
							shadowRadius: 20,
							transform: [{ scale: scaleAnim }],
						}}
					/>
					<View>
						{recorderState.isRecording && (
							<View
								style={{
									position: 'absolute',
									bottom: 140,
									left: 0,
									right: 0,
									alignItems: 'center',
								}}
							>
								<AudioWave />
							</View>
						)}
						<Text
							style={{
								color: COLORS.primary,
								marginVertical: 20,
								fontSize: 18,
								textAlign: 'center',
							}}
						>
							{recorderState.isRecording ? 'Listening...' : 'Push to talk'}
						</Text>
						<Pressable
							style={{
								backgroundColor: COLORS.primary,
								padding: 10,
								borderRadius: 100,
								width: 80,
								height: 80,
								justifyContent: 'center',
								alignItems: 'center',
								margin: 'auto',
							}}
							onPressIn={startRecording}
							onPressOut={stopRecording}
						>
							{recorderState.isRecording ? (
								<FontAwesome name='stop' size={36} color='white' />
							) : (
								<FontAwesome name='microphone' size={36} color='white' />
							)}
						</Pressable>
					</View>
				</View>
			</LinearGradient>
		</SafeAreaProvider>
	);
}
