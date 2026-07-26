// Free, optional "someone needs my attention" ping via a Telegram bot. Skips
// silently if TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID aren't set, and never
// throws — a notification failing must never block the real request (slip
// submission, order review, etc.) that triggered it.
//
// LINE Notify (the obvious first choice) was discontinued in 2025, and LINE's
// replacement (the Messaging API) needs a LINE Official Account plus a
// webhook just to send yourself a message — Telegram's bot API needs only a
// bot token from @BotFather and your own chat id, both free with no signup
// beyond a Telegram account. See README for the 2-minute setup.
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
  } catch {
    // best-effort only
  }
}
