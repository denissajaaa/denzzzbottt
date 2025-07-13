const {
  default: makeWASocket,
  useSingleFileAuthState,
  makeInMemoryStore
} = require('@whiskeysockets/baileys');

const fs = require("fs");
const P = require("pino");
const { adminNumber, danaNumber } = require("./config");

const { state, saveState } = useSingleFileAuthState('./auth.json');
const store = makeInMemoryStore({ logger: P().child({ level: 'silent', stream: 'store' }) });

const connect = async () => {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: 'silent' }),
    store
  });

  sock.ev.on("creds.update", saveState);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    if (text === '/start') {
      await sock.sendMessage(from, {
        text: "👋 Selamat datang di DenzzBot!\nSilakan pilih menu:",
        buttons: [
          { buttonId: 'lihat_nokos', buttonText: { displayText: '📦 Lihat Nokos' }, type: 1 },
          { buttonId: 'cara_beli', buttonText: { displayText: '📘 Cara Beli' }, type: 1 }
        ],
        headerType: 1
      });
    }

    if (text?.startsWith('#bayar')) {
      const bagian = text.split(' ');
      const negara = bagian[1];
      const nama = bagian.slice(2).join(' ');
      const user = from.split('@')[0];

      await sock.sendMessage(adminNumber + "@s.whatsapp.net", {
        text: `📩 Permintaan pembelian:\n➤ Nama: ${nama}\n➤ Negara: ${negara}\n➤ Pembeli: ${user}\n➤ Status: *Menunggu Konfirmasi Admin*\n\nAdmin balas:\n#acc ${user} atau #tolak ${user}`
      });

      await sock.sendMessage(from, { text: "✅ Bukti pembayaran terkirim ke admin. Tunggu konfirmasi." });
    }

    if (text?.startsWith('#acc')) {
      const user = text.split(' ')[1];
      const nokos = JSON.parse(fs.readFileSync('./nokos.json'));
      const nomorData = nokos["+62"]; // bisa kamu sesuaikan sesuai input

      await sock.sendMessage(user + "@s.whatsapp.net", {
        text: `✅ Pembayaran diterima!\n📱 Nomor: ${nomorData.nomor}\n🔑 OTP: ${nomorData.otp}`
      });

      await sock.sendMessage(from, { text: "✅ Nomor berhasil dikirim ke pembeli." });
    }

    if (text?.startsWith('#tolak')) {
      const user = text.split(' ')[1];
      await sock.sendMessage(user + "@s.whatsapp.net", {
        text: `❌ Maaf, pembayaran kamu belum valid. Silakan ulangi dan pastikan transfer sesuai.`
      });
    }

    if (msg.message?.buttonsResponseMessage?.selectedButtonId === 'lihat_nokos') {
      await sock.sendMessage(from, {
        text: `📦 Daftar nokos hari ini:\n\n+62 - Rp 2.000\n+60 - Rp 3.500\n\nUntuk beli, ketik:\n#bayar [kode negara] [Nama kamu]`
      });
    }

    if (msg.message?.buttonsResponseMessage?.selectedButtonId === 'cara_beli') {
      await sock.sendMessage(from, {
        text: `📘 *Cara Beli Nokos:*\n1. Transfer ke DANA: ${danaNumber}\n2. Kirim: #bayar +62 Nama Kamu\n3. Tunggu konfirmasi admin`
      });
    }
  });
};

connect();
