import ConfirmLeadModal from "@/components/ConfirmLeadModal";
import TelegramChat from "@/components/TelegramChat";
import { Lead, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db from "@/services/database";
import { callPhone } from "@/utils/actions";
import { formatDate, formatPhone, formatSum } from "@/utils/format";
import {
  canConfirmLead,
  leadItems,
  leadStateLabel,
  sourceLabel,
} from "@/utils/leads";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useHeaderHeight } from "@react-navigation/elements";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function LeadDetailScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const headerHeight = useHeaderHeight();
  const { customersById } = useRefData();
  const [lead, setLead] = useState<WithId<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [detailHeight, setDetailHeight] = useState(0);

  // watchDoc: tasdiqlangandan keyin holat va order_ids darhol yangilanadi
  useEffect(() => {
    if (!leadId) return;
    return db.leads.watchDoc(leadId, (doc) => {
      setLead(doc as WithId<Lead> | null);
      setLoading(false);
    });
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

  const isTelegram = !!lead.telegram_id;
  const items = leadItems(lead);
  const orderIds = lead.order_ids ?? [];
  const customer = lead.customer_id ? customersById[lead.customer_id] : undefined;
  const place = [lead.region_name, lead.district_name, lead.address]
    .filter(Boolean)
    .join(", ");

  const details = (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{sourceLabel(lead.source)}</Text>
        </View>
        {lead.number != null && <Text style={styles.muted}>#{lead.number}</Text>}
        <Text style={styles.muted}>{leadStateLabel(lead.state)}</Text>
        <Text style={[styles.muted, { marginLeft: "auto" }]}>
          {formatDate(lead.date)}
        </Text>
      </View>

      <Text style={styles.name}>{lead.name}</Text>
      {isTelegram ? (
        <Text style={styles.text}>{formatPhone(lead.phone)}</Text>
      ) : (
        <Pressable onPress={() => callPhone(lead.phone)} style={styles.row}>
          <MaterialIcons name="phone" size={16} color="#16a34a" />
          <Text style={styles.phoneLink}>{formatPhone(lead.phone)}</Text>
        </Pressable>
      )}
      {place ? <Text style={styles.text}>📍 {place}</Text> : null}

      {items.map((it, idx) => (
        <View key={`${it.product_id}-${idx}`} style={styles.itemRow}>
          <Text style={[styles.text, { flex: 1 }]}>
            {it.name || "Noma'lum mahsulot"} × {it.quantity}
          </Text>
          <Text style={styles.itemPrice}>
            {it.price == null ? "Narx kelishiladi" : formatSum(it.price)}
          </Text>
        </View>
      ))}
      {lead.total != null && (
        <Text style={styles.total}>
          {lead.has_unpriced && Number(lead.total) === 0
            ? "Narx kelishiladi"
            : `Jami: ${formatSum(lead.total)}${lead.has_unpriced ? " + narx kelishiladi" : ""}`}
        </Text>
      )}
      {lead.note ? <Text style={styles.note}>{lead.note}</Text> : null}

      {lead.state === "confirmed" && (orderIds.length > 0 || lead.customer_id) && (
        <View style={{ marginTop: 8, gap: 6 }}>
          {lead.customer_id ? (
            <Pressable
              style={styles.link}
              onPress={() =>
                router.push({
                  pathname: "/customers/[customerId]",
                  params: { customerId: lead.customer_id! },
                })
              }
            >
              <MaterialIcons name="person" size={16} color="#4f46e5" />
              <Text style={styles.linkText}>
                Mijoz: {customer?.name ?? lead.name}
              </Text>
            </Pressable>
          ) : null}
          {orderIds.map((id, idx) => (
            <Pressable
              key={id}
              style={styles.link}
              onPress={() =>
                router.push({ pathname: "/orders/[orderId]", params: { orderId: id } })
              }
            >
              <MaterialIcons name="receipt-long" size={16} color="#4f46e5" />
              <Text style={styles.linkText}>Buyurtma {idx + 1}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {canConfirmLead(lead) && (
        <Pressable style={styles.confirmBtn} onPress={() => setConfirmOpen(true)}>
          <MaterialIcons name="check" size={18} color="#fff" />
          <Text style={styles.confirmText}>Tasdiqlash</Text>
        </Pressable>
      )}
    </View>
  );

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
          // Telegram leadlarda tafsilotni yig'ib, chatga joy berish
          headerRight: isTelegram
            ? () => (
                <Pressable onPress={() => setExpanded((v) => !v)} className="p-2">
                  <MaterialIcons
                    name={expanded ? "expand-less" : "info-outline"}
                    size={24}
                    color="#6b7280"
                  />
                </Pressable>
              )
            : undefined,
        }}
      />

      {isTelegram ? (
        <>
          <View
            style={{ maxHeight: "45%" }}
            onLayout={(e) => setDetailHeight(e.nativeEvent.layout.height)}
          >
            {expanded && <ScrollView>{details}</ScrollView>}
          </View>
          <TelegramChat
            chatId={leadId!}
            title={lead.name}
            targetIdentifier={lead.telegram_id || lead.phone}
            headerHeight={headerHeight + detailHeight}
          />
        </>
      ) : (
        <ScrollView>{details}</ScrollView>
      )}

      <ConfirmLeadModal
        visible={confirmOpen}
        lead={lead}
        onClose={() => setConfirmOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 14,
    borderRadius: 14,
    gap: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: "#4f46e5", fontSize: 12, fontWeight: "600" },
  muted: { color: "#6b7280", fontSize: 12 },
  name: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 4 },
  text: { fontSize: 14, color: "#374151" },
  phoneLink: { fontSize: 15, color: "#16a34a", fontWeight: "600" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "600", color: "#4f46e5" },
  total: { fontSize: 15, fontWeight: "700", color: "#111827", marginTop: 4 },
  note: { fontSize: 13, color: "#6b7280", fontStyle: "italic", marginTop: 4 },
  link: { flexDirection: "row", alignItems: "center", gap: 6 },
  linkText: { color: "#4f46e5", fontWeight: "600" },
  confirmBtn: {
    marginTop: 10,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  confirmText: { color: "#fff", fontWeight: "700" },
});
