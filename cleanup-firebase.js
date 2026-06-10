// Firebase上のみつかる君データを全削除するメンテナンス用スクリプト
// 使い方: node cleanup-firebase.js
const path = require('path');
const fs = require('fs');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (_) { /* .envなし */ }

const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const keyPath = path.resolve(__dirname, process.env.FIREBASE_KEY_PATH || '');
const credential = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : JSON.parse(fs.readFileSync(keyPath, 'utf8'));

const app = initializeApp({
  credential: cert(credential),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const root = process.env.FIREBASE_ROOT || 'mitsukaru';
getDatabase(app).ref(root).remove().then(() => {
  console.log(`Firebaseの「${root}」以下を全削除しました`);
  process.exit(0);
}).catch((err) => {
  console.error('削除失敗:', err.message);
  process.exit(1);
});
