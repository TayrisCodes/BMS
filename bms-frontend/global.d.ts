// Global type declarations for CSS imports
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '*.scss' {
  const content: Record<string, string>;
  export default content;
}

declare module '*.sass' {
  const content: Record<string, string>;
  export default content;
}

// Type declaration for web-push
declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export function sendNotification(
    subscription: PushSubscription,
    payload: string | Buffer,
    options?: {
      vapidDetails?: {
        subject: string;
        publicKey: string;
        privateKey: string;
      };
      TTL?: number;
      headers?: Record<string, string>;
    },
  ): Promise<void>;

  export function generateVAPIDKeys(): {
    publicKey: string;
    privateKey: string;
  };

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void;
}
