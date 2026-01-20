import { Image, Pressable, Text, View, Alert, Button } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { useEffect, useState } from 'react';
import {
	useAudioRecorder,
	AudioModule,
	RecordingPresets,
	setAudioModeAsync,
	useAudioRecorderState,
	useAudioPlayer,
} from 'expo-audio';

export default function Index() {
	const [isMicOn, setIsMicOn] = useState(false);
	const [recordingUri, setRecordingUri] = useState<string | null>(null);

	const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
	const recorderState = useAudioRecorderState(audioRecorder);
	const player = useAudioPlayer(recordingUri ? { uri: recordingUri } : null);

	const record = async () => {
		await audioRecorder.prepareToRecordAsync();
		audioRecorder.record();
	};

	const stopRecording = async () => {
		await audioRecorder.stop();
		if (audioRecorder.uri) {
			setRecordingUri(audioRecorder.uri);
		}
	};

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

	useEffect(() => {
		if (audioRecorder.uri && !recorderState.isRecording) {
			setRecordingUri(audioRecorder.uri);
		}
	}, [audioRecorder.uri, recorderState.isRecording]);

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
					<Text
						style={{
							fontSize: 25,
							fontWeight: 'semibold',
							color: COLORS.primary,
						}}
					>
						Aura Voice
					</Text>
					<Image
						source={require('../assets/images/splash-icon.png')}
						style={{
							width: 300,
							height: 300,
							marginTop: 20,
							shadowColor: COLORS.primaryVariant,
							shadowOffset: { width: 0, height: 10 },
							shadowOpacity: 1,
							shadowRadius: 20,
						}}
					/>
					<Pressable
						style={{
							backgroundColor: COLORS.primary,
							padding: 10,
							borderRadius: 100,
							width: 80,
							height: 80,
							justifyContent: 'center',
							alignItems: 'center',
						}}
						onPress={recorderState.isRecording ? stopRecording : record}
					>
						{recorderState.isRecording ? (
							<FontAwesome name='stop' size={36} color='white' />
						) : (
							<FontAwesome name='microphone' size={36} color='white' />
						)}
					</Pressable>
				</View>
				<Button
					title='Play'
					onPress={() => {
						if (recordingUri) {
							player.play();
						} else {
							Alert.alert(
								'No recording available',
								'Please record audio first',
							);
						}
					}}
					disabled={audioRecorder.isRecording}
				/>
			</LinearGradient>
		</SafeAreaProvider>
	);
}
