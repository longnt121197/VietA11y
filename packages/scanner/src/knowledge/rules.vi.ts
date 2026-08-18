export interface VietnameseKnowledgeEntry {
  ruleId: string;
  title: string;
  explanation: string;
  whyItMatters: string;
  remediation: string;
  example?: string;
}

export const curatedVietnameseRules: Record<
  string,
  VietnameseKnowledgeEntry
> = {
  "image-alt": {
    ruleId: "image-alt",
    title: "Hình ảnh thiếu văn bản thay thế",
    explanation:
      "Phần tử <img> chưa có nội dung thay thế để truyền đạt mục đích hoặc thông tin của hình ảnh.",
    whyItMatters:
      "Screen reader cần văn bản thay thế để người không nhìn thấy hình vẫn hiểu được nội dung. Văn bản này cũng hữu ích khi hình ảnh không tải được.",
    remediation:
      "Viết thuộc tính alt ngắn gọn theo mục đích của hình trong ngữ cảnh. Nếu hình chỉ để trang trí, dùng alt rỗng (alt=\"\") để công nghệ hỗ trợ có thể bỏ qua. Không dùng alt rỗng cho hình có thông tin hoặc chức năng.",
    example: '<img src="search.svg" alt="Tìm kiếm">',
  },
  "button-name": {
    ruleId: "button-name",
    title: "Nút không có tên có thể truy cập",
    explanation:
      "Nút không cung cấp tên mà công nghệ hỗ trợ có thể xác định, thường do nút chỉ chứa biểu tượng hoặc nội dung bị ẩn khỏi cây trợ năng.",
    whyItMatters:
      "Người dùng screen reader cần biết nút sẽ thực hiện hành động gì trước khi kích hoạt nó. Tên rõ ràng cũng giúp điều khiển bằng giọng nói đáng tin cậy hơn.",
    remediation:
      "Ưu tiên văn bản hiển thị rõ nghĩa bên trong <button>. Với nút chỉ có biểu tượng, cung cấp tên phù hợp bằng aria-label hoặc aria-labelledby; tên phải mô tả hành động trong đúng ngữ cảnh.",
    example: '<button type="button" aria-label="Đóng hộp thoại">×</button>',
  },
  label: {
    ruleId: "label",
    title: "Trường biểu mẫu thiếu nhãn",
    explanation:
      "Một điều khiển biểu mẫu không có nhãn được liên kết để mô tả dữ liệu cần nhập hoặc lựa chọn.",
    whyItMatters:
      "Nhãn giúp mọi người hiểu mục đích của trường. Screen reader dùng mối liên kết này để đọc tên trường khi người dùng di chuyển đến điều khiển.",
    remediation:
      "Dùng <label> hiển thị và liên kết bằng for/id khi có thể. Nếu giao diện đã có văn bản mô tả phù hợp, aria-labelledby có thể tham chiếu đến văn bản đó. Placeholder không nên là nhãn duy nhất.",
    example:
      '<label for="email">Email</label>\n<input id="email" name="email" type="email">',
  },
  "link-name": {
    ruleId: "link-name",
    title: "Liên kết không có tên có thể truy cập",
    explanation:
      "Liên kết không có nội dung hoặc tên mà công nghệ hỗ trợ có thể nhận biết.",
    whyItMatters:
      "Người dùng screen reader thường duyệt danh sách liên kết riêng khỏi phần nội dung xung quanh, nên mỗi liên kết cần cho biết đích đến hoặc mục đích.",
    remediation:
      "Dùng nội dung liên kết mô tả rõ đích đến. Với liên kết chỉ có hình hoặc biểu tượng, bảo đảm hình có alt phù hợp hoặc cung cấp tên bằng aria-label/aria-labelledby. Tránh tên mơ hồ như “xem thêm” khi đứng riêng.",
    example: '<a href="/bao-cao">Xem báo cáo accessibility</a>',
  },
  "document-title": {
    ruleId: "document-title",
    title: "Tài liệu thiếu tiêu đề trang",
    explanation:
      "Tài liệu HTML không có phần tử <title> không rỗng để xác định tên trang.",
    whyItMatters:
      "Tiêu đề giúp người dùng nhận biết trang trong tab trình duyệt, lịch sử và kết quả tìm kiếm. Screen reader thường thông báo tiêu đề khi trang được tải.",
    remediation:
      "Thêm <title> ngắn gọn, riêng biệt và mô tả mục đích chính của trang. Với ứng dụng thay đổi nội dung theo tuyến, hãy cập nhật tiêu đề tương ứng với trang hiện tại.",
    example: "<title>Báo cáo accessibility | VietA11y</title>",
  },
  "html-has-lang": {
    ruleId: "html-has-lang",
    title: "Trang chưa khai báo ngôn ngữ chính",
    explanation:
      "Phần tử <html> không có thuộc tính lang để xác định ngôn ngữ chính của tài liệu.",
    whyItMatters:
      "Screen reader dựa vào ngôn ngữ tài liệu để chọn cách phát âm phù hợp. Khai báo sai hoặc thiếu có thể khiến nội dung tiếng Việt khó hiểu.",
    remediation:
      "Đặt mã ngôn ngữ hợp lệ trên <html>, chẳng hạn lang=\"vi\" cho trang chủ yếu bằng tiếng Việt. Đánh dấu riêng những đoạn đổi sang ngôn ngữ khác khi cần.",
    example: '<html lang="vi">',
  },
  "html-lang-valid": {
    ruleId: "html-lang-valid",
    title: "Giá trị ngôn ngữ của trang không hợp lệ",
    explanation:
      "Thuộc tính lang trên phần tử <html> có giá trị không được nhận diện là mã ngôn ngữ hợp lệ.",
    whyItMatters:
      "Công nghệ hỗ trợ dùng ngôn ngữ của trang để chọn quy tắc phát âm và cách trình bày phù hợp. Giá trị không hợp lệ có thể khiến người dùng nghe nội dung với phát âm sai hoặc không nhất quán.",
    remediation:
      "Đặt lang trên <html> bằng mã ngôn ngữ hợp lệ theo BCP 47, chẳng hạn lang=\"vi\" cho trang chủ yếu bằng tiếng Việt hoặc lang=\"en\" cho trang chủ yếu bằng tiếng Anh. Nếu một phần nội dung chuyển ngôn ngữ, đánh dấu phần đó bằng lang riêng thay vì dùng giá trị không chuẩn.",
    example: '<html lang="vi">',
  },
  "color-contrast": {
    ruleId: "color-contrast",
    title: "Độ tương phản văn bản chưa đủ",
    explanation:
      "Màu chữ và màu nền được axe đo có tỷ lệ tương phản thấp hơn ngưỡng tối thiểu áp dụng cho kích thước và kiểu chữ đó.",
    whyItMatters:
      "Độ tương phản thấp làm nội dung khó đọc với người có thị lực kém, suy giảm nhận biết màu hoặc khi dùng màn hình trong điều kiện ánh sáng bất lợi.",
    remediation:
      "Điều chỉnh màu chữ, màu nền, kích thước hoặc độ đậm để đạt tỷ lệ phù hợp. Kiểm tra mọi trạng thái tương tác và nền thực tế; với nền ảnh, gradient hoặc độ trong suốt, cần kiểm tra thêm bằng công cụ và quan sát thủ công.",
  },
  "heading-order": {
    ruleId: "heading-order",
    title: "Thứ tự cấp tiêu đề chưa hợp lý",
    explanation:
      "Cấu trúc tiêu đề tăng cấp đột ngột, ví dụ từ <h2> sang <h4>, nên không phản ánh rõ quan hệ giữa các phần nội dung.",
    whyItMatters:
      "Nhiều người dùng công nghệ hỗ trợ duyệt trang theo danh sách tiêu đề. Cấu trúc nhất quán giúp họ hiểu bố cục và chuyển nhanh đến phần cần đọc.",
    remediation:
      "Chọn cấp tiêu đề theo cấu trúc nội dung, không theo kích thước chữ mong muốn. Thông thường chỉ tăng từng cấp khi đi vào phần con; dùng CSS để trình bày hình thức. Vẫn cần xem xét toàn bộ ngữ cảnh của trang.",
  },
  "aria-command-name": {
    ruleId: "aria-command-name",
    title: "Điều khiển ARIA không có tên có thể truy cập",
    explanation:
      "Phần tử mang role lệnh như button, link hoặc menuitem không cung cấp tên mà công nghệ hỗ trợ có thể xác định.",
    whyItMatters:
      "Nếu chỉ biết vai trò mà không biết tên, người dùng screen reader không thể hiểu điều khiển sẽ làm gì.",
    remediation:
      "Ưu tiên phần tử HTML gốc có nội dung văn bản rõ nghĩa. Khi thực sự cần role ARIA, cung cấp tên từ nội dung, aria-label hoặc aria-labelledby và bảo đảm hành vi bàn phím phù hợp với role; ARIA không tự bổ sung hành vi tương tác.",
  },
  "aria-input-field-name": {
    ruleId: "aria-input-field-name",
    title: "Trường nhập ARIA không có tên có thể truy cập",
    explanation:
      "Phần tử mang role trường nhập ARIA không có tên để mô tả giá trị hoặc lựa chọn mà nó điều khiển.",
    whyItMatters:
      "Screen reader cần cả role và tên để người dùng hiểu cách tương tác với trường tùy chỉnh, chẳng hạn combobox hoặc slider.",
    remediation:
      "Ưu tiên điều khiển HTML gốc kèm <label> khi phù hợp. Với widget ARIA tùy chỉnh, đặt tên bằng aria-labelledby hoặc aria-label, đồng thời triển khai đầy đủ trạng thái và tương tác bàn phím mà mẫu ARIA tương ứng yêu cầu.",
  },
};
