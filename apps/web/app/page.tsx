import { ScanExperience } from "./scan-experience";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-16">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-800">
          Vietnamese Web Accessibility Scanner
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          VietA11y
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-700">
          Quét một trạng thái của một trang web và đọc kết quả axe-core cùng
          hướng dẫn tiếng Việt đã được biên soạn.
        </p>
      </header>

      <aside
        aria-labelledby="development-notice-title"
        className="mt-8 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950"
      >
        <h2 id="development-notice-title" className="font-semibold">
          Chỉ dành cho môi trường cục bộ hoặc tự lưu trữ có kiểm soát
        </h2>
        <p className="mt-2 leading-7">
          Phiên bản này chưa hoàn thành cổng bảo mật để tiếp nhận URL tùy ý từ
          người dùng không đáng tin cậy. Không triển khai công khai tính năng
          quét URL ở giai đoạn này.
        </p>
      </aside>

      <ScanExperience />
    </main>
  );
}
