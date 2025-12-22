/**
 * Amharic templates for visitor arrived notifications
 */

export const visitorArrivedTemplates = {
  email: {
    subject: (visitorName: string) => `እንግዳ ደርሷል: ${visitorName}`,
    body: (
      visitorName: string,
      visitorPhone: string | null,
      buildingName: string,
      unitNumber: string | null,
      floor: number | null,
      entryTime: Date,
    ) => {
      const unitInfo = unitNumber ? `ክፍል ${unitNumber}${floor ? `, ወለል ${floor}` : ''}` : '';
      const visitorInfo = visitorPhone ? `${visitorName} (${visitorPhone})` : visitorName;

      return (
        `ውድ አሻራ,\n\nእንግዳ ወደ ሕንፃዎ ደርሷል።\n\n` +
        `እንግዳ: ${visitorInfo}\n` +
        `ሕንፃ: ${buildingName}\n` +
        (unitInfo ? `ክፍል: ${unitInfo}\n` : '') +
        `የገባበት ሰዓት: ${entryTime.toLocaleString('am-ET')}\n\n` +
        `እባክዎ ለተጨማሪ ዝርዝሮች የአሻራ ፖርታልዎን ይመልከቱ።\n\n` +
        `እናመሰግናለን።\nBMS ስርዓት`
      );
    },
  },
  sms: {
    message: (
      visitorName: string,
      visitorPhone: string | null,
      buildingName: string,
      unitNumber: string | null,
      floor: number | null,
      entryTime: Date,
    ) => {
      const unitInfo = unitNumber ? `ክፍል ${unitNumber}${floor ? `, ወለል ${floor}` : ''}` : '';
      const visitorInfo = visitorPhone ? `${visitorName} (${visitorPhone})` : visitorName;

      return (
        `🚪 እንግዳ ደርሷል\n\n` +
        `እንግዳ: ${visitorInfo}\n` +
        `ሕንፃ: ${buildingName}\n` +
        (unitInfo ? `ክፍል: ${unitInfo}\n` : '') +
        `የገባበት ሰዓት: ${entryTime.toLocaleString('am-ET')}\n\n` +
        `እባክዎ የአሻራ ፖርታልዎን ይመልከቱ።\n\n` +
        `እናመሰግናለን።\nBMS ስርዓት`
      );
    },
  },
};
