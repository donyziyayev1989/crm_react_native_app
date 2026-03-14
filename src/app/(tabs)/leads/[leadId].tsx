import TelegramChat from "@/components/TelegramChat";
import { Lead } from "@/interfaces";
import db from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useHeaderHeight } from "@react-navigation/elements";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function LeadChatScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const headerHeight = useHeaderHeight();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) return;

    db.leads
      .get(leadId)
      .then(setLead)
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text>Murojaat topilmadi</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: lead.name,
          headerBackTitle: "Orqaga",
          headerLeft: ({ tintColor }) => (
            <Pressable onPress={() => router.back()} className="p-2">
              <MaterialIcons name="arrow-back" size={24} color={tintColor} />
            </Pressable>
          ),
        }}
      />
      <TelegramChat
        chatId={leadId!}
        title={lead.name}
        targetIdentifier={lead.telegram_id || lead.phone}
        headerHeight={headerHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
