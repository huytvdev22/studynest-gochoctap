# AGENTS.md — Quy chuẩn dành cho AI Coding Agent (StudyNest – Góc học tập)

Tài liệu này đúc rút toàn bộ quy tắc vận hành, kiến trúc kỹ thuật, triết lý sản phẩm và bài học thực tế trong quá trình xây dựng **StudyNest (`studynest-gochoctap`)**. Bất kỳ AI Agent nào (Claude Code, Cursor, Antigravity, Copilot, Codex...) khi tham gia phát triển dự án này **BẮT BUỘC** phải đọc và tuân thủ nghiêm ngặt các quy định dưới đây.

---

## 1. Quy tắc Giao tiếp & Môi trường Hệ thống (BẮT BUỘC 100%)

1. **Ngôn ngữ phản hồi**: Luôn luôn phản hồi, giải thích và trao đổi với người dùng bằng **tiếng Việt**.
2. **Ngôn ngữ lập kế hoạch (Plan)**: Mọi bản kế hoạch triển khai (`implementation_plan.md`, brainstorm, checklist) phải viết bằng **tiếng Việt**.
3. **Ngôn ngữ Git Commit**: Mọi commit message phải viết bằng **tiếng Việt** theo chuẩn Conventional Commits (ví dụ: `feat(lessons): bổ sung chế độ chỉnh sửa trực tiếp bài học & Flashcard`, `fix(schedule): chuẩn hóa lọc môn học trên thời khóa biểu`).
4. **Môi trường chạy Script**: Máy phát triển **KHÔNG cài Python**. Nếu cần viết bất kỳ script tự động hóa, xử lý dữ liệu hay kiểm thử nào, **bắt buộc viết bằng JavaScript (`.mjs` / `.js`) và chạy bằng `node`**. Tuyệt đối không dùng `python` hay `python3`.

---

## 2. Triết lý Sản phẩm & Nguyên tắc Nghiệp vụ Cốt lõi

### 2.1. Giao diện "Học sinh là trung tâm" (Student-First UX)
- **Mặc định khi vào ứng dụng**: Người mới tham gia lớp bằng mã mời (đặc biệt là học sinh nhỏ tuổi) chỉ muốn vào học ngay.
- **Không làm rối bằng giao diện quản trị**:
  - Ở trang danh sách lớp (`MyClassesPage.tsx`), nếu người dùng chưa hướng dẫn lớp nào (`teachingClasses.length === 0`) nhưng đã tham gia lớp học, **ẩn hoàn toàn** khung trống "Bạn chưa hướng dẫn lớp học nào". Đưa danh sách lớp đang học lên đầu tiên; nút "Tạo lớp học mới" chỉ là nút phụ nhỏ gọn.
  - Ở trang tổng quan lớp (`ClassDashboardPage.tsx`), ngay cả Chủ lớp (`owner`) hoặc Người hướng dẫn (`instructor`) khi mở vào cũng mặc định ở chế độ **"Góc học tập 60 phút"** giống hệt học sinh (cùng nhìn một màn hình khi ngồi kèm học buổi tối). Các thao tác quản trị được đặt trong nút chuyển chế độ **"Quản lý & Duyệt bài"** ở góc phải.

### 2.2. Luồng AI "0 đồng API" (Copy Prompt + Dán JSON Codeblock + Preview & Edit)
- **Không gọi trực tiếp API trả phí từ trình duyệt** (không phụ thuộc OpenAI/Gemini API key trên client).
- Mọi tính năng thông minh ứng dụng AI trong StudyNest đều tuân theo mô hình **3 bước chuẩn**:
  1. **Tạo Prompt thông minh (1 chạm)**: Hệ thống tự động gom ngữ cảnh hiện có trong ứng dụng (tên Giáo trình, tên Unit, danh sách từ mới/mẫu câu đã học, trạng thái thẻ Hay quên/Sắp quên...) vào một Prompt chuẩn xác và cho phép người dùng bấm **Copy Prompt** để gửi sang ChatGPT hoặc Google Gemini (kèm ảnh chụp trang sách hoặc ảnh thời khóa biểu nếu cần).
  2. **Trích xuất JSON an toàn (`extractJsonBlock`)**: Bộ parser trong `src/lib/scheduleAiParser.ts` và `src/lib/studyAiAndSrs.ts` tự động bóc tách khối ```` ```json ... ``` ```` từ phản hồi của AI, chuẩn hóa dữ liệu và chống lỗi thiếu trường.
  3. **Luôn có bước Preview & Chỉnh sửa (Review & Edit)**: Sau khi đọc JSON từ AI, giao diện **bắt buộc** phải hiển thị dữ liệu lên form để người hướng dẫn kiểm tra, sửa chữ, thêm/xóa mục hoặc đổi đáp án đúng trước khi bấm Lưu chính thức.

### 2.3. Không Hard-code Dữ liệu hay Ngôn ngữ
- **Thời khóa biểu (`SchedulePage.tsx`)**:
  - Danh sách các thẻ môn học trên thanh lọc phải được **trích xuất động (dynamic mapping)** từ chính các tiết học thực tế đang có trong Thời khóa biểu của lớp (`subjectsInSchedule`), kèm số lượng tiết học của từng môn. Tuyệt đối không chỉ dùng một danh sách môn học hard-code cố định.
- **Đọc phát âm đa ngôn ngữ (`ttsLang` – Web Speech API)**:
  - **Tuyệt đối không hard-code boolean kiểu `isEnglishAudio`**.
  - Sử dụng trường `ttsLang?: SupportedTtsLang` (`'' | 'en-US' | 'en-GB' | 'zh-CN' | 'ja-JP' | 'ko-KR' | 'fr-FR' | 'vi-VN'`) trên `Lesson`, `LessonKeyword` và `Assignment`.
  - Khi `ttsLang === ''` (ví dụ môn Toán, Khoa học, Lịch sử): Tự động ẩn nút Loa đọc phát âm.
  - Khi `ttsLang !== ''` (Tiếng Anh, Tiếng Trung, Tiếng Nhật...): Hiển thị nút **Nghe phát âm 🔊** (tốc độ chuẩn `0.92`) và nút **Đọc chậm 🐢** (tốc độ `0.72`) sử dụng `window.speechSynthesis` tích hợp sẵn trên trình duyệt.

### 2.4. Tổ chức Giáo trình Độc lập (`subject`) -> Chương (`unitTitle`) -> Bài học (`Lesson`)
- Mỗi bộ sách hoặc môn học (ví dụ: `Everybody Up 1`, `Toán Lớp 3`, `Tiếng Trung HSK 1`) là một **Giáo trình độc lập**.
- Khi thêm hoặc sửa bài học:
  - Trường **Giáo trình (`subject`)** và **Unit / Chương (`unitTitle`)** phải hiển thị dưới dạng **Droplist (`<select>`)** lấy từ danh sách các Giáo trình / Unit đã tồn tại trong lớp để tránh gõ lệch tên (kèm tùy chọn `+ Tạo giáo trình mới...` / `+ Thêm Unit mới...` khi cần mở rộng).
- Mỗi bài học (`Lesson`) hỗ trợ chuyển đổi linh hoạt giữa **Đã công bố (`published`)** và **Bản nháp (`draft`)**, đồng thời cho phép **Chỉnh sửa trực tiếp nội dung bài học & bộ thẻ Flashcard** ngay trên trang chi tiết bài học (`LessonDetailPage.tsx`).

### 2.5. Đường cong quên lãng Ebbinghaus (Spaced Repetition – SRS 4 mức độ nhớ)
- Mọi thẻ Flashcard (`LessonKeyword`) được định danh bởi khóa `makeSrsCardKey(lessonId, term)`.
- Khi học sinh tự lật thẻ hoặc nộp bài kiểm tra trắc nghiệm, hệ thống tự động tính toán mức độ nhớ (`SrsMemoryLevel`) và ngày hẹn ôn tiếp theo (`nextReviewDate`):
  - **⚪ Mới học (`new`, `level = 0`)**: Thẻ chưa ôn lần nào.
  - **🔴 Hay quên (`struggling`, `level = 1`)**: Học sinh bấm "Chưa thuộc" hoặc **trả lời sai câu hỏi trắc nghiệm có `relatedTerm` tương ứng** $\rightarrow$ Hẹn ôn lại ngay ngày mai (**+1 ngày**).
  - **🟡 Tạm nhớ / Sắp quên (`due_soon`, `level = 2` hoặc đã đến hạn `nextReviewDate <= todayStr`)**: Học sinh bấm "Tạm nhớ" $\rightarrow$ Hẹn ôn lại sau **+3 đến 7 ngày**.
  - **🟢 Đã nhớ kỹ (`mastered`, `level = 3` và `nextReviewDate > todayStr`)**: Học sinh bấm "Đã nhớ kỹ" $\rightarrow$ Hẹn ôn lại sau **+14 đến 30 ngày**.

---

## 3. Quy tắc Bảo mật Firestore & Tương thích Schema

1. **Tôn trọng `firestore.rules`**:
   - Trước khi thêm collection mới hoặc thay đổi cấu trúc ghi dữ liệu trong `src/services/studyNestService.ts`, phải kiểm tra `firestore.rules`.
   - Ví dụ: Tiến độ SRS của từng học sinh được lưu trong `classes/{classId}/learningRecords/srs_${studentUid}` với đầy đủ các trường bắt buộc của `learningRecords` (`studentUid`, `studentName`, `type: 'session'`, `sessionId: null`, `assignmentId: null`, `title`, `date`, `studentStatus: 'submitted'`, `instructorStatus: 'unverified'`, `starsAwarded: 0`, `confirmedBy: null`, `instructorComment: ''`, `srsStates: {...}`) để học sinh có quyền tự tạo/cập nhật mà không vi phạm Firestore Security Rules.
   - Hàm `listLearningRecords` tự động lọc bỏ các bản ghi hệ thống có `id.startsWith('srs_')` để không làm lẫn vào danh sách bài nộp thông thường.
2. **Avatar Google (`UserAvatar`)**:
   - Luôn sử dụng component `<UserAvatar />` trong `src/components/ui/ThemeBadges.tsx` với thuộc tính `referrerPolicy="no-referrer"` để ảnh đại diện Google (`lh3.googleusercontent.com`) hiển thị ổn định, không bị lỗi 403, và tự động fallback về chữ cái đầu tên nếu ảnh lỗi.

---

## 4. Quy trình Kiểm tra Trước khi Commit & Deploy

Trước khi tạo bất kỳ commit nào, AI Agent **bắt buộc** phải chạy lệnh kiểm tra tổng hợp sau và đảm bảo `exit code = 0`:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- **Unit Tests**: Đặt tại `tests/unit/streak-and-helpers.test.ts` (kiểm thử múi giờ `Asia/Ho_Chi_Minh`, tính toán Streak & Sao thưởng, băm SHA-256 mã mời, parser JSON Thời khóa biểu, parser JSON Flashcard/Quiz và thuật toán Đường cong quên lãng SRS).
- **Triển khai (Deployment)**: Dự án đã cấu hình sẵn GitHub Actions CI/CD (`.github/workflows/deploy.yml`). Khi push lên nhánh `main` (`git push origin main`), hệ thống tự động kiểm thử, build và deploy lên Firebase Hosting (`https://studynest-gochoctap.web.app`).
