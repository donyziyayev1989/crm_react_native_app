import React from 'react'
import { View } from 'react-native'

const Card = ({children, className}: {children: React.ReactNode, className?: string}) => {
  return (
    <View className={`bg-white py-2 px-4 rounded-xl ${className}`} >
      {children}
    </View>
  )
}

export default Card