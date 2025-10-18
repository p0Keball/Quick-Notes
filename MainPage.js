//Lấy URL hiện tại
let currentURL = "";
let editingNoteId = null;
let quill = null;

//Khởi tạo khi popup mở
document.addEventListener("DOMContentLoaded", async () => {
  // Khởi tạo Quill editor
  initQuillEditor();

  await get_CurrentTab();
  await loadNotes();
});

//#region Khởi tạo Quill Editor
function initQuillEditor() {
  const editorElement = document.getElementById("note_Content");
  if (editorElement && !quill) {
    quill = new Quill("#note_Content", {
      theme: "snow",
      modules: {
        toolbar: ".editor_toolbar",
      },
      placeholder: "Nhập văn bản ở đây...",
    });
  }
  return quill;
}
//#endregion

//#region Lắng nghe khi đổi tab

// Khi user chuyển sang tab khác
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await get_CurrentTab();
  await loadNotes();

  // Reset form nếu đang edit
  if (editingNoteId) {
    document.getElementById("note_Title").value = "";
    if (quill) {
      quill.setText("");
    }
    editingNoteId = null;
    document.getElementById("btn_save").textContent = "💾 Lưu ghi chú";
  }
});

// Khi URL trong tab hiện tại thay đổi (user navigate)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) {
        await get_CurrentTab();
        await loadNotes();

        // Reset form nếu đang edit
        if (editingNoteId) {
          document.getElementById("note_Title").value = "";
          if (quill) {
            quill.setText("");
          }
          editingNoteId = null;
          document.getElementById("btn_save").textContent = "💾 Lưu ghi chú";
        }
      }
    });
  }
});
//#endregion

//#region Lấy URL
async function get_CurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentURL = new URL(tab.url).hostname;
  document.getElementById("current_url").textContent = currentURL;
}
//#endregion

//#region Load danh sách ghi chú

//#region Load ghi chú đã lưu trong chrom storage
async function loadNotes() {
  const result = await chrome.storage.local.get(["notes"]);
  const notes = result.notes || {};
  const currentNotes = notes[currentURL] || [];

  const notesList = document.getElementById("notesList");
  document.getElementById("noteCount").textContent = currentNotes.length;

  // Cập nhật stats mỗi khi load notes
  await updateStats();

  if (currentNotes.length === 0) {
    notesList.innerHTML = `
            <div class="empty-state">
                <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                </svg>
                <p>Chưa có ghi chú nào</p>
            </div>
        `;
    return;
  }

  currentNotes.sort(
    (a, b) => new Date(b.last_Modified) - new Date(a.last_Modified)
  );

  notesList.innerHTML = currentNotes
    .map((note) => {
      // Tạo div tạm để hiển thị HTML an toàn (chỉ cho phép text formatting)
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = note.content;

      // Xóa tất cả các thẻ nguy hiểm (input, form, script, etc.)
      const dangerousTags = [
        "input",
        "textarea",
        "form",
        "button",
        "script",
        "iframe",
        "object",
        "embed",
      ];
      dangerousTags.forEach((tag) => {
        const elements = tempDiv.querySelectorAll(tag);
        elements.forEach((el) => el.remove());
      });

      return `
        <div class="note-item">
            <div class="note-title">${escapeHtml(note.title)}</div>
            <div class="note-content">${tempDiv.innerHTML}</div>
            <div class="note-meta">
                <span>${formatDate(note.last_Modified)}</span>
                <div class="note-actions">
                    <button class="btn-small btn-edit" data-id="${
                      note.id
                    }">✏️ Sửa</button>
                    <button class="btn-small btn-delete" data-id="${
                      note.id
                    }">🗑️ Xóa</button>
                </div>
            </div>
        </div>
    `;
    })
    .join("");

  //Gắn sự kiện cho các nút
  document.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => editNote(e.target.dataset.id));
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => deleteNote(e.target.dataset.id));
  });
}

//#endregion

//#region Format ngày tháng
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // Nếu trong vòng 1 ngày
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} phút trước`;
    }
    return `${hours} giờ trước`;
  }

  // Nếu trong vòng 7 ngày
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} ngày trước`;
  }

  // Ngày cụ thể
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

//#endregion

//#endregion

//#region Thao tác với note

//#region Hiển thị thông báo

function showNotification(message) {
  // Tạo element thông báo
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;

  document.body.appendChild(notification);

  // Xóa sau 3 giây
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

//#endregion

//#region Lưu ghi chú

document.getElementById("btn_save").addEventListener("click", async () => {
  if (!quill) {
    console.error("Quill editor chưa được khởi tạo");
    return;
  }

  const title = document.getElementById("note_Title").value.trim();
  const content = quill.root.innerHTML.trim();

  if (!title || content === "<p><br></p>" || content === "") {
    alert("⚠️ Vui lòng nhập đầy đủ tiêu đề và nội dung!");
    return;
  }

  const note = {
    id: editingNoteId || Date.now().toString(),
    title,
    content,
    url: currentURL,
    timestamp: new Date().toISOString(),
    last_Modified: new Date().toISOString(),
  };

  //Lấy dữ liệu hiện tại
  const result = await chrome.storage.local.get(["notes"]);
  const notes = result.notes || {};

  //Khởi tạo mảng cho URL nếu chưa có
  if (!notes[currentURL]) {
    notes[currentURL] = [];
  }

  if (editingNoteId) {
    //Cập nhật ghi chú
    const index = notes[currentURL].findIndex((n) => n.id === editingNoteId);
    if (index !== -1) {
      notes[currentURL][index] = note;
    }
    editingNoteId = null;
  } else {
    //Thêm ghi chú mới
    notes[currentURL].push(note);
  }

  //Lưu vào storage
  await chrome.storage.local.set({ notes });

  //Reset form
  document.getElementById("note_Title").value = "";
  quill.setText("");
  document.getElementById("btn_save").textContent = "💾 Lưu ghi chú";

  //Reload danh sách
  await loadNotes();
  updateStats();

  //Hiển thị thông báo
  showNotification("✅ Đã lưu ghi chú thành công!");
});

//#endregion

//#region note list

//#region Sửa ghi chú
async function editNote(id) {
  if (!quill) {
    console.error("Quill editor chưa được khởi tạo");
    return;
  }

  const result = await chrome.storage.local.get(["notes"]);
  const notes = result.notes || {};
  const currentNotes = notes[currentURL] || [];

  const note = currentNotes.find((n) => n.id === id);

  if (note) {
    document.getElementById("note_Title").value = note.title;
    // Sử dụng clipboard để set HTML content vào Quill
    const delta = quill.clipboard.convert(note.content);
    quill.setContents(delta);
    editingNoteId = id;
    document.getElementById("btn_save").textContent = "💾 Cập nhật ghi chú";

    //scroll lên trên
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

//#endregion

//#region Xóa ghi chú
async function deleteNote(id) {
  if (!confirm("❌ Bạn có chắc muốn xóa ghi chú này?")) {
    return;
  }

  const result = await chrome.storage.local.get(["notes"]);
  const notes = result.notes || {};

  if (notes[currentURL]) {
    notes[currentURL] = notes[currentURL].filter((n) => n.id !== id);

    //Xóa URL nếu không còn ghi chú
    if (notes[currentURL].length === 0) delete notes[currentURL];
  }

  await chrome.storage.local.set({ notes });
  await loadNotes();
  updateStats();

  showNotification("🗑️ Đã xóa ghi chú!");
}

//#endregion

//#endregion

//#endregion

//#region Cập nhật extension stats

async function updateStats() {
  const result = await chrome.storage.local.get(["notes"]);
  const notes = result.notes || {};

  let totalNotes = 0;
  const totalPages = Object.keys(notes).length;

  for (const url in notes) {
    totalNotes += notes[url].length;
  }

  document.getElementById("total_notes").textContent = totalNotes;
  document.getElementById("total_pages").textContent = totalPages;
}

// Escape HTML để tránh XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

//#endregion
