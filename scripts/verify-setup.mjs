import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env');
const firebasercPath = path.join(rootDir, '.firebaserc');

console.log('=== Kiểm tra cấu hình Firebase & GitHub Actions cho StudyNest ===\n');

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

if (!fs.existsSync(envPath)) {
  console.log('⚠️  Chưa tìm thấy file .env tại thư mục gốc.');
  console.log('   -> Hãy chạy: cp .env.example .env và điền thông số từ Firebase Console.\n');
} else {
  const content = fs.readFileSync(envPath, 'utf8');
  const missingOrPlaceholder = [];

  for (const key of requiredKeys) {
    const regex = new RegExp(`^${key}=["']?([^"'\\r\\n]+)["']?`, 'm');
    const match = content.match(regex);
    const val = match?.[1]?.trim() || '';
    if (
      !val ||
      val.includes('YourApiKeyHere') ||
      val.includes('your-project-id') ||
      val.includes('123456789012')
    ) {
      missingOrPlaceholder.push(key);
    }
  }

  if (missingOrPlaceholder.length > 0) {
    console.log(
      '⚠️  File .env đã tồn tại nhưng các biến sau vẫn đang để giá trị mẫu hoặc trống:'
    );
    for (const k of missingOrPlaceholder) {
      console.log(`   - ${k}`);
    }
    console.log('');
  } else {
    console.log('✅ File .env đã được điền đầy đủ thông số Firebase Web SDK!\n');
  }
}

if (fs.existsSync(firebasercPath)) {
  try {
    const rc = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));
    const defaultProj = rc?.projects?.default;
    if (!defaultProj || defaultProj === 'demo-studynest') {
      console.log(
        'ℹ️  .firebaserc hiện đang để project mặc định là "demo-studynest" (dùng cho Emulator).'
      );
      console.log(
        '   -> Khi deploy thật, hãy chạy: firebase use <project-id-thật-của-bạn>\n'
      );
    } else {
      console.log(`✅ .firebaserc đã trỏ tới project: "${defaultProj}"\n`);
    }
  } catch {
    console.log('⚠️  Không đọc được file .firebaserc.\n');
  }
}

