# بوت أوامر ديسكورد عربي

- `!تذكرة` أو `!ticket`: ينشئ تذكرة خاصة بصاحب الأمر.


## التشغيل

1. ثبّت Node.js 18 أو أحدث.
2. نفّذ:

```powershell
npm install
```

3. انسخ `.env.example` إلى `.env` وضع توكن البوت في `DISCORD_TOKEN`.
4. من Discord Developer Portal فعّل **Message Content Intent**.
5. ادعُ البوت إلى السيرفر بصلاحيات `Manage Channels` و`View Channels` و`Send Messages`.
6. شغّل البوت:

```powershell
npm start
```

الأوامر مقيدة بالأعضاء الذين يملكون صلاحية `Manage Channels`.
