import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

const Card = ({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  return (
    <View
      className={`bg-white py-2 px-4 rounded-2xl ${className ?? ""}`}
      style={style}
    >
      {children}
    </View>
  );
};

export default Card;
