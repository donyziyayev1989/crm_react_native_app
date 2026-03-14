type ChatEventCallback = (data: { chatId: string; title: string; targetIdentifier: string }) => void;

class ChatEvents {
  private listeners: ChatEventCallback[] = [];

  subscribe(callback: ChatEventCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  emit(data: { chatId: string; title: string; targetIdentifier: string }) {
    this.listeners.forEach((l) => l(data));
  }
}

export const chatEvents = new ChatEvents();
