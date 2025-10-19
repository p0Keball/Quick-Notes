let currentURL = "";
let editingNoteId = null;
let quill = null;

document.addEventListener("DOMContentLoaded", async () => {
  initQuillEditor();
  await get_CurrentTab();
  await loadNotes();
});

//#region Init quill
function initQuillEditor() {
  const editorElement = document.getElementById("note_Content");
  if (editorElement && !quill) {
    quill = new Quill("#note_Content", {
      theme: "snow",
      modules: {
        toolbar: ".editor_toolbar",
      },
      placeholder: "Enter text here ...",
    });
  }
  return quill;
}
//#endregion

//#region Tab change

// Khi user chuyển sang tab khác
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await get_CurrentTab();
  await loadNotes();

  // Reset form nếu đang edit
  if (editingNoteId) {
    document.getElementById("btn_cancel").click();
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

//#region Get URL
async function get_CurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentURL = new URL(tab.url).hostname;
  document.getElementById("current_url").textContent = currentURL;
}
//#endregion

//#region Load note list

//#region Load ghi chú đã lưu trong chrome storage

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

      // Xóa tất cả các thẻ nguy hiểm
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

      // Lấy text thuần và cắt ngắn nếu quá dài
      const textContent = tempDiv.textContent || tempDiv.innerText;
      const maxLength = 150; // Số ký tự tối đa hiển thị
      const isTruncated = textContent.length > maxLength;
      const displayContent = isTruncated
        ? textContent.substring(0, maxLength) + "..."
        : tempDiv.innerHTML;

      return `
        <div class="note-item">
          <div class="note-title">${escapeHtml(note.title)}</div>
          <div class="note-content ${
            isTruncated ? "truncated" : ""
          }" data-full-content="${escapeHtml(tempDiv.innerHTML)}">
            ${
              isTruncated
                ? escapeHtml(textContent.substring(0, maxLength)) + "..."
                : tempDiv.innerHTML
            }
          </div>
          ${
            isTruncated
              ? '<button class="btn-expand" data-id="' +
                note.id +
                '">More</button>'
              : ""
          }
          <div class="note-meta">
            <span>${formatDate(note.last_Modified)}</span>
            <div class="note-actions">
              <button class="btn-small btn-edit" data-id="${
                note.id
              }">✏️ Edit</button>
              <button class="btn-small btn-delete" data-id="${
                note.id
              }">🗑️ Delete</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // Gắn sự kiện cho các nút
  document.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => editNote(e.target.dataset.id));
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => deleteNote(e.target.dataset.id));
  });

  // Gắn sự kiện cho nút "Xem thêm"
  document.querySelectorAll(".btn-expand").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const noteContent = e.target.previousElementSibling;
      const fullContent = noteContent.dataset.fullContent;

      if (noteContent.classList.contains("truncated")) {
        noteContent.innerHTML = fullContent;
        noteContent.classList.remove("truncated");
        e.target.textContent = "Less";
      } else {
        const textContent = noteContent.textContent;
        noteContent.innerHTML =
          escapeHtml(textContent.substring(0, 150)) + "...";
        noteContent.classList.add("truncated");
        e.target.textContent = "More";
      }
    });
  });
}

//#endregion

//#region Format Date
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

//#endregion//

//#region Work with note

//#region Show notification

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

//#region Save

document.getElementById("btn_save").addEventListener("click", async () => {
  if (!quill) {
    console.error("Quill editor chưa được khởi tạo");
    return;
  }

  const title = document.getElementById("note_Title").value.trim();
  const content = quill.root.innerHTML.trim();

  if (!title || content === "<p><br></p>" || content === "") {
    alert("⚠️ Missing title or note content!");
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
  document.getElementById("btn_cancel").click();

  //Reload danh sách
  await loadNotes();
  updateStats();

  //Hiển thị thông báo
  showNotification("✅ Saved!");
});

//#endregion

//#region Cancel

document.getElementById("btn_cancel").addEventListener("click", async () => {
  document.getElementById("note_Title").value = "";
  if (quill) quill.setText("");
  document.getElementById("btn_save").textContent = "💾 Lưu ghi chú";
});

//#endregion

//#region Note list

//#region Edit note

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

//#region Update extension stats

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

//#region Shortcut

document.addEventListener("keydown", async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault(); // Ngăn browser save page
    document.getElementById("btn_save").click();
  }

  // Ctrl+Enter để lưu (alternative)
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    document.getElementById("btn_save").click();
  }

  // Escape để hủy/clear
  if (e.key === "Escape") {
    document.getElementById("btn_cancel").click();
  }
});

//#endregion
