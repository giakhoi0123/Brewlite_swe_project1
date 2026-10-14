import { ProductImage } from "@/components/ui";
import imageUrls from "@/services/demo-image-urls.json";

export function AuthFeature() {
  return (
    <aside className="auth-feature">
      <ProductImage src={imageUrls[0]} alt="Ly cà phê phin Việt Nam" />
      <div className="auth-feature-content">
        <span className="eyebrow">Cà phê phin thủ công & số hóa</span>
        <h2>Hương vị đậm đà,<br />trải nghiệm trọn vẹn.</h2>
        <p>Chào mừng bạn đến BrewLite. Chọn món yêu thích và lưu lại khẩu vị riêng cho mỗi lần ghé quán.</p>
        <div className="auth-benefits">
          <strong>Đặc quyền BrewLite Club</strong>
          <span>✦ &nbsp; Theo dõi đơn hàng dễ dàng</span>
          <span>✦ &nbsp; Lưu lịch sử đặt món</span>
          <span>✦ &nbsp; Tích điểm sau khi thanh toán</span>
        </div>
      </div>
    </aside>
  );
}
