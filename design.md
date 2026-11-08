# DESIGN.md — Kiến trúc Hệ thống & Thiết kế Giao diện (StudyNest – Góc học tập)

Tài liệu này mô tả chi tiết kiến trúc dữ liệu, thiết kế giao diện (UI/UX), bảng màu và các luồng tương tác của **StudyNest – Góc học tập gia đình & lớp kèm nhỏ**. Khi mở rộng tính năng hoặc tinh chỉnh giao diện bằng bất kỳ công cụ AI nào, hãy bám sát tài liệu này để giữ sự đồng nhất tuyệt đối.

---

## 1. Tổng quan Kiến trúc & Công nghệ

- **Frontend Framework**: React 18 + TypeScript + Vite (`src/`).
- **Styling & Icons**: Tailwind CSS + `lucide-react` (hỗ trợ đầy đủ **Light Mode** & **Dark Mode**).
- **Backend & Database**:
  - **Chế độ Production**: Firebase Authentication (Google Sign-In) + Cloud Firestore + Firebase Hosting (`studynest-gochoctap`).
  - **Chế độ Demo / Offline Fallback**: Khi không cấu hình biến môi trường Firebase, `src/services/studyNestService.ts` tự động lưu trữ toàn bộ trạng thái vào `localStorage` với dữ liệu mẫu tiếng Việt đầy đủ, giúp ứng dụng luôn chạy và kiểm thử được ngay lập tức.
- **Công nghệ Âm thanh (TTS)**: Sử dụng chuẩn **Web Speech API (`window.speechSynthesis`)** trực tiếp trên trình duyệt, hỗ trợ phát âm đa ngôn ngữ (`en-US`, `en-GB`, `zh-CN`, `ja-JP`, `ko-KR`, `fr-FR`, `vi-VN`) ở 2 tốc độ: Chuẩn (`0.92x`) và Chậm (`0.72x`).
- **Múi giờ chuẩn**: Mặc định sử dụng `Asia/Ho_Chi_Minh` (`UTC+7`) thông qua bộ hàm xử lý ngày tháng trong `src/lib/date.ts`.

---

## 2. Cấu trúc Thư mục Cốt lõi

```text
src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx            # Thanh điều hướng trên cùng (Navbar), Avatar Google, đổi giao diện Sáng/Tối
│   │   └── ClassLayout.tsx          # Bố cục Workspace lớp học: Sidebar gọn gàng + Khu vực nội dung chính
│   ├── study/
│   │   └── InteractiveStudyModals.tsx # Modal Lật thẻ Flashcard (SRS + Loa TTS) & Modal Làm bài Trắc nghiệm
│   └── ui/
│       └── ThemeBadges.tsx          # RoleBadge, UserAvatar (Google photoURL), EmptyState, bảng màu môn học
├── contexts/
│   ├── AuthContext.tsx              # Quản lý đăng nhập Google / Demo User
│   ├── ClassContext.tsx             # Cung cấp thông tin lớp hiện tại và quyền (owner / instructor / student)
│   └── ThemeContext.tsx             # Chuyển đổi Light / Dark mode
├── lib/
│   ├── crypto.ts                    # Sinh mã mời 6 ký tự & băm SHA-256 bảo mật
│   ├── date.ts                      # Xử lý ngày giờ chuẩn múi giờ Asia/Ho_Chi_Minh
│   ├── scheduleAiParser.ts          # Prompt AI & bộ bóc tách JSON Thời khóa biểu từ ảnh chụp
│   ├── streak.ts                    # Engine tính Chuỗi ngày học (Streak) & Sao thưởng (không đứt chuỗi ngày nghỉ)
│   ├── studyAiAndSrs.ts             # Engine Đường cong quên lãng (SRS), TTS đa ngôn ngữ, AI Flashcard & Quiz Parser
│   └── validation.ts                # Kiểm tra dữ liệu đầu vào an toàn, chống XSS / javascript: URL
├── pages/
│   ├── LandingPage.tsx              # Trang giới thiệu & Đăng nhập
│   ├── MyClassesPage.tsx            # Danh sách lớp học (Ưu tiên lớp đang học, ẩn khối quản trị nếu chỉ là học sinh)
│   ├── JoinClassPage.tsx            # Nhập mã mời 6 ký tự để vào lớp
│   ├── ClassDashboardPage.tsx       # Góc học hôm nay (Mặc định chế độ Học sinh + nút chuyển Quản lý & Duyệt bài)
│   ├── SchedulePage.tsx             # Thời khóa biểu trực quan + Lọc theo môn học thực tế + Nhập từ ảnh bằng AI
│   ├── LessonsPage.tsx              # Thư viện Giáo trình độc lập -> Unit -> Bài học + Thanh SRS + Tạo AI
│   ├── LessonDetailPage.tsx         # Chi tiết bài học + Chỉnh sửa trực tiếp bài học/Flashcard + Ghi chú sư phạm riêng
│   ├── SessionsAndTasksPage.tsx     # Lịch buổi học 60 phút & Danh sách Nhiệm vụ (Flashcard / Quiz / Bài tập)
│   ├── SessionRunPage.tsx           # Đồng hồ đếm ngược 60 phút & Checklist 4 bước trong giờ học tối
│   ├── ProgressPage.tsx             # Bảng vàng Sao thưởng & Chuỗi ngày học (Streak)
│   └── MembersAndSettingsPage.tsx   # Quản lý thành viên, tạo mã mời & cài đặt lớp học
├── services/
│   └── studyNestService.ts          # Tầng truy xuất dữ liệu hợp nhất (Firestore + LocalStorage Demo)
└── types/
    └── domain.ts                    # Toàn bộ định nghĩa TypeScript cho các thực thể nghiệp vụ
```

---

## 3. Mô hình Dữ liệu Nghiệp vụ (`src/types/domain.ts`)

1. **`StudyClass` (`classes/{classId}`)**:
   - Thông tin lớp học, màu chủ đạo (`emerald`, `sky`, `amber`, `rose`, `violet`), múi giờ (`Asia/Ho_Chi_Minh`), các thứ học định kỳ trong tuần (`studyDaysOfWeek`) và danh sách ngày nghỉ ngoại lệ (`dayOffDates`).
2. **`ClassMember` (`classes/{classId}/members/{uid}`)**:
   - Phân quyền 3 vai trò: `owner` (Chủ lớp), `instructor` (Người hướng dẫn), `student` (Học sinh). Lưu `displayName`, `email`, `avatarUrl`.
3. **`ScheduleItem` (`classes/{classId}/schedules/{scheduleId}`)**:
   - Tiết học trong tuần: `dayOfWeek` (`0..6`), `sessionOfDay` (`morning` | `afternoon` | `evening`), `periodNumber` (`1..5`), `subject`, `type` (`school` | `tutoring`), `materialsNote`.
4. **`Lesson` (`classes/{classId}/lessons/{lessonId}`)**:
   - Phân cấp 3 tầng: **Giáo trình (`subject`)** $\rightarrow$ **Chương (`unitTitle`)** $\rightarrow$ **Tên bài học (`title`)**.
   - `ttsLang`: Ngôn ngữ đọc phát âm cho bộ thẻ của bài học.
   - `keywords`: Danh sách thẻ Flashcard (`LessonKeyword`: `term`, `pronunciation`, `meaning`, `example`, `cardType`, `ttsLang`).
   - `status`: `'published'` (Học sinh nhìn thấy) hoặc `'draft'` (Bản nháp).
5. **`LessonNote` (`classes/{classId}/lessonNotes/{lessonId}`)**:
   - Ghi chú sư phạm riêng tư, được bảo vệ bởi Firestore Rules để chỉ `owner` và `instructor` đọc/ghi được.
6. **`Assignment` (`classes/{classId}/assignments/{assignmentId}`)**:
   - Hỗ trợ 3 loại nhiệm vụ (`taskType`):
     - `'standard'`: Bài tập tự luận / làm vào vở thông thường.
     - `'flashcard'`: Bộ thẻ Flashcard giao cho học sinh lật ôn và tự đánh giá SRS (`flashcards: LessonKeyword[]`).
     - `'quiz'`: Bài kiểm tra trắc nghiệm 4 đáp án (`quizQuestions: QuizQuestion[]`).
7. **`LearningRecord` (`classes/{classId}/learningRecords/{recordId}`)**:
   - Lưu kết quả nộp bài của học sinh (`studentStatus`, `studentNote`, `quizScore`, `quizTotal`) và trạng thái xác nhận của người hướng dẫn (`instructorStatus: 'confirmed' | 'needs_work' | 'unverified'`, `starsAwarded`, `instructorComment`).
   - Bản ghi đặc biệt `srs_${studentUid}` lưu bản đồ trạng thái nhớ `srsStates: Record<string, SrsCardProgress>` của từng thẻ theo Đường cong quên lãng.

---

## 4. Ngôn ngữ Thiết kế Giao diện (UI/UX Design System)

### 4.1. Bố cục & Điều hướng Tối giản, Thân thiện Học sinh Tiểu học
- **Sidebar (`ClassLayout.tsx`)**:
  - Chỉ hiển thị **Biểu tượng (Icon) + Tên mục ngắn gọn** (không hiển thị dòng mô tả phụ rườm rà bên dưới mỗi mục, không hiển thị hộp "Lịch sinh hoạt Workspace" ở chân sidebar).
  - Các mục chính: `Góc học hôm nay`, `Thời khóa biểu`, `Buổi học & Nhiệm vụ`, `Thư viện bài học`, `Sao & Chuỗi ngày học`, `Thành viên & Cài đặt`.
- **Bo góc & Khoảng trắng**:
  - Sử dụng bo góc mềm mại (`rounded-2xl` cho thẻ con, `rounded-3xl` cho khung chính và Modal).
  - Font chữ rõ ràng, tiêu đề dùng `font-extrabold`, nút bấm có biểu tượng trực quan đi kèm.

### 4.2. Bảng màu Ngữ nghĩa & Quy chuẩn Icon Hệ thống (Semantic Colors & Icons)

> [!IMPORTANT]
> **Tuyệt đối KHÔNG sử dụng icon dạng emoji Unicode** (như 📚, ⭐, 🔴, 🟡, 🟢, ⚪, 🔊, 🐢, ✏️, 🎯, 📖, 📝, ⚡, 🎒, ☀️, 🌤️, 🌙...) trong giao diện, tiêu đề, nút bấm hay nhãn trạng thái. Việc lạm dụng emoji tạo cảm giác "đặc sệt AI", thiếu chuyên nghiệp và không đồng nhất giữa các hệ điều hành (Windows, macOS, iOS, Android hiển thị emoji khác nhau).
> 
> **Bắt buộc 100% sử dụng icon vector SVG chuẩn từ thư viện `lucide-react`**:
> - Sao thưởng: Dùng `<Star className="h-4 w-4 fill-amber-400 text-amber-500" />`
> - Đọc phát âm / Loa: Dùng `<Volume2 className="h-4 w-4" />`
> - Đọc chậm: Dùng `<Turtle className="h-4 w-4" />` hoặc `<Gauge className="h-4 w-4" />`
> - Các mức độ nhớ SRS (Đường cong quên lãng): Dùng chấm tròn màu SVG `<span className="h-2 w-2 rounded-full bg-rose-500" />` hoặc icon trạng thái (`AlertCircle`, `Clock`, `CheckCircle2`) kết hợp chữ rõ nghĩa, không dùng chấm tròn emoji (🔴 🟡 🟢 ⚪).
> - Sách / Giáo trình: Dùng `<BookOpen className="h-4 w-4" />` hoặc `<Bookmark className="h-4 w-4" />`
> - Mục tiêu: Dùng `<Target className="h-4 w-4" />`
> - Soạn cặp / Dụng cụ: Dùng `<Backpack className="h-4 w-4" />`
> - Buổi sáng / chiều / tối: Dùng `<Sun className="h-4 w-4" />`, `<CloudSun className="h-4 w-4" />`, `<Moon className="h-4 w-4" />`

- **Xanh ngọc (`emerald-600`)**: Màu chủ đạo của thương hiệu StudyNest, biểu thị hành động chính (Học bài, Lật Flashcard, Hoàn thành, Đã nhớ kỹ).
- **Tím (`violet-600`)**: Biểu thị các tính năng **Trợ lý AI** (Copy Prompt AI, Đọc JSON AI) và **Bài kiểm tra Trắc nghiệm**.
- **Vàng hổ phách (`amber-500`)**: Biểu thị **Sao thưởng**, trạng thái **Bản nháp**, ghi chú riêng của giáo viên, và thẻ **Sắp quên / Cần ôn hôm nay**.
- **Đỏ hồng (`rose-600`)**: Biểu thị cảnh báo xóa, câu trả lời sai, và thẻ **Hay quên (Cần ôn lại sau +1 ngày)**.
- **Bảng màu Môn học trên Thời khóa biểu**: Tự động ánh xạ màu pastel dịu mắt theo tên môn học (Toán: Xanh dương `sky`, Tiếng Việt: Xanh lá `emerald`, Tiếng Anh: Tím `violet`, Tự nhiên & Xã hội: Vàng `amber`...).

### 4.3. Quy chuẩn Thiết kế Thời khóa biểu (`SchedulePage.tsx`)
- **Thanh lọc môn học trên đầu**: Hiển thị đầy đủ các môn học đang thực sự có trong Thời khóa biểu kèm số tiết (ví dụ: `Tiếng Việt (7)`, `Toán (5)`, `Tiếng Anh (4)`...). Bấm vào môn nào sẽ lọc nổi bật các tiết của môn đó trên bảng tuần; bấm lại lần nữa để bỏ lọc.
- **Ô tiết học trên bảng tuần**: Giữ thiết kế gọn sạch, chỉ hiển thị **Tên môn học**, **Khung giờ** và **Giáo viên / Loại tiết**; **không hiển thị** dòng "Sách vở & dụng cụ cần mang" trực tiếp trong từng ô nhỏ trên lưới để tránh rối mắt (phần nhắc soạn cặp đã được tổng hợp riêng ở mục "Ngày mai học gì?" trên trang chủ).

---

## 5. Luồng Học tập Thực tế Buổi tối (End-to-End Workflow)

1. **Trước giờ học / Trong buổi học**:
   - Hai anh em mở **Góc học hôm nay** (`ClassDashboardPage.tsx`) hoặc **Thư viện bài học** (`LessonsPage.tsx`).
   - Chọn Giáo trình từ Droplist (ví dụ: `Everybody Up`) $\rightarrow$ Chọn Unit (`Unit 1: First Day`) $\rightarrow$ Tạo hoặc mở bài học (`Lesson 1: School Supplies`).
2. **Biên soạn nhanh bằng AI**:
   - Người hướng dẫn gõ vài từ khóa ghi chú hoặc chụp ảnh trang sách $\rightarrow$ Bấm **Copy Prompt tạo Flashcard** $\rightarrow$ Dán JSON từ AI vào để tạo bộ thẻ Flashcard có phiên âm IPA và nút **Loa đọc phát âm 🔊**.
   - Tích chọn **"Giao luôn bộ Flashcard này vào danh sách Nhiệm vụ của học sinh"** khi lưu.
3. **Học sinh tự luyện tập & Đánh giá theo Đường cong quên lãng**:
   - Học sinh bấm mở bộ Flashcard $\rightarrow$ Nghe phát âm chuẩn / Đọc chậm $\rightarrow$ Lật thẻ xem nghĩa và ví dụ $\rightarrow$ Tự bấm 1 trong 3 mức: **🔴 Chưa thuộc (+1 ngày)**, **🟡 Tạm nhớ (+3–7 ngày)**, **🟢 Đã nhớ kỹ (+14–30 ngày)**.
4. **Kiểm tra Trắc nghiệm cuối Unit & Tự động điều chỉnh SRS**:
   - Sau 1 Unit (hoặc khi có các thẻ sắp quên), người hướng dẫn bấm **Tạo Đề Trắc Nghiệm (AI)** $\rightarrow$ Copy Prompt đã gom sẵn toàn bộ từ vựng/mẫu câu trong Unit $\rightarrow$ Dán JSON, chỉnh sửa câu hỏi và giao đề thi.
   - Học sinh làm bài trắc nghiệm trực tiếp trên web $\rightarrow$ Hệ thống chấm điểm ngay, giải thích đáp án và tự động đưa các từ làm sai về nhóm **🔴 Hay quên** để nhắc ôn lại vào tối hôm sau.
5. **Xác nhận & Trao thưởng**:
   - Người hướng dẫn bấm **Xác nhận +⭐** để cộng sao thưởng và nối dài **Chuỗi ngày học (Streak)** cho học sinh.

