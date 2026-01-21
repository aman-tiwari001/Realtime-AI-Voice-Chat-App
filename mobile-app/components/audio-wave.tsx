import React, { useEffect } from 'react';
import Svg, { Rect } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

const COLOR = '#7018eb';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function AnimatedBar({ bar, height, barWidth }: { bar: any; height: number; barWidth: number }) {
	const animatedHeight = useSharedValue(bar.min);
	const duration = parseFloat(bar.dur) * 1000;

	useEffect(() => {
		animatedHeight.value = withRepeat(
			withTiming(bar.max, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
			-1,
			true
		);
	}, []);

	const animatedProps = useAnimatedProps(() => ({
		height: animatedHeight.value,
		y: (height - animatedHeight.value) / 2,
	}));

	return (
		<AnimatedRect
			x={bar.x}
			rx={barWidth / 2}
			width={barWidth}
			fill={COLOR}
			animatedProps={animatedProps}
		/>
	);
}

export default function AudioWave({ width = 120, height = 60 }) {
	const barWidth = 10;
	const gap = 10;

	const bars = [
		{ x: 0, min: 12, max: 28, dur: '0.9s' },
		{ x: 20, min: 16, max: 36, dur: '1.1s' },
		{ x: 40, min: 20, max: 44, dur: '1.0s' },
		{ x: 60, min: 28, max: 56, dur: '0.8s' }, // center
		{ x: 80, min: 20, max: 44, dur: '1.0s' },
		{ x: 100, min: 16, max: 36, dur: '1.1s' },
	];

	return (
		<Svg width={width} height={height} viewBox='0 0 120 60'>
			{bars.map((bar, i) => (
				<AnimatedBar key={i} bar={bar} height={height} barWidth={barWidth} />
			))}
		</Svg>
	);
}
