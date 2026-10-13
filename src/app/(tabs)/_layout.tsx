import OrderModal from "@/components/OrderModal";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function TabLayout() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#6366f1",
          tabBarInactiveTintColor: "gray",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 0,
            elevation: 10,
            shadowColor: "#555",
            shadowOffset: {
              width: 0,
              height: -4,
            },
            shadowOpacity: 0.1,
            shadowRadius: 5,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Bosh sahifa",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="home" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="orders"
          options={{
            title: "Xaridlar",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="assignment" size={size} color={color} />
            ),
            headerShown: false,
            href: null,
          }}
        />
        <Tabs.Screen
          name="customers"
          options={{
            title: "Mijozlar",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="people" size={size} color={color} />
            ),
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="addOrder"
          options={{
            title: "",
            tabBarIcon: () => (
              <View style={styles.addTabContainer}>
                <View style={styles.addTabInner}>
                  <MaterialIcons name="add" size={32} color="#fff" />
                </View>
              </View>
            ),
            tabBarButton: ({ ref, ...props }) => (
              <Pressable
                {...props}
                onPress={(e) => {
                  e.preventDefault();
                  setModalVisible(true);
                }}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="messages/index"
          options={{
            title: "Xabarlar",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="message" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="lots"
          options={{
            title: "Partiyalar",
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="shopping-cart" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="products/index"
          options={{
            title: "Mahsulotlar",
            href: null,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="inventory" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="tags/index"
          options={{
            title: "Teglar",
            href: null,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="label" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            href: null,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="person" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: "Leadlar",
            headerShown: false,
            href: null,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="home" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      <OrderModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  addTabContainer: {
    top: -10,
    justifyContent: "center",
    alignItems: "center",
  },
  addTabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6366f1",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});
