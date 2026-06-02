// ============================================================
// CONFIG – chỉ cần đổi SHEET_ID / GID nếu dùng sheet khác
// ============================================================
const SHEET_ID = '1wnG8Mc9kBIRH_pj-SooBOdvhiTJZTvajquVGRIGIZdw';
const GID      = '165825519';
const CSV_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// Mapping tên cột CSV → key nội bộ
const COL_MAP = {
  STT:                   'stt',
  TEN_CHI_NHANH:         'ten',
  SO_TIEN_THUE_THANG:    'tienRaw',
  NGAY_BAT_DAU_HOP_DONG: 'bat_dau',
  KY_THANH_TOAN_THANG:   'ky',
  NGAY_DEN_HAN_KY_NAY:   'den_han',
  TRANG_THAI_HOP_DONG:   'trangThai',
  LOAI_HINH:             'loai',
  VUNG:                  'vung',
  TINH_TRANG_THANH_TOAN: 'tinh_trang',
};

let RAW_DATA = [];

// ============================================================
// CSV PARSER
// ============================================================
function parseCSV(text) {
  // Tách dòng, bỏ \r
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());

  // Tìm dòng header (chứa STT)
  let headerIdx = lines.findIndex(l => l.startsWith('STT,'));
  if (headerIdx === -1) headerIdx = 0;

  const headers = parseCSVLine(lines[headerIdx]);
  const rows = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (!vals[0] || isNaN(Number(vals[0]))) continue; // bỏ dòng rỗng / footer
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = (vals[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

// CSV line parser (hỗ trợ field có dấu phẩy trong ngoặc kép)
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

// Chuyển tiền VD "  25.000.000 " → 25 (triệu)
function parseMoney(str) {
  const clean = str.replace(/[^\d]/g, '');
  if (!clean) return 0;
  const num = parseInt(clean, 10);
  return Math.round(num / 1_000_000); // → triệu
}

function mapRow(raw, idx) {
  return {
    stt:       parseInt(raw['STT']) || (idx + 1),
    ten:       raw['TEN_CHI_NHANH'] || raw['TEN_SACH'] || '',
    loai:      raw['LOAI_HINH'] || '',
    vung:      raw['VUNG'] || '',
    tien:      parseMoney(raw['SO_TIEN_KY_HIEN_TAI'] || raw['SO_TIEN_THUE_THANG'] || ''),
    ky:        parseInt(raw['KY_THANH_TOAN_THANG']) || 0,
    trangThai: raw['TRANG_THAI_HOP_DONG'] || '',
    tinh_trang:raw['TINH_TRANG_THANH_TOAN'] || '',
    bat_dau:   raw['NGAY_BAT_DAU_HOP_DONG'] || '',
    den_han:   raw['NGAY_DEN_HAN_KY_NAY'] || '',
  };
}

// ============================================================
// LOADING / ERROR UI
// ============================================================
function showLoading(msg = 'Đang tải dữ liệu từ Google Sheets…') {
  document.getElementById('kpiGrid').innerHTML = `
    <div style="grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:20px 0;color:var(--text-secondary)">
      <div class="spinner"></div>
      <span style="font-size:0.95rem">${msg}</span>
    </div>`;
}

function showError(msg) {
  document.getElementById('kpiGrid').innerHTML = `
    <div style="grid-column:1/-1;padding:20px;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.2);
      border-radius:12px;color:#f85149;font-size:0.9rem;line-height:1.6">
      ❌ <strong>Không thể tải dữ liệu</strong><br>${msg}
    </div>`;
}

// ============================================================
// PLACEHOLDER – dữ liệu cũ (fallback khi fetch lỗi)
// ============================================================
const FALLBACK_DATA = [
  { stt:1,  ten:"Cau Giay HN2",          loai:"MOLTA",       vung:"Hà Nội",     tien:25,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-01-01", den_han:"2026-07-01" },
  { stt:2,  ten:"Nguyen Trai HN3",        loai:"MOLTA",       vung:"Hà Nội",     tien:35,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-05-01", den_han:"2026-11-01" },
  { stt:3,  ten:"201 Chua Boc HN4",       loai:"MOLTA",       vung:"Hà Nội",     tien:50,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:4,  ten:"203 Chua Boc HN4",       loai:"MOLTA",       vung:"Hà Nội",     tien:70,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:5,  ten:"HN5 Ho Tung Mau",        loai:"MOLTA",       vung:"Hà Nội",     tien:90,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-02-01", den_han:"2026-08-01" },
  { stt:6,  ten:"Hai Phong",              loai:"MOLTA",       vung:"Miền Bắc",   tien:70,  ky:3,  trangThai:"Chờ ký lại",     tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:7,  ten:"Hạ Long",               loai:"MOLTA",       vung:"Miền Bắc",   tien:70,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-07-01" },
  { stt:8,  ten:"Kho Ecom (LTK)",         loai:"MOLTA",       vung:"TP.HCM",     tien:70,  ky:1,  trangThai:"Thiếu hợp đồng", tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:9,  ten:"Spa LTK",               loai:"MOLTA",       vung:"TP.HCM",     tien:70,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Quá hạn",      bat_dau:"2026-04-01", den_han:"2026-05-01" },
  { stt:10, ten:"Kho LTK (284/25/6)",     loai:"MOLTA",       vung:"TP.HCM",     tien:70,  ky:2,  trangThai:"Thiếu hợp đồng", tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:11, ten:"284/25/5 LTK",          loai:"MOLTA",       vung:"TP.HCM",     tien:70,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-05-01", den_han:"2026-11-01" },
  { stt:12, ten:"284/25/6 LTK",          loai:"MOLTA",       vung:"TP.HCM",     tien:70,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-06-01" },
  { stt:13, ten:"Kho LTK (284/25/7)",     loai:"MOLTA",       vung:"TP.HCM",     tien:70,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-06-01" },
  { stt:14, ten:"VP LTK (324D)",          loai:"MOLTA",       vung:"TP.HCM",     tien:90,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:15, ten:"Binh Thanh 144",         loai:"HOLDINGS",    vung:"TP.HCM",     tien:90,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-06-01" },
  { stt:16, ten:"Binh Thanh 142",         loai:"HOLDINGS",    vung:"TP.HCM",     tien:90,  ky:1,  trangThai:"Mới bắt đầu",    tinh_trang:"Quá hạn",      bat_dau:"2026-05-30", den_han:"2026-05-30" },
  { stt:17, ten:"Thu Duc 140",            loai:"HOLDINGS",    vung:"TP.HCM",     tien:90,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-11", den_han:"2026-06-11" },
  { stt:18, ten:"Thu Duc 142",            loai:"HOLDINGS",    vung:"TP.HCM",     tien:90,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:19, ten:"Q1-1 Nguyen Trai",       loai:"HOLDINGS",    vung:"TP.HCM",     tien:90,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:20, ten:"Q10 LTK BOD",           loai:"HOLDINGS",    vung:"TP.HCM",     tien:90,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-04-01", den_han:"2026-10-01" },
  { stt:21, ten:"Q7-1 506A NTT",         loai:"VISION",      vung:"TP.HCM",     tien:90,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:22, ten:"Q7-2 354 NTT",          loai:"VISION",      vung:"TP.HCM",     tien:90,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-06-01" },
  { stt:23, ten:"Thu Duc 2 200 VVN",     loai:"VISION",      vung:"TP.HCM",     tien:90,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:24, ten:"Q9 LVV",               loai:"VISION",      vung:"TP.HCM",     tien:90,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-07-01" },
  { stt:25, ten:"Q9 DXH",               loai:"VISION",      vung:"TP.HCM",     tien:90,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-06-01" },
  { stt:26, ten:"Go Vap 1 - 451 PVT",   loai:"VISION",      vung:"TP.HCM",     tien:90,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-06-01" },
  { stt:27, ten:"Go Vap 1 - 453 PVT",   loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:28, ten:"Go Vap 2 - 155 QT",    loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:29, ten:"Go Vap 2 - 153 QT",    loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:30, ten:"Q5 - 340 NT",          loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:31, ten:"Q5 - 338 NT",          loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:32, ten:"Q8",                   loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:33, ten:"Q1-2 Nguyen Trai",     loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:34, ten:"Q12",                  loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:35, ten:"Phu Nhuan",            loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-05-01", den_han:"2026-08-01" },
  { stt:36, ten:"HMK Gò Dầu",          loai:"VISION",      vung:"TP.HCM",     tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:37, ten:"Can Tho 2 MT",         loai:"RETAIL",      vung:"Miền Tây",   tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:38, ten:"Kien Giang",           loai:"RETAIL",      vung:"Miền Tây",   tien:35,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:39, ten:"Q6-1 Ba Hom",          loai:"RETAIL",      vung:"TP.HCM",     tien:35,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-06-01" },
  { stt:40, ten:"Q6-2 Hau Giang",       loai:"RETAIL",      vung:"TP.HCM",     tien:35,  ky:1,  trangThai:"Chưa chốt",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-06-06", den_han:"2026-06-06" },
  { stt:41, ten:"Quy Nhon",             loai:"RETAIL",      vung:"Miền Trung", tien:35,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-02-01", den_han:"2026-08-01" },
  { stt:42, ten:"Bien Hoa 2 DK",        loai:"ĐỒNG KHỞI",  vung:"Đông Nam Bộ",tien:35,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:43, ten:"Bien Hoa 3 - 1291 PVT",loai:"ĐỒNG KHỞI",  vung:"Đông Nam Bộ",tien:35,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:44, ten:"Bien Hoa 3 - 2M",      loai:"ĐỒNG KHỞI",  vung:"Đông Nam Bộ",tien:35,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:45, ten:"Bien Hoa 4",           loai:"ĐỒNG KHỞI",  vung:"Đông Nam Bộ",tien:35,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:46, ten:"Bien Hoa 5",           loai:"ĐỒNG KHỞI",  vung:"Đông Nam Bộ",tien:35,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:47, ten:"AEON HUE",             loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:35,  ky:0,  trangThai:"Thiếu thông tin", tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:48, ten:"GIGA MALL",            loai:"HMK VIỆT NAM",vung:"TP.HCM",     tien:35,  ky:0,  trangThai:"Thiếu thông tin", tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:49, ten:"Bac Lieu",             loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:35,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:50, ten:"Buon Ma Thuot",        loai:"HMK VIỆT NAM",vung:"Tây Nguyên", tien:35,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-05-20", den_han:"2026-11-20" },
  { stt:51, ten:"Binh Phuoc",           loai:"HMK VIỆT NAM",vung:"Đông Nam Bộ",tien:35,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:52, ten:"Vinh",                 loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:50,  ky:3,  trangThai:"Thiếu thông tin", tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:53, ten:"Ca Mau",               loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:50,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-05-01", den_han:"2026-08-01" },
  { stt:54, ten:"Can Tho 9A",           loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:50,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:55, ten:"Hue 2",                loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:50,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-01-15", den_han:"2026-07-15" },
  { stt:56, ten:"Can Tho 128",          loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:50,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:57, ten:"Long Xuyen",           loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:50,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-06-01" },
  { stt:58, ten:"Q10 SVH",              loai:"HMK VIỆT NAM",vung:"TP.HCM",     tien:50,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-07-01" },
  { stt:59, ten:"Binh Duong 1",         loai:"HMK VIỆT NAM",vung:"Đông Nam Bộ",tien:50,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:60, ten:"Binh Duong 2",         loai:"HMK VIỆT NAM",vung:"Đông Nam Bộ",tien:50,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-03-01", den_han:"2026-06-01" },
  { stt:61, ten:"Da Nang 1 - 104 LD",   loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:50,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-04-01", den_han:"2026-10-01" },
  { stt:62, ten:"Da Nang 2 NVT",        loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:50,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-01-01", den_han:"2026-07-01" },
  { stt:63, ten:"Vung Tau",             loai:"HMK VIỆT NAM",vung:"Đông Nam Bộ",tien:50,  ky:2,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-07-01" },
  { stt:64, ten:"Da Lat 1",             loai:"HMK VIỆT NAM",vung:"Tây Nguyên", tien:50,  ky:12, trangThai:"Mới bắt đầu",    tinh_trang:"Còn hạn",      bat_dau:"2026-09-22", den_han:"2026-09-22" },
  { stt:65, ten:"HMK Mỹ Tho",          loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:50,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:66, ten:"HMK Cao Lãnh 126",    loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:50,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:67, ten:"HMK Cao Lãnh 124",    loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:50,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:68, ten:"HMK Phan Thiết 95",   loai:"HMK VIỆT NAM",vung:"Đông Nam Bộ",tien:50,  ky:0,  trangThai:"Thiếu thông tin", tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:69, ten:"HMK Phan Thiết 97",   loai:"HMK VIỆT NAM",vung:"Đông Nam Bộ",tien:50,  ky:0,  trangThai:"Thiếu thông tin", tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:70, ten:"HMK Bà Rịa",          loai:"HMK VIỆT NAM",vung:"Đông Nam Bộ",tien:50,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:71, ten:"HMK ĐN3 - 112 LD",    loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:50,  ky:4,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-02-01", den_han:"2026-06-01" },
  { stt:72, ten:"HMK ĐN4 - 828 TĐT",   loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:25,  ky:12, trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2025-11-01", den_han:"2026-11-01" },
  { stt:73, ten:"HMK Trà Vinh",        loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:74, ten:"HMK Đà Lạt 2",        loai:"HMK VIỆT NAM",vung:"Tây Nguyên", tien:25,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2025-12-20", den_han:"2026-06-20" },
  { stt:75, ten:"HMK Thống Nhất",      loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:25,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:76, ten:"Quy Nhon (VN)",        loai:"HMK VIỆT NAM",vung:"Miền Trung", tien:25,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-02-01", den_han:"2026-08-01" },
  { stt:77, ten:"Can Tho 2 MT (VN)",    loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:25,  ky:1,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-05-01", den_han:"2026-06-01" },
  { stt:78, ten:"Kien Giang (VN)",       loai:"HMK VIỆT NAM",vung:"Miền Tây",   tien:25,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:79, ten:"HN1 Tran Dai Nghia",   loai:"HMK VIỆT NAM",vung:"Hà Nội",     tien:25,  ky:0,  trangThai:"Thiếu thông tin", tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:80, ten:"HN2 Cau Giay (VN)",    loai:"HMK VIỆT NAM",vung:"Hà Nội",     tien:25,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-01-01", den_han:"2026-07-01" },
  { stt:81, ten:"HN3 NT 230 (VN)",      loai:"HMK VIỆT NAM",vung:"Hà Nội",     tien:25,  ky:0,  trangThai:"Hết hạn HĐ",     tinh_trang:"Chưa xác định",bat_dau:"",           den_han:"" },
  { stt:82, ten:"HN3 NT 228 (VN)",      loai:"HMK VIỆT NAM",vung:"Hà Nội",     tien:25,  ky:6,  trangThai:"Đang thuê",      tinh_trang:"Còn hạn",      bat_dau:"2026-04-01", den_han:"2026-10-01" },
  { stt:83, ten:"HN4 CB 201 (VN)",      loai:"HMK VIỆT NAM",vung:"Hà Nội",     tien:25,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:84, ten:"HN4 CB 203 (VN)",      loai:"HMK VIỆT NAM",vung:"Hà Nội",     tien:25,  ky:3,  trangThai:"Đang thuê",      tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:85, ten:"Hai Phong (VN)",        loai:"HMK VIỆT NAM",vung:"Miền Bắc",   tien:25,  ky:3,  trangThai:"Chờ ký lại",     tinh_trang:"Sắp đến hạn",  bat_dau:"2026-04-01", den_han:"2026-07-01" },
  { stt:86, ten:"Hạ Long (VN)",         loai:"HMK VIỆT NAM",vung:"Miền Bắc",   tien:25,  ky:2,  trangThai:"Mới bắt đầu",    tinh_trang:"Còn hạn",      bat_dau:"2026-11-20", den_han:"2026-11-20" },
];


// ============================================================
// PALETTE
// ============================================================
const COLORS = {
  blue:   '#58a6ff',
  cyan:   '#39d0d8',
  purple: '#a5a0ff',
  green:  '#3fb950',
  yellow: '#d29922',
  orange: '#f0883e',
  red:    '#f85149',
  pink:   '#f778ba',
  teal:   '#26c6da',
  lime:   '#a8ff3e',
};

const LOAI_COLORS = {
  'HMK VIỆT NAM': COLORS.blue,
  'VISION':       COLORS.cyan,
  'MOLTA':        COLORS.purple,
  'HOLDINGS':     COLORS.green,
  'ĐỒNG KHỞI':   COLORS.orange,
  'RETAIL':       COLORS.pink,
};

const TRANG_THAI_CFG = {
  'Đang thuê':       { cls:'badge--blue',   label:'Đang thuê' },
  'Thiếu hợp đồng': { cls:'badge--red',    label:'Thiếu HĐ' },
  'Thiếu thông tin': { cls:'badge--yellow', label:'Thiếu TT' },
  'Chờ ký lại':     { cls:'badge--orange', label:'Chờ ký lại' },
  'Mới bắt đầu':    { cls:'badge--purple', label:'Mới bắt đầu' },
  'Hết hạn HĐ':     { cls:'badge--red',    label:'Hết hạn HĐ' },
  'Chưa chốt':      { cls:'badge--gray',   label:'Chưa chốt' },
};

const TINH_TRANG_CFG = {
  'Còn hạn':       { cls:'badge--green',  label:'Còn hạn' },
  'Sắp đến hạn':   { cls:'badge--orange', label:'Sắp đến hạn' },
  'Quá hạn':       { cls:'badge--red',    label:'Quá hạn' },
  'Chưa xác định': { cls:'badge--gray',   label:'Chưa xác định' },
};

// ============================================================
// STATE
// ============================================================
let activeFilters = { loai: 'all', vung: 'all', trangThai: 'all' };
let charts = {};

// ============================================================
// HELPERS
// ============================================================
function fmtMoney(v) {
  if (v >= 1000) return (v/1000).toFixed(1).replace(/\.0$/,'') + ' tỷ';
  return v + ' triệu';
}

function countBy(arr, key) {
  return arr.reduce((acc, d) => {
    acc[d[key]] = (acc[d[key]] || 0) + 1;
    return acc;
  }, {});
}

function sumBy(arr, keyGroup, keySum) {
  return arr.reduce((acc, d) => {
    acc[d[keyGroup]] = (acc[d[keyGroup]] || 0) + d[keySum];
    return acc;
  }, {});
}

function filteredData() {
  return RAW_DATA.filter(d => {
    if (activeFilters.loai !== 'all' && d.loai !== activeFilters.loai) return false;
    if (activeFilters.vung !== 'all' && d.vung !== activeFilters.vung) return false;
    if (activeFilters.trangThai !== 'all' && d.trangThai !== activeFilters.trangThai) return false;
    return true;
  });
}

function makeChart(id, cfg) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, cfg);
  return charts[id];
}

// ============================================================
// KPI CARDS
// ============================================================
function renderKPI(data) {
  const total = data.length;
  const dangThue = data.filter(d => d.trangThai === 'Đang thuê').length;
  const sapHan = data.filter(d => d.tinh_trang === 'Sắp đến hạn').length;
  const quaHan = data.filter(d => d.tinh_trang === 'Quá hạn').length;
  const thieu = data.filter(d => ['Thiếu hợp đồng','Thiếu thông tin','Hết hạn HĐ'].includes(d.trangThai)).length;
  const tongTien = data.reduce((s,d) => s + d.tien, 0);

  const kpis = [
    { icon:'🏪', val: total,            label:'Tổng Chi Nhánh',    sub:'đang theo dõi' },
    { icon:'✅', val: dangThue,         label:'Đang Thuê',         sub:'hợp đồng hiệu lực' },
    { icon:'⏰', val: sapHan,           label:'Sắp Đến Hạn',       sub:'cần gia hạn' },
    { icon:'🚨', val: quaHan,           label:'Quá Hạn / Cần Xử Lý',sub:'ưu tiên cao' },
    { icon:'⚠️', val: thieu,           label:'Thiếu Thông Tin',   sub:'cần bổ sung' },
    { icon:'💰', val: fmtMoney(tongTien),label:'Tổng Tiền Kỳ HT', sub:'tổng thanh toán kỳ' },
  ];

  const grid = document.getElementById('kpiGrid');
  grid.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <span class="kpi-icon">${k.icon}</span>
      <div class="kpi-value">${k.val}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-sublabel">${k.sub}</div>
    </div>
  `).join('');
}

// ============================================================
// CHART: LOAI HINH DONUT
// ============================================================
function renderLoaiHinh(data) {
  const counts = countBy(data, 'loai');
  const labels = Object.keys(counts);
  const values = labels.map(l => counts[l]);
  const colors = labels.map(l => LOAI_COLORS[l] || COLORS.blue);
  const total  = values.reduce((a,b) => a+b, 0);

  makeChart('chartLoaiHinh', {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#1c2330', borderWidth: 3, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} CN (${((ctx.raw/total)*100).toFixed(1)}%)` }
      }},
      animation: { animateRotate: true, duration: 900, easing: 'easeInOutQuart' },
    }
  });

  // Custom legend
  const legend = document.getElementById('donutLegend');
  legend.innerHTML = labels.map((l,i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span class="legend-name">${l}</span>
      <span class="legend-value">${values[i]}</span>
      <span class="legend-pct">${((values[i]/total)*100).toFixed(0)}%</span>
    </div>
  `).join('');
}

// ============================================================
// CHART: VUNG BAR
// ============================================================
function renderVung(data) {
  const order = ['TP.HCM','Hà Nội','Đông Nam Bộ','Miền Tây','Miền Trung','Miền Bắc','Tây Nguyên'];
  const counts = countBy(data, 'vung');
  const labels = order.filter(v => counts[v]);
  const values = labels.map(v => counts[v] || 0);

  makeChart('chartVung', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Số Chi Nhánh',
        data: values,
        backgroundColor: labels.map((_, i) => {
          const pallete = [COLORS.blue, COLORS.cyan, COLORS.orange, COLORS.green, COLORS.purple, COLORS.yellow, COLORS.teal];
          return pallete[i % pallete.length] + 'cc';
        }),
        borderColor: labels.map((_, i) => {
          const pallete = [COLORS.blue, COLORS.cyan, COLORS.orange, COLORS.green, COLORS.purple, COLORS.yellow, COLORS.teal];
          return pallete[i % pallete.length];
        }),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} chi nhánh` } } },
      scales: {
        x: { grid: { color: 'rgba(99,120,160,0.08)' }, ticks: { color: '#8b949e', font: { size: 11 } } },
        y: { grid: { color: 'rgba(99,120,160,0.08)' }, ticks: { color: '#8b949e', stepSize: 1 }, beginAtZero: true },
      },
      animation: { duration: 900 },
    }
  });
}

// ============================================================
// CHART: TINH TRANG THANH TOAN (Horizontal bar)
// ============================================================
function renderThanhToan(data) {
  const ORDER = ['Còn hạn','Sắp đến hạn','Quá hạn','Chưa xác định'];
  const COLOR_MAP = { 'Còn hạn': COLORS.green, 'Sắp đến hạn': COLORS.orange, 'Quá hạn': COLORS.red, 'Chưa xác định': '#4d5566' };
  const counts = countBy(data, 'tinh_trang');
  const labels = ORDER.filter(k => counts[k] !== undefined);
  const values = labels.map(k => counts[k] || 0);
  const colors = labels.map(k => COLOR_MAP[k]);

  makeChart('chartThanhToan', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} chi nhánh` } } },
      scales: {
        x: { grid: { color: 'rgba(99,120,160,0.08)' }, ticks: { color: '#8b949e' }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: '#e6edf3', font: { size: 12, weight:'600' } } },
      },
      animation: { duration: 900 },
    }
  });
}

// ============================================================
// CHART: TRANG THAI HOP DONG
// ============================================================
function renderTrangThai(data) {
  const ORDER = ['Đang thuê','Thiếu hợp đồng','Thiếu thông tin','Chờ ký lại','Mới bắt đầu','Hết hạn HĐ','Chưa chốt'];
  const COLOR_MAP = {
    'Đang thuê':       COLORS.blue,
    'Thiếu hợp đồng': COLORS.red,
    'Thiếu thông tin': COLORS.yellow,
    'Chờ ký lại':     COLORS.orange,
    'Mới bắt đầu':    COLORS.purple,
    'Hết hạn HĐ':     '#f85149',
    'Chưa chốt':      '#4d5566',
  };
  const counts = countBy(data, 'trangThai');
  const labels = ORDER.filter(k => counts[k]);
  const values = labels.map(k => counts[k] || 0);
  const colors = labels.map(k => COLOR_MAP[k] || COLORS.blue);

  makeChart('chartTrangThai', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} chi nhánh` } } },
      scales: {
        x: { grid: { color: 'rgba(99,120,160,0.08)' }, ticks: { color: '#8b949e', font: { size: 10 }, maxRotation: 30 } },
        y: { grid: { color: 'rgba(99,120,160,0.08)' }, ticks: { color: '#8b949e', stepSize: 1 }, beginAtZero: true },
      },
      animation: { duration: 900 },
    }
  });
}

// ============================================================
// CHART: TONG TIEN THUE THEO VUNG
// ============================================================
function renderTienThueVung(data) {
  const order = ['TP.HCM','Hà Nội','Đông Nam Bộ','Miền Tây','Miền Trung','Miền Bắc','Tây Nguyên'];
  const sums = sumBy(data, 'vung', 'tien');
  const labels = order.filter(v => sums[v]);
  const values = labels.map(v => sums[v] || 0);

  makeChart('chartTienThueVung', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Triệu đồng',
        data: values,
        backgroundColor: 'rgba(88,166,255,0.15)',
        borderColor: COLORS.blue,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
        fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw.toLocaleString()} triệu đồng` } }
      },
      scales: {
        x: { grid: { color: 'rgba(99,120,160,0.08)' }, ticks: { color: '#8b949e', font: { size: 11 } } },
        y: { grid: { color: 'rgba(99,120,160,0.08)' }, ticks: { color: '#8b949e', callback: v => v+'M' }, beginAtZero: true },
      },
      animation: { duration: 900 },
    }
  });
}

// ============================================================
// CHART: KY THANH TOAN
// ============================================================
function renderKyThanhToan(data) {
  const counts = countBy(data.filter(d => d.ky > 0), 'ky');
  const labels = Object.keys(counts).sort((a,b) => +a - +b).map(k => k + ' tháng');
  const values = Object.keys(counts).sort((a,b) => +a - +b).map(k => counts[k]);
  const colors = [COLORS.blue, COLORS.cyan, COLORS.purple, COLORS.green, COLORS.orange, COLORS.yellow, COLORS.pink];

  makeChart('chartKyThanhToan', {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: { color: '#8b949e', font: { size: 11 }, padding: 10, boxWidth: 12, boxHeight: 12 }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} CN` } }
      },
      animation: { duration: 900 },
    }
  });
}

// ============================================================
// HEATMAP: VUNG x LOAI
// ============================================================
function renderHeatmap(data) {
  const VUNGS = ['TP.HCM','Hà Nội','Đông Nam Bộ','Miền Tây','Miền Trung','Miền Bắc','Tây Nguyên'];
  const LOAIS = ['HMK VIỆT NAM','VISION','MOLTA','HOLDINGS','ĐỒNG KHỞI','RETAIL'];

  // Count
  const matrix = {};
  LOAIS.forEach(l => { matrix[l] = {}; VUNGS.forEach(v => { matrix[l][v] = 0; }); });
  data.forEach(d => { if (matrix[d.loai]) matrix[d.loai][d.vung] = (matrix[d.loai][d.vung] || 0) + 1; });

  // Max for color scaling
  let maxVal = 1;
  LOAIS.forEach(l => VUNGS.forEach(v => { if (matrix[l][v] > maxVal) maxVal = matrix[l][v]; }));

  function heatColor(val) {
    if (val === 0) return { bg: 'rgba(99,120,160,0.04)', text: '#4d5566' };
    const intensity = val / maxVal;
    if (intensity < 0.25) return { bg: `rgba(88,166,255,${0.08 + intensity*0.3})`, text: '#58a6ff' };
    if (intensity < 0.5)  return { bg: `rgba(57,208,216,${0.15 + intensity*0.3})`, text: '#39d0d8' };
    if (intensity < 0.75) return { bg: `rgba(240,136,62,${0.2 + intensity*0.25})`, text: '#f0883e' };
    return { bg: `rgba(248,81,73,${0.25 + intensity*0.25})`, text: '#f85149' };
  }

  let html = `<table class="heatmap-table">
    <thead><tr><th></th>${VUNGS.map(v => `<th>${v}</th>`).join('')}</tr></thead>
    <tbody>`;

  LOAIS.forEach(l => {
    html += `<tr><td class="heatmap-label" style="color:${LOAI_COLORS[l]||'#8b949e'}">${l}</td>`;
    VUNGS.forEach(v => {
      const val = matrix[l][v];
      const { bg, text } = heatColor(val);
      html += `<td style="background:${bg};color:${text}" title="${l} – ${v}: ${val} chi nhánh">${val > 0 ? val : '–'}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('heatmapWrap').innerHTML = html;
}

// ============================================================
// TABLE
// ============================================================
function renderTable(data) {
  const tbody = document.getElementById('detailTableBody');
  tbody.innerHTML = data.map(d => {
    const tt_cfg  = TRANG_THAI_CFG[d.trangThai]  || { cls:'badge--gray', label: d.trangThai };
    const tin_cfg = TINH_TRANG_CFG[d.tinh_trang] || { cls:'badge--gray', label: d.tinh_trang };
    const loaiColor = LOAI_COLORS[d.loai] || '#8b949e';
    return `<tr>
      <td style="color:var(--text-muted)">${d.stt}</td>
      <td style="font-weight:600">${d.ten}</td>
      <td><span style="color:${loaiColor};font-weight:600;font-size:0.8rem">${d.loai}</span></td>
      <td style="color:var(--text-secondary)">${d.vung}</td>
      <td style="font-weight:600;color:var(--accent-cyan)">${d.tien.toLocaleString()}M</td>
      <td style="text-align:center;color:var(--text-secondary)">${d.ky > 0 ? d.ky+' th' : '–'}</td>
      <td style="color:var(--text-secondary)">${d.bat_dau || '–'}</td>
      <td style="color:var(--text-secondary)">${d.den_han || '–'}</td>
      <td><span class="badge ${tt_cfg.cls}">${tt_cfg.label}</span></td>
      <td><span class="badge ${tin_cfg.cls}">${tin_cfg.label}</span></td>
    </tr>`;
  }).join('');
}

// ============================================================
// FILTER DROPDOWNS
// ============================================================
function initFilters() {
  const loais = [...new Set(RAW_DATA.map(d => d.loai))].sort();
  const vungs = [...new Set(RAW_DATA.map(d => d.vung))].sort();
  const tts   = [...new Set(RAW_DATA.map(d => d.trangThai))].sort();

  const selLoai = document.getElementById('filterLoaiHinh');
  const selVung = document.getElementById('filterVung');
  const selTT   = document.getElementById('filterTrangThai');

  loais.forEach(l => selLoai.add(new Option(l, l)));
  vungs.forEach(v => selVung.add(new Option(v, v)));
  tts.forEach(t   => selTT.add(new Option(t, t)));

  selLoai.addEventListener('change', () => { activeFilters.loai = selLoai.value; renderAll(); });
  selVung.addEventListener('change', () => { activeFilters.vung = selVung.value; renderAll(); });
  selTT.addEventListener('change',   () => { activeFilters.trangThai = selTT.value; renderAll(); });
}

// ============================================================
// TABLE SEARCH
// ============================================================
function initTableSearch() {
  document.getElementById('tableSearch').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    const rows = document.querySelectorAll('#detailTableBody tr');
    rows.forEach(row => {
      row.style.display = row.cells[1].textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ============================================================
// MAIN RENDER
// ============================================================
function renderAll() {
  const data = filteredData();
  renderKPI(data);
  renderLoaiHinh(data);
  renderVung(data);
  renderThanhToan(data);
  renderTrangThai(data);
  renderTienThueVung(data);
  renderKyThanhToan(data);
  renderHeatmap(data);
  renderTable(data);
}

// ============================================================
// INIT – Auto-fetch từ Google Sheets
// ============================================================
function updateTimestamp() {
  const now = new Date();
  document.getElementById('updateTime').textContent =
    now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });
}

function injectSpinnerCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .spinner {
      width: 22px; height: 22px;
      border: 3px solid rgba(88,166,255,0.2);
      border-top-color: #58a6ff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

async function loadData() {
  showLoading();
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rawRows = parseCSV(text);
    if (rawRows.length === 0) throw new Error('Sheet trống hoặc không đọc được dữ liệu');
    RAW_DATA = rawRows.map((r, i) => mapRow(r, i)).filter(d => d.ten);
    console.log(`✅ Đã tải ${RAW_DATA.length} chi nhánh từ Google Sheets`);
  } catch (err) {
    console.warn('⚠️ Fetch thất bại, dùng dữ liệu offline:', err.message);
    RAW_DATA = FALLBACK_DATA;
    // Hiển thị banner cảnh báo nhỏ thay vì block cả trang
    const banner = document.createElement('div');
    banner.style.cssText = `
      position:fixed; bottom:20px; right:20px; z-index:999;
      background:rgba(240,136,62,0.12); border:1px solid rgba(240,136,62,0.35);
      border-radius:12px; padding:12px 18px; font-size:0.82rem;
      color:#f0883e; max-width:340px; line-height:1.5;
      animation: fadeInUp 0.4s ease;
    `;
    banner.innerHTML = `⚠️ <strong>Đang dùng dữ liệu offline</strong><br>
      Không kết nối được Google Sheets.<br>
      <span style="color:var(--text-muted);font-size:0.75rem">${err.message}</span>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
  }

  // Sau khi có dữ liệu (dù online hay offline) → render
  initFilters();
  initTableSearch();
  renderAll();
  updateTimestamp();

  // Thêm nút Refresh trên header
  addRefreshButton();
}

function addRefreshButton() {
  if (document.getElementById('btnRefresh')) return;
  const btn = document.createElement('button');
  btn.id = 'btnRefresh';
  btn.innerHTML = '🔄 Làm mới';
  btn.style.cssText = `
    background:rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.25);
    color:#58a6ff; border-radius:20px; padding:6px 14px;
    font-size:0.8rem; font-family:inherit; cursor:pointer;
    transition:all 0.2s; white-space:nowrap;
  `;
  btn.onmouseenter = () => btn.style.background = 'rgba(88,166,255,0.2)';
  btn.onmouseleave = () => btn.style.background = 'rgba(88,166,255,0.1)';
  btn.onclick = async () => {
    btn.innerHTML = '⏳ Đang tải…';
    btn.disabled = true;
    // Reset filters
    activeFilters = { loai:'all', vung:'all', trangThai:'all' };
    document.getElementById('filterLoaiHinh').value = 'all';
    document.getElementById('filterVung').value = 'all';
    document.getElementById('filterTrangThai').value = 'all';
    // Clear filter options (will be rebuilt)
    ['filterLoaiHinh','filterVung','filterTrangThai'].forEach(id => {
      const sel = document.getElementById(id);
      while (sel.options.length > 1) sel.remove(1);
    });
    await loadData();
    btn.innerHTML = '🔄 Làm mới';
    btn.disabled = false;
  };
  document.querySelector('.filter-bar').prepend(btn);
}

document.addEventListener('DOMContentLoaded', () => {
  injectSpinnerCSS();
  loadData();
});
