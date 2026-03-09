
export const formatPhone = (phone: string | undefined) => {
  if (!phone) return '';
  
  // Faqat raqamlarni olamiz
  const digits = phone.replace(/\D/g, '');
  
  // 998 bilan boshlangan 12 xonali raqam bo'lsa
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  
  // 9 xonali raqam bo'lsa (+998 siz)
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }

  // Boshqa holatlarda, agar 998 dan ko'p bo'lsa shunchaki + qo'shib qaytaramiz
  return digits.length >= 3 ? `+${digits}` : digits;
};
