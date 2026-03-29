require("dotenv").config();
const token = (process.env.BOT_TOKEN || "").trim();

if (!token) {
  console.log("TOKEN_EMPTY");
  process.exit(1);
}

const masked = token.length > 16
  ? token.slice(0, 8) + "..." + token.slice(-6)
  : token;

console.log("TOKEN_MASK:", masked);

fetch(`https://api.telegram.org/bot${token}/getMe`)
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      console.log("TOKEN_OK");
      console.log("BOT_USERNAME:", data.result.username);
    } else {
      console.log("INVALID_TOKEN");
      console.log("TELEGRAM_RESPONSE:", data.description);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error("CHECK_FAILED:", err.message);
    process.exit(1);
  });
