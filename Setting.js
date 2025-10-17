//#region Đổi màu

// Lấy các elements
const settingsBtn = document.getElementById("settings-btn");
const colorMenu = document.getElementById("color-menu");

// Khi nhấn vào nút bánh răng
settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  colorMenu.classList.toggle("active");
});

// Khi click ra ngoài thì đóng menu
window.addEventListener("click", (e) => {
  if (!colorMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
    colorMenu.classList.remove("active");
  }
});

// Xử lý khi chọn màu
const colorOptions = document.querySelectorAll(".color-option");
colorOptions.forEach((option) => {
  option.addEventListener("click", () => {
    const color = option.getAttribute("data-color");
    const isDefault = option.classList.contains("default-color");

    // === NÚT MẶC ĐỊNH: Chỉ đổi header, còn lại màu đen ===
    if (isDefault) {
      document.getElementById("header").style.background = color;

      // Reset toàn bộ về màu đen
      document.body.style.background = "#1a1a1a";
      document.body.style.color = "#ffffff";

      document
        .querySelectorAll("input, .ql-toolbar, .note-item")
        .forEach((el) => {
          el.style.background = "#2a2a2a";
          el.style.borderColor = "#444";
        });

      document.querySelectorAll("label, h1, h3, .stat_label").forEach((el) => {
        el.style.color = "#ffffff";
      });

      document.querySelectorAll(".btn").forEach((btn) => {
        if (shouldSkipButton(btn)) return;
        btn.style.background = "#3a3a3a";
        btn.style.color = "#ffffff";
      });

      colorMenu.classList.remove("active");
      return;
    }

    // === ĐỔI MÀU THEME THÔNG THƯỜNG ===
    const isGradient = color.includes("gradient");

    // Lấy màu HEX đại diện (để tính toán)
    const baseHex = extractBaseColor(color);
    const isDark = isDarkColor(baseHex);
    const textColor = isDark ? "#ffffff" : "#1a1a1a";

    // 1. Đổi màu nền và header
    if (isGradient) {
      document.body.style.background = color;
      document.getElementById("header").style.background = color;
    } else {
      document.body.style.background = addOpacity(color, "22");
      document.getElementById("header").style.background = color;
    }

    // 2. Đổi màu input, toolbar, note-item
    document
      .querySelectorAll("input, .ql-toolbar, .note-item")
      .forEach((el) => {
        if (isGradient) {
          el.style.background = addOpacity(baseHex, "11");
          el.style.borderColor = addOpacity(baseHex, "55");
        } else {
          el.style.background = addOpacity(color, "11");
          el.style.borderColor = addOpacity(color, "55");
        }
      });

    // 4. Đổi màu các nút (trừ nút Lưu và Xóa)
    document.querySelectorAll(".btn").forEach((btn) => {
      if (shouldSkipButton(btn)) return;

      if (isGradient) {
        btn.style.background = baseHex;
      } else {
        btn.style.background = color;
      }
      btn.style.color = isDark ? "#fff" : "#000";
    });

    colorMenu.classList.remove("active");
  });
});

// === HÀM HỖ TRỢ ===

// Kiểm tra có phải nút Lưu/Xóa không
function shouldSkipButton(btn) {
  const btnText = btn.textContent.trim().toLowerCase();
  return (
    btnText.includes("lưu") ||
    btnText.includes("xóa") ||
    btnText.includes("save") ||
    btnText.includes("delete")
  );
}

// Thêm opacity vào màu HEX
function addOpacity(color, opacity) {
  // Nếu là gradient, trả về gradient gốc
  if (color.includes("gradient")) return color;

  // Nếu là HEX, thêm opacity
  if (color.startsWith("#")) {
    return color + opacity;
  }

  // Nếu là RGB, chuyển sang RGBA
  if (color.startsWith("rgb(")) {
    const opacityValue = parseInt(opacity, 16) / 255;
    return color.replace("rgb(", "rgba(").replace(")", `, ${opacityValue})`);
  }

  return color;
}

// Trích xuất màu HEX cơ bản từ bất kỳ format nào
function extractBaseColor(color) {
  // Nếu đã là HEX
  if (color.startsWith("#")) {
    return color;
  }

  // Nếu là gradient, lấy màu HEX đầu tiên
  if (color.includes("gradient")) {
    const hexMatch = color.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/);
    if (hexMatch)
      return hexMatch[0].length === 4 ? expandHex(hexMatch[0]) : hexMatch[0];

    // Nếu không có HEX, lấy RGB
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return rgbToHex(
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3])
      );
    }
  }

  // Nếu là RGB
  if (color.startsWith("rgb")) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return rgbToHex(
        parseInt(match[0]),
        parseInt(match[1]),
        parseInt(match[2])
      );
    }
  }

  // Mặc định trả về màu tím
  return "#667eea";
}

// Chuyển RGB sang HEX
function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

// Mở rộng HEX 3 ký tự thành 6 ký tự (#F00 -> #FF0000)
function expandHex(hex) {
  if (hex.length === 4) {
    return "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
}

// Xác định màu tối hay sáng
function isDarkColor(color) {
  if (!color) return false;

  let r, g, b;

  // Xử lý màu HEX
  if (color.startsWith("#")) {
    let hex = color.substring(1);

    // Chuyển #RGB thành #RRGGBB
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }

    const rgb = parseInt(hex, 16);
    r = (rgb >> 16) & 0xff;
    g = (rgb >> 8) & 0xff;
    b = rgb & 0xff;
  }
  // Xử lý màu RGB/RGBA
  else if (color.startsWith("rgb")) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  }
  // Xử lý gradient
  else if (color.includes("gradient")) {
    const baseColor = extractBaseColor(color);
    return isDarkColor(baseColor);
  }
  // Mặc định
  else {
    return false;
  }

  // Tính độ sáng theo chuẩn W3C
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 140;
}

//#endregion
