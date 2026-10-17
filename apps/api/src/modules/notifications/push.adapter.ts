import type { Messaging } from 'firebase-admin/messaging';

export interface PushMessage {
  title: string;
  /** Generic text only: never addresses, pickup details or medical information. */
  body: string;
  /** In-app path opened on click, e.g. /requests/abc. */
  link: string;
}

export interface PushSender {
  /** Returns tokens FCM reported as invalid so callers can delete them from push_tokens. */
  send(tokens: string[], msg: PushMessage): Promise<{ successCount: number; invalidTokens: string[] }>;
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** Firebase Cloud Messaging (web push) via the Admin SDK. */
export class FcmPushSender implements PushSender {
  constructor(private readonly messaging: Messaging) {}

  async send(tokens: string[], msg: PushMessage) {
    if (tokens.length === 0) return { successCount: 0, invalidTokens: [] };
    if (!msg.link.startsWith('/')) throw new Error('Push links must be in-app paths');
    const res = await this.messaging.sendEachForMulticast({
      tokens: tokens.slice(0, 500),
      notification: { title: msg.title, body: msg.body },
      data: { link: msg.link },
      webpush: { fcmOptions: { link: msg.link } },
    });
    const invalidTokens = res.responses.flatMap((r, i) =>
      !r.success && r.error && INVALID_TOKEN_CODES.has(r.error.code) ? [tokens[i]!] : [],
    );
    return { successCount: res.successCount, invalidTokens };
  }
}
