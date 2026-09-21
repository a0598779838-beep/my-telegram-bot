const TelegramBot = require('node-telegram-bot-api');

// التوكن الخاص بك
const token = '8641444645:AAG5dWsDn-n987QqYOyxoWF2Zrgdrs0171U';
const bot = new TelegramBot(token, { polling: true });

// الإعدادات الافتراضية
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
const urlRegex = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\((?:[^\s()<>]+|\([^\s()<>]+\))\))+(?:\((?:[^\s()<>]+|\([^\s()<>]+\))\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/i;

// 1. أمر تغيير رسالة التذكير من داخل التلجرام
bot.onText(/\/setreminder (.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const newReminderText = match[1]; // النص الذي كتبه المستخدم بعد مسافة

    try {
        // التحقق من أن الشخص الذي أرسل الأمر هو مشرف (Admin) أو منشئ المجموعة (Creator)
        const chatMember = await bot.getChatMember(chatId, userId);
        if (chatMember.status === 'administrator' || chatMember.status === 'creator') {
            
            // تغيير الرسالة في ذاكرة البوت
            PREFS.reminderMessage = newReminderText;
            
            bot.sendMessage(chatId, "✅ تم تحديث رسالة التذكير بنجاح! سيتم استخدامها من الآن فصاعداً.");
        } else {
            bot.sendMessage(chatId, "❌ عذراً، فقط مشرفو المجموعة يمكنهم تغيير رسالة التذكير.");
        }
    } catch (error) {
        console.error("خطأ أثناء تغيير الرسالة:", error.message);
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "أهلاً بك! أنا بوت حماية المجموعات 🛡️. أعمل الآن على سيرفر 24/7!");
});

// 2. الكود الأساسي لقراءة الرسائل وحذف الروابط وتحديث العداد
bot.on('message', async (msg) => {
    if (!msg.text) return;
    // تجاهل الرسائل التي تبدأ بـ / لكي لا يحسبها من ضمن العداد (مثل /start أو /setreminder)
    if (msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageId = msg.message_id;
    const textContent = msg.text;

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
                bot.sendMessage(chatId, `عذراً ${userName}، ${reason} ممنوعة! 🚫\nالتحذير الثاني: كتم لمدة ساعة كاملة.`);
            } else {
                await bot.banChatMember(chatId, userId);
                bot.sendMessage(chatId, `تم حظر ${userName} نهائياً بسبب تكرار المخالفات. 🚫🔨`);
            }
        } catch (error) {
            console.error("خطأ:", error.message);
        }
        return; 
    }

    if (PREFS.enableReminder) {
        messageCounts[chatId] = (messageCounts[chatId] || 0) + 1;
        if (messageCounts[chatId] >= PREFS.reminderFrequency) {
            bot.sendMessage(chatId, PREFS.reminderMessage);
            messageCounts[chatId] = 0;
        }
    }
});
console.log("البوت يعمل الآن...");
