import React from "react";
import { Text, View } from "react-native";

/**
 * Web uchun xarita o'rnini bosuvchi: @rnmapbox/maps faqat native (web'da mapbox-gl kerak bo'lib,
 * Metro bundle'i yiqiladi). Xarita faqat mobil ilovada ishlaydi.
 */
const LotMapView: React.FC<Record<string, unknown>> = () => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
    <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center" }}>
      Xarita faqat mobil ilovada mavjud.
    </Text>
  </View>
);

export default LotMapView;
