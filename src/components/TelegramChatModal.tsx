import TelegramChat from "@/components/TelegramChat";
import React from "react";
import { Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface TelegramChatModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  title: string;
  targetIdentifier: string;
}

const TelegramChatModal = ({
  visible,
  onClose,
  chatId,
  title,
  targetIdentifier,
}: TelegramChatModalProps) => {
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <TelegramChat
          chatId={chatId}
          title={title}
          targetIdentifier={targetIdentifier}
          onClose={onClose}
        />
      </SafeAreaView>
    </Modal>
  );
};

export default TelegramChatModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
