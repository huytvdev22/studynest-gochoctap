import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';
import path from 'path';

const root = process.cwd();
const svgPath = path.join(root, 'public', 'favicon.svg');
const tmpDir = '/tmp';
const tmpRawPng = path.join(tmpDir, 'favicon.svg.png');

console.log('--- Đang render icon từ SVG bằng QuickLook & sips trên macOS ---');

// 1. Render PNG 512x512 từ SVG
execSync(`qlmanage -t -s 512 -o "${tmpDir}" "${svgPath}"`, { stdio: 'pipe' });

if (!existsSync(tmpRawPng)) {
  console.error('Không tìm thấy file thumbnail tại', tmpRawPng);
  process.exit(1);
}

// 2. Tạo icon-512.png
const p512 = path.join(root, 'public', 'icon-512.png');
copyFileSync(tmpRawPng, p512);
execSync(`sips -z 512 512 "${p512}"`, { stdio: 'pipe' });
console.log('✓ Đã tạo public/icon-512.png (512x512)');

// 3. Tạo icon-192.png
const p192 = path.join(root, 'public', 'icon-192.png');
copyFileSync(tmpRawPng, p192);
execSync(`sips -z 192 192 "${p192}"`, { stdio: 'pipe' });
console.log('✓ Đã tạo public/icon-192.png (192x192)');

// 4. Tạo apple-touch-icon.png (180x180) cho iPhone / iPad
const pApple = path.join(root, 'public', 'apple-touch-icon.png');
copyFileSync(tmpRawPng, pApple);
execSync(`sips -z 180 180 "${pApple}"`, { stdio: 'pipe' });
console.log('✓ Đã tạo public/apple-touch-icon.png (180x180)');

// 5. Tạo apple-touch-icon-precomposed.png (180x180)
const pApplePre = path.join(root, 'public', 'apple-touch-icon-precomposed.png');
copyFileSync(pApple, pApplePre);
console.log('✓ Đã tạo public/apple-touch-icon-precomposed.png (180x180)');

// 6. Tạo favicon-32x32.png
const p32 = path.join(root, 'public', 'favicon-32x32.png');
copyFileSync(tmpRawPng, p32);
execSync(`sips -z 32 32 "${p32}"`, { stdio: 'pipe' });
console.log('✓ Đã tạo public/favicon-32x32.png (32x32)');

// 7. Tạo favicon-16x16.png
const p16 = path.join(root, 'public', 'favicon-16x16.png');
copyFileSync(tmpRawPng, p16);
execSync(`sips -z 16 16 "${p16}"`, { stdio: 'pipe' });
console.log('✓ Đã tạo public/favicon-16x16.png (16x16)');

// 8. Tạo favicon.ico (sử dụng sips convert sang ico hoặc copy 32x32)
const pIco = path.join(root, 'public', 'favicon.ico');
try {
  execSync(`sips -s format ico "${p32}" --out "${pIco}"`, { stdio: 'pipe' });
  console.log('✓ Đã tạo public/favicon.ico bằng sips');
} catch {
  copyFileSync(p32, pIco);
  console.log('✓ Đã fallback copy sang public/favicon.ico');
}

console.log('Hoàn thành sinh toàn bộ bộ icon ứng dụng!');
