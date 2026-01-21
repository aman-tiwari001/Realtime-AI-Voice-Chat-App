/**
 * Helper to convert Uint8Array to base64
 * @param bytes Uint8Array to convert
 * @returns Base64 encoded string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
	// For small arrays, use simple approach
	if (bytes.length < 32768) {
		return btoa(String.fromCharCode(...bytes));
	}

	// For large arrays, process in chunks to avoid stack overflow
	const chunkSize = 32768;
	let result = '';
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
		result += String.fromCharCode(...chunk);
	}
	return btoa(result);
}
