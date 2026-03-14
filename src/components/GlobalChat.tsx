import TelegramChatModal from "@/components/TelegramChatModal";
import { chatEvents } from "@/utils/chat_events";
import React, { useEffect, useState } from "react";

const GlobalChat = () => {
  const [visible, setVisible] = useState(false);
  const [chatData, setChatData] = useState<{
    chatId: string;
    title: string;
    targetIdentifier: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = chatEvents.subscribe((data) => {
      setChatData(data);
      setVisible(true);
    });
    return unsubscribe;
  }, []);

  if (!chatData) return null;

  return (
    <TelegramChatModal
      visible={visible}
      onClose={() => setVisible(false)}
      chatId={chatData.chatId}
      title={chatData.title}
      targetIdentifier={chatData.targetIdentifier}
    />
  );
};

export default GlobalChat;
