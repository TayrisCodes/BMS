/**
 * English templates for visitor arrived notifications
 */

export const visitorArrivedTemplates = {
  email: {
    subject: (visitorName: string) => `Visitor Arrived: ${visitorName}`,
    body: (
      visitorName: string,
      visitorPhone: string | null,
      buildingName: string,
      unitNumber: string | null,
      floor: number | null,
      entryTime: Date,
    ) => {
      const unitInfo = unitNumber ? `Unit ${unitNumber}${floor ? `, Floor ${floor}` : ''}` : '';
      const visitorInfo = visitorPhone ? `${visitorName} (${visitorPhone})` : visitorName;

      return (
        `Dear Tenant,\n\nA visitor has arrived at your building.\n\n` +
        `Visitor: ${visitorInfo}\n` +
        `Building: ${buildingName}\n` +
        (unitInfo ? `Unit: ${unitInfo}\n` : '') +
        `Entry Time: ${entryTime.toLocaleString()}\n\n` +
        `Please check your tenant portal for more details.\n\n` +
        `Thank you,\nBMS System`
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
      const unitInfo = unitNumber ? `Unit ${unitNumber}${floor ? `, Floor ${floor}` : ''}` : '';
      const visitorInfo = visitorPhone ? `${visitorName} (${visitorPhone})` : visitorName;

      return (
        `🚪 Visitor Arrived\n\n` +
        `Visitor: ${visitorInfo}\n` +
        `Building: ${buildingName}\n` +
        (unitInfo ? `Unit: ${unitInfo}\n` : '') +
        `Entry Time: ${entryTime.toLocaleString()}\n\n` +
        `Please check your tenant portal for more details.\n\n` +
        `Thank you,\nBMS System`
      );
    },
  },
};

