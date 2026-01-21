import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export const groqChat = async (messages: ChatMessage[]): Promise<string> => {
	const response = await groq.chat.completions.create({
		messages,
		model: 'openai/gpt-oss-20b',
	});

	return response.choices[0]?.message?.content || '';
};
