// Telegram Bot API yordamchilari (fetch injeksiya qilinadi, base URL sozlanadi — testlarda mock).

export interface TelegramApi {
  sendMessage: (chatId: number | string, text: string, extra?: Record<string, unknown>) => Promise<void>;
  answerCallbackQuery: (id: string, text?: string) => Promise<void>;
}

export function createTelegramApi(
  token: string | undefined,
  base = "https://api.telegram.org",
  fetchImpl: typeof fetch = fetch,
  log: (...args: unknown[]) => void = console.error,
): TelegramApi {
  const call = async (method: string, body: Record<string, unknown>) => {
    try {
      const res = await fetchImpl(`${base}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) log(`${method} Error:`, res.status, await res.text());
    } catch (err) {
      log(`${method} Error:`, (err as Error).message);
    }
  };
  return {
    sendMessage: (chat_id, text, extra = {}) => call("sendMessage", { chat_id, text, ...extra }),
    answerCallbackQuery: (callback_query_id, text = "") => call("answerCallbackQuery", { callback_query_id, text }),
  };
}
