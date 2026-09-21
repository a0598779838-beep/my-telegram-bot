const TelegramBot = require('node-telegram-bot-api');

// ضع التوكن الخاص بك هنا
const token = '8641444645:AAFh9VmS_kDy3j5YTZTuLDiOdBtgNdI6M4Y';
const bot = new TelegramBot(token, { polling: true });

// إعدادات البوت (التي كانت في التطبيق)
const PREFS = {
    filterLinks: true,
    filterBadWords: true,
    enableReminder: true,
    reminderFrequency: 20,
    reminderMessage: "📢 تذكير للجميع: يرجى الالتزام بقوانين المجموعة وعدم نشر أي روابط خارجية. بيع وشراء ممتع للجميع! 🛍️"
};

const messageCounts = {};
const userOffenses = {};
const badWords = ["نصاب", "محتال", "كذاب", "سرقة", "غبي", "حقير"];
const urlRegex = /(?i)\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\((?:[^\s()<>]+|\([^\s()<>]+\))\))+(?:\((?:[^\s()<>]+|\([^\s()<>]+\))\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/i;

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "أهلاً بك! أنا بوت حماية المجموعات 🛡️. أعمل الآن على سيرفر 24/7!");
});

bot.on('message', async (msg) => {
    if (!msg.text) return; // تجاهل الرسائل غير النصية (مبدئياً)

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageId = msg.message_id;
    const textContent = msg.text;

    // فحص الروابط
    const hasLink = PREFS.filterLinks && (urlRegex.test(textContent) || textContent.includes("t.me/") || textContent.includes("http"));
    // فحص الكلمات البذيئة
    const hasBadWord = PREFS.filterBadWords && badWords.some(word => textContent.includes(word));

    if (hasLink || hasBadWord) {
        try {
            // حذف الرسالة
            await bot.deleteMessage(chatId, messageId);

            const userKey = `${chatId}_${userId}`;
            userOffenses[userKey] = (userOffenses[userKey] || 0) + 1;
            const offenseCount = userOffenses[userKey];

            const userName = msg.from.first_name || "عزيزي";
            const reason = hasLink ? "الروابط" : "الكلمات غير اللائقة";

            const permissions = {
                can_send_messages: false,
                can_send_media_messages: false,
                can_send_polls: false,
                can_send_other_messages: false,
                can_add_web_page_previews: false,
                can_change_info: false,
                can_invite_users: false,
                can_pin_messages: false
            };

            // تطبيق العقوبة
            if (offenseCount === 1) {
                const untilDate = Math.floor(Date.now() / 1000) + (3 * 60); // 3 دقائق
                await bot.restrictChatMember(chatId, userId, { permissions: permissions, until_date: untilDate });
                bot.sendMessage(chatId, `عذراً ${userName}، ${reason} ممنوعة! 🚫\nهذا هو التحذير الأول: تم كتمك لمدة 3 دقائق.`);
            } else if (offenseCount === 2) {
                const untilDate = Math.floor(Date.now() / 1000) + (60 * 60); // ساعة
                await bot.restrictChatMember(chatId, userId, { permissions: permissions, until_date: untilDate });
                bot.sendMessage(chatId, `عذراً ${userName}، ${reason} ممنوعة! 🚫\nهذا هو التحذير الثاني: تم كتمك لمدة ساعة كاملة.`);
            } else {
                await bot.banChatMember(chatId, userId);
                bot.sendMessage(chatId, `لقد تم حظر ${userName} نهائياً من المجموعة بسبب تكرار المخالفات. 🚫🔨`);
            }
        } catch (error) {
            console.error("حدث خطأ (ربما البوت ليس مشرفاً):", error.message);
        }
        return; // إيقاف التنفيذ حتى لا تُحسب الرسالة المحذوفة
    }

    // التذكير التلقائي
    if (PREFS.enableReminder) {
        messageCounts[chatId] = (messageCounts[chatId] || 0) + 1;
        if (messageCounts[chatId] >= PREFS.reminderFrequency) {
            bot.sendMessage(chatId, PREFS.reminderMessage);
            messageCounts[chatId] = 0;
        }
    }
});

console.log("البوت يعمل الآن...");