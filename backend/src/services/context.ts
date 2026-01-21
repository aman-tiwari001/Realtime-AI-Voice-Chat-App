import { ChatMessage } from './llm';

const usersChatHistory: Map<string, ChatMessage[]> = new Map();

export const getUserChatHistory = (userId: string): ChatMessage[] => {
	usersChatHistory.get(userId);
	return usersChatHistory.get(userId) || [];
};

export const addUserChatMessage = (userId: string, message: ChatMessage) => {
	const history = usersChatHistory.get(userId) || [];
	history.push(message);
	usersChatHistory.set(userId, history);
};

export const clearUserChatHistory = (userId: string) => {
	usersChatHistory.delete(userId);
};
