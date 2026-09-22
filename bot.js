
const http = require('http');
// السيرفر الوهمي لمنع توقف Render
http.createServer((req, res) => res.end('Bot is running')).listen(process.env.PORT || 3000);

const TelegramBot = require('node-telegram-bot-api');

const token = '8641444645:AAFh9VmS_kDy3j5YTZTuLDiOdBtgNdI6M4Y';
const bot = new TelegramBot(token, { polling: true });

const PREFS = {
    filterLinks: true,
    filterBadWords: true,
    enableReminder: true,
    reminderFrequency: 5, // غيرناه لـ 5 مؤقتاً لتجربته بسرعة
    reminderMessage: "📢 تذكير للجميع: يرجى الالتزام بقوانين المجموعة وعدم نشر أي روابط خارجية. بيع وشراء ممتع للجميع! 🛍️"
};

const messageCounts = {};
const userOffenses = {};
const badWords = ["نصاب", "محتال", "كذاب", "سرقة", "غبي", "حقير"];
const urlRegex = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\((?:[^\s()<>]+|\([^\s()<>]+\))\))+(?:\((?:[^\s()<>]+|\([^\s()<>]+\))\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/i;

// أمر لتغيير الرسالة
bot.onText(/\/setreminder (.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const newReminderText = match[1];

    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (chatMember.status === 'administrator' || chatMember.status === 'creator') {
            PREFS.reminderMessage = newReminderText;
            bot.sendMessage(chatId, "✅ تم تحديث رسالة التذكير بنجاح!");
        } else {
            bot.sendMessage(chatId, "❌ عذراً، فقط مشرفو المجموعة يمكنهم ذلك.");
        }
    } catch (error) { console.error(error.message); }
});

// أمر لتغيير متى يتم إرسال الرسالة (العدد)
bot.onText(/\/setcount (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const newCount = parseInt(match[1]);

    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (chatMember.status === 'administrator' || chatMember.status === 'creator') {
            PREFS.reminderFrequency = newCount;
            bot.sendMessage(chatId, `✅ تم التحديث! سيتم إرسال التذكير كل ${newCount} رسائل.`);
        }
    } catch (error) { console.error(error.message); }
});

bot.on('message', async (msg) => {
    // 1. عداد الرسائل (يعمل على كل أنواع الرسائل الآن!)
    if (!msg.text || !msg.text.startsWith('/')) { // لا يعد الأوامر مثل /start
        const chatId = msg.chat.id;
        messageCounts[chatId] = (messageCounts[chatId] || 0) + 1;
        
        if (PREFS.enableReminder && messageCounts[chatId] >= PREFS.reminderFrequency) {
            bot.sendMessage(chatId, PREFS.reminderMessage);
            messageCounts[chatId] = 0; // تصفير العداد بعد الإرسال
        }
    }

    // 2. نظام الحماية (يعمل فقط إذا كان هناك نص في الرسالة أو الصورة)
    const textContent = msg.text || msg.caption || ""; 
    if (textContent.trim() === "") return;

    // تجاهل الأوامر في الحماية
    if (textContent.startsWith('/')) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageId = msg.message_id;

    const hasLink = PREFS.filterLinks && (urlRegex.test(textContent) || textContent.includes("t.me/") || textContent.includes("http"));
    const hasBadWord = PREFS.filterBadWords && badWords.some(word => textContent.includes(word));

    if (hasLink || hasBadWord) {
        try {
            await bot.deleteMessage(chatId, messageId);
            const userKey = `${chatId}_${userId}`;
            userOffenses[userKey] = (userOffenses[userKey] || 0) + 1;
            const offenseCount = userOffenses[userKey];
            const userName = msg.from.first_name || "عزيزي";
            const reason = hasLink ? "الروابط" : "الكلمات غير اللائقة";

            const permissions = {
                can_send_messages: false, can_send_media_messages: false, can_send_polls: false,
                can_send_other_messages: false, can_add_web_page_previews: false,
                can_change_info: false, can_invite_users: false, can_pin_messages: false
            };

            if (offenseCount === 1) {
                const untilDate = Math.floor(Date.now() / 1000) + (3 * 60);
                await bot.restrictChatMember(chatId, userId, { permissions: permissions, until_date: untilDate });
                bot.sendMessage(chatId, `عذراً ${userName}، ${reason} ممنوعة! 🚫\nالتحذير الأول: كتم لمدة 3 دقائق.`);
            } else if (offenseCount === 2) {
                const untilDate = Math.floor(Date.now() / 1000) + (60 * 60);
                await bot.restrictChatMember(chatId, userId, { permissions: permissions, until_date: untilDate });
                bot.sendMessage(chatId, `عذراً ${userName}، ${reason} ممنوعة! 🚫\nالتحذير الثاني: كتم لمدة ساعة.`);
            } else {
                await bot.banChatMember(chatId, userId);
                bot.sendMessage(chatId, `تم حظر ${userName} نهائياً بسبب تكرار المخالفات. 🚫🔨`);
            }
        } catch (error) { console.error("خطأ حماية:", error.message); }
    }
});

console.log("البوت يعمل الآن ومستعد لعد كل شيء...");
