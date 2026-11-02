const imageInput = document.querySelector("#imageInput");
const cameraInput = document.querySelector("#cameraInput");
const uploadZone = document.querySelector("#uploadZone");
const checklistBody = document.querySelector("#checklistBody");
const emptyState = document.querySelector("#emptyState");
const toast = document.querySelector("#toast");
const modelTableInput = document.querySelector("#modelTableInput");
const modelTableStatus = document.querySelector("#modelTableStatus");

let toastTimer;
let checklistItems = [];
const modelTableStorageKey = "checklistModelDimensions";
const inspectionOptions = [
  "鋁門窗工程",
  "防火門工程",
];
const defaultModelDimensionTable = `型號,寬,高
FD1,85,200
FD2a,65,180
FD2b,85,180
FD2c,100,165
FD3a,105,220
FD3b,105,220
FD4a,110,220
FD5,110,220
FD6,110,220
FD7,180,220
FD8a,200,220
FD8b,220,220
FD8c,200,220
FD9a,180,220
FD9b,180,220
D1,100,280
D9,120,220
D6a,90,220
D6b,100,220
D7,200,280
D8,100,280
DW1,426,280
DW2,359,280
DW3,480,280
DW4,756,280
DW5,556,280
DW6,205,280
DW7,500,220
DW8,515,280
DW9a,180,210
DW9b,200,220
DW9c,249,220
DW9d,160,220
DW10,340,280
DW11,560,280
DW12,680,280
DW13,420,280
DW14,420,280
DW15,675,280
DW16a,182,220
DW16b,154,220
DW17,180,220
DW18,385,220
DW19,370,220
DW20,430,220
DW21,595,220
DW22,756,220
DW23,925,220
DW24,1357,220
DW25,1295,220
W1,210,260
W3,260,260
W4,700,260
W5,520,260
W6,700,180
W7,756,220
W12,100,180
W13,200,180
W14,220,180
W15,400,180
W16,325,180
W17,520,180
W18,80,60
W19,90,60
W20a,120,140
W20c,180,140
W20d,182,200
W21,285,100
W22,210,215
W23,210,215
SW1,210,215
SW2,210,260
SW3,190,250
AW1a,160,90
AW1b,140,90
AW1c,160,80
AW1d,120,80
AW2a,131,340
AW2b,176,340
AW2c,219,340
AW2d,196,340
AW2e,159,340
AW2f,335,340
AW4,130,340
AW5,130,235
AW6,260,340
AW7a,160,260
AW7b,160,170
AW8a,240,260
AW8b,240,170
AW9,180,340
AW10a,200,165
AW10b,242,165
AW11,210,100
FW1,65,65
fw3,250,240`;

function parseDelimitedRow(line, delimiter) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalizeModelName(model) {
  return String(model || "").trim().toLocaleUpperCase("en-US");
}

function parseModelDimensionTable(text) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return new Map();
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map((line) => parseDelimitedRow(line, delimiter));
  const headers = rows[0].map((header) => header.toLocaleLowerCase("en-US").replace(/\s/g, ""));
  const modelColumn = headers.findIndex((header) => ["型號", "型式", "model", "code"].includes(header));
  const widthColumn = headers.findIndex((header) => header.startsWith("寬") || header === "width");
  const heightColumn = headers.findIndex((header) => header.startsWith("高") || header === "height");
  const hasHeader = modelColumn >= 0 && widthColumn >= 0 && heightColumn >= 0;
  const columns = hasHeader ? [modelColumn, widthColumn, heightColumn] : [0, 1, 2];
  const table = new Map();
  rows.slice(hasHeader ? 1 : 0).forEach((row) => {
    const [model, width, height] = columns.map((column) => row[column] || "");
    if (model && width && height) table.set(normalizeModelName(model), { model, width, height });
  });
  return table;
}

function loadModelDimensions() {
  const defaults = parseModelDimensionTable(defaultModelDimensionTable);
  try {
    const saved = JSON.parse(localStorage.getItem(modelTableStorageKey));
    if (Array.isArray(saved) && saved.length) {
      const imported = new Map(saved.filter(([model, size]) => model && size?.width && size?.height)
        .map(([model, size]) => [normalizeModelName(model), size]));
      if (imported.size) return imported;
    }
  } catch (error) {
    console.warn("Saved model dimensions could not be loaded", error);
  }
  return defaults;
}

let modelDimensions = loadModelDimensions();

function getModelDimension(model) {
  const size = modelDimensions.get(normalizeModelName(model));
  return size ? `${size.width}*${size.height}cm` : "";
}

function updateModelOptions() {
  document.querySelector("#modelOptions").innerHTML = [...modelDimensions.values()]
    .map(({ model }) => `<option value="${escapeHtml(model)}"></option>`).join("");
  modelTableStatus.textContent = `型號尺寸表 ${modelDimensions.size} 筆`;
}

document.querySelector("#todayDate").textContent = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function addPhotos(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  let added = 0;
  let rejected = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      rejected += 1;
      continue;
    }
    checklistItems.push(createRecord({ file, url: URL.createObjectURL(file) }));
    added += 1;
  }
  if (added) renderChecklist();
  if (rejected) notify(`已建立 ${added} 筆照片紀錄；${rejected} 個檔案格式不符或超過 20 MB。`);
  else if (added) notify(`已依 ${added} 張照片建立檢查紀錄，請補填檢查內容。`);
}

imageInput.addEventListener("change", (event) => {
  addPhotos(event.target.files);
  imageInput.value = "";
});
cameraInput.addEventListener("change", (event) => {
  addPhotos(event.target.files);
  cameraInput.value = "";
});
document.querySelector("#cameraButton").addEventListener("click", () => cameraInput.click());
document.querySelector("#modelTableButton").addEventListener("click", () => modelTableInput.click());
modelTableInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("檔案不可超過 5 MB");
    const imported = parseModelDimensionTable(await file.text());
    if (!imported.size) throw new Error("找不到有效資料，請確認欄位為型號、寬、高");
    modelDimensions = imported;
    localStorage.setItem(modelTableStorageKey, JSON.stringify([...modelDimensions]));
    updateModelOptions();
    checklistItems.forEach((item) => {
      if (item.standardType === "型號") item.actual = standardActualValue(item);
    });
    updateModelDimensionFields();
    updateActualFields();
    notify(`已載入 ${modelDimensions.size} 筆型號尺寸資料。`);
  } catch (error) {
    notify(`型號尺寸表載入失敗：${error.message}`);
  } finally {
    modelTableInput.value = "";
  }
});
uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("dragover");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("dragover");
  addPhotos(event.dataTransfer.files);
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderChecklist() {
  const masterIndex = getSyncSourceIndex();
  emptyState.hidden = checklistItems.length > 0;
  checklistBody.innerHTML = checklistItems.map((item, index) => `
    <tr class="${(index + 1) % 3 === 0 && index < checklistItems.length - 1 ? "print-page-break" : ""}" data-index="${index}">
      <td class="record-photo-cell">
        ${item.photo ? `<img class="record-photo" src="${item.photo.url}" alt="第 ${index + 1} 筆自主檢查照片：${escapeHtml(item.photo.file.name)}" />` : `<div class="record-photo-empty"><i data-lucide="image"></i><span>尚未加入照片</span></div>`}
        <button class="delete-row" type="button" data-remove="${index}" aria-label="刪除第 ${index + 1} 筆檢查紀錄"><i data-lucide="x"></i></button>
      </td>
      <td class="record-details-cell">
        <div class="record-meta">
          <label class="record-field"><span>日期：</span><input type="date" data-field="checkDate" aria-label="第 ${index + 1} 筆檢查日期" value="${escapeHtml(item.checkDate)}" ${index === masterIndex ? "" : "disabled title='依第一張照片同步'"} /></label>
          <label class="record-field"><span>檢查項目：</span><select data-field="item" aria-label="第 ${index + 1} 筆檢查項目" ${index === masterIndex ? "" : "disabled title='依第一張照片同步'"}>
            <option value=""${item.item ? "" : " selected"}>請選擇檢查項目</option>
            ${inspectionOptions.map((option) => `<option value="${escapeHtml(option)}"${item.item === option ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
          </select></label>
          <div class="location-selects" aria-label="檢查位置">
            <label class="location-field"><span>棟別</span><input list="buildingOptions" data-field="building" aria-label="第 ${index + 1} 筆棟別" value="${escapeHtml(item.building)}" placeholder="選擇／輸入" ${index === masterIndex ? "" : "disabled title='依第一張照片同步'"} /></label>
            <label class="location-field"><span>樓層</span><input list="floorOptions" data-field="floor" aria-label="第 ${index + 1} 筆樓層" value="${escapeHtml(item.floor)}" placeholder="選擇／輸入" ${index === masterIndex ? "" : "disabled title='依第一張照片同步'"} /></label>
            <label class="location-field"><span>位置</span><input list="roomOptions" data-field="room" aria-label="第 ${index + 1} 筆位置" value="${escapeHtml(item.room)}" placeholder="選擇／輸入" /></label>
          </div>
        </div>
        <label class="record-long-field record-standard-field"><span>檢查標準：</span>
          <div class="standard-fields">
            <select data-field="standardType" aria-label="第 ${index + 1} 筆檢查標準類型">
              <option value=""${item.standardType ? "" : " selected"}>選擇類型</option>
              <option value="型號"${item.standardType === "型號" ? " selected" : ""}>型號</option>
              <option value="固定間距"${item.standardType === "固定間距" ? " selected" : ""}>固定間距</option>
            </select>
            <div class="standard-fields-detail"></div>
          </div>
        </label>
        <label class="record-long-field"><span>實際：</span><textarea data-field="actual" aria-label="第 ${index + 1} 筆實際情況" placeholder="請填寫實際檢查結果">${escapeHtml(item.actual)}</textarea></label>
      </td>
    </tr>`).join("");
  if (window.lucide) lucide.createIcons();
  updateStandardFields();
  document.querySelector("#itemCount").textContent = `${checklistItems.length} 項`;
  document.querySelector("#recordCount").textContent = `${checklistItems.length} 筆檢查紀錄`;
  document.querySelector("#photoSummary").textContent = `${checklistItems.filter((item) => item.photo).length} 張照片`;
}

function standardSummary(item) {
  if (item?.standardType === "型號") {
    const dimension = getModelDimension(item.standardModel);
    return `型號：${item.standardModel || ""}${dimension ? `，設計尺寸：${dimension}` : item.standardModel ? "，尺寸未建檔" : ""}`;
  }
  if (item?.standardType === "固定間距") {
    return `固定間距：兩側@${item.standardSpacingSides || ""}cm；中間@@${item.standardSpacingMiddle || ""}cm`;
  }
  return "";
}

function standardActualValue(item) {
  if (item?.standardType === "型號") return getModelDimension(item.standardModel);
  if (item?.standardType === "固定間距") {
    return `兩側@${item.standardSpacingSides || ""}cm；中間@@${item.standardSpacingMiddle || ""}cm`;
  }
  return standardSummary(item);
}

function standardFieldMarkup(item, index) {
  if (item.standardType === "型號") {
    const dimension = getModelDimension(item.standardModel);
    return `<input type="text" list="modelOptions" data-field="standardModel" aria-label="第 ${index + 1} 筆型號" value="${escapeHtml(item.standardModel)}" placeholder="輸入型號" autocomplete="off" />
      <input type="text" data-standard-dimension aria-label="第 ${index + 1} 筆設計尺寸" value="${dimension ? `設計尺寸:${escapeHtml(dimension)}` : ""}" placeholder="設計尺寸:寬*高" readonly />`;
  }
  if (item.standardType === "固定間距") {
    return `<div class="spacing-field"><span>兩側@</span><input type="text" inputmode="decimal" data-field="standardSpacingSides" aria-label="第 ${index + 1} 筆兩側間距" value="${escapeHtml(item.standardSpacingSides ?? "15")}" placeholder="15" /><span>cm</span></div>
      <div class="spacing-field"><span>中間@</span><input type="text" inputmode="decimal" data-field="standardSpacingMiddle" aria-label="第 ${index + 1} 筆中間間距" value="${escapeHtml(item.standardSpacingMiddle ?? "50")}" placeholder="50" /><span>cm</span></div>`;
  }
  return `<input type="text" aria-label="第 ${index + 1} 筆標準內容" placeholder="請先選擇類型" disabled />
    <input type="text" aria-label="第 ${index + 1} 筆標準值" placeholder="標準值" disabled />`;
}

function updateStandardFields() {
  checklistBody.querySelectorAll("tr").forEach((row) => {
    const index = Number(row.dataset.index);
    const item = checklistItems[index];
    row.querySelector(".standard-fields-detail").innerHTML = standardFieldMarkup(item, index);
  });
}

function updateModelDimensionFields() {
  checklistBody.querySelectorAll("[data-standard-dimension]").forEach((control) => {
    const item = checklistItems[Number(control.closest("tr").dataset.index)];
    const dimension = getModelDimension(item.standardModel);
    control.value = dimension ? `設計尺寸:${dimension}` : "";
  });
}

function updateActualFields() {
  checklistBody.querySelectorAll('[data-field="actual"]').forEach((control, index) => {
    control.value = checklistItems[index].actual;
  });
}

function createRecord(photo = null) {
  const master = checklistItems[getSyncSourceIndex()];
  const building = master?.building || "";
  return {
    checkDate: master?.checkDate || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    item: master?.item || "",
    building,
    floor: master?.floor || "",
    room: photo ? nextRoomNumber(building) : "",
    standardType: "",
    standardModel: "",
    standardSpacingSides: "",
    standardSpacingMiddle: "",
    actual: "",
    photo,
  };
}

function roomNumbersForBuilding(building) {
  const prefix = building === "A棟" ? "A" : building === "B棟" ? "B" : "";
  if (!prefix) return [];
  const limit = building === "A棟" ? 27 : 21;
  const roomNumbers = Array.from({ length: limit }, (_, index) => `${prefix}${index + 1}`);
  const splitRooms = building === "A棟" ? ["A20", "A26"] : ["B15"];
  return roomNumbers.flatMap((room) => (
    splitRooms.includes(room) ? [`${room}-1`, `${room}-2`] : [room]
  ));
}

function nextRoomNumber(building) {
  const roomNumbers = roomNumbersForBuilding(building);
  if (!roomNumbers.length) return "";
  const photoRows = checklistItems.filter((item) => item.photo);
  if (!photoRows.length) return roomNumbers[0] || "";
  const lastPhoto = photoRows[photoRows.length - 1];
  const lastRoomIndex = roomNumbers.indexOf(lastPhoto.room);
  if (photoRows.length % 2 === 1) return lastPhoto.room || roomNumbers[Math.floor(photoRows.length / 2)] || "";
  return roomNumbers[lastRoomIndex + 1] || roomNumbers[Math.floor(photoRows.length / 2)] || "";
}

function assignRoomNumbers(building) {
  const roomNumbers = roomNumbersForBuilding(building);
  const photoRows = checklistItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.photo);
  photoRows.forEach(({ item }, index) => {
    item.room = roomNumbers[Math.floor(index / 2)] || "";
  });
  updateRoomControls();
  return { count: photoRows.length, limit: roomNumbers.length };
}

function assignRoomNumbersFrom(photoRecordIndex, room) {
  const photoRows = checklistItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.photo);
  const photoPosition = photoRows.findIndex(({ index }) => index === photoRecordIndex);
  if (photoPosition < 0) return null;
  const roomNumbers = roomNumbersForBuilding(photoRows[photoPosition].item.building);
  const startRoomIndex = roomNumbers.indexOf(String(room).trim());
  if (startRoomIndex < 0) return null;
  const pairStart = Math.floor(photoPosition / 2) * 2;
  photoRows.forEach(({ item }, index) => {
    if (index < pairStart) return;
    const pairOffset = Math.floor((index - pairStart) / 2);
    item.room = roomNumbers[startRoomIndex + pairOffset] || "";
  });
  updateRoomControls();
  return { overflow: photoRows.some(({ item }, index) => index >= pairStart && !item.room) };
}

function updateRoomControls() {
  checklistBody.querySelectorAll('[data-field="room"]').forEach((control) => {
    const item = checklistItems[Number(control.closest("tr").dataset.index)];
    control.value = item.room;
  });
}

function getSyncSourceIndex() {
  const firstPhotoIndex = checklistItems.findIndex((item) => item.photo);
  return firstPhotoIndex >= 0 ? firstPhotoIndex : (checklistItems.length ? 0 : -1);
}

function syncPrimaryField(field, value) {
  const masterIndex = getSyncSourceIndex();
  if (masterIndex < 0) return;
  checklistItems.forEach((item, index) => {
    if (index !== masterIndex) item[field] = value;
  });
  checklistBody.querySelectorAll(`[data-field="${field}"]`).forEach((control) => {
    const index = Number(control.closest("tr").dataset.index);
    if (index !== masterIndex) control.value = value;
  });
}

function addRow() {
  checklistItems.push(createRecord());
  renderChecklist();
  checklistBody.querySelector("tr:last-child select[data-field='item']")?.focus();
}
document.querySelector("#addRowButton").addEventListener("click", addRow);
document.querySelector("#emptyAddButton").addEventListener("click", addRow);
document.querySelector("#clearRowsButton").addEventListener("click", () => {
  if (!checklistItems.length) return;
  checklistItems.forEach((item) => {
    if (item.photo) URL.revokeObjectURL(item.photo.url);
  });
  checklistItems = [];
  renderChecklist();
  notify("自檢表已清空。");
});

checklistBody.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  const row = event.target.closest("tr");
  if (!field || !row) return;
  const index = Number(row.dataset.index);
  checklistItems[index][field] = event.target.value;
  if (["standardModel", "standardSpacingSides", "standardSpacingMiddle"].includes(field)) {
    checklistItems[index].actual = standardActualValue(checklistItems[index]);
    updateModelDimensionFields();
    updateActualFields();
  }
});
checklistBody.addEventListener("change", (event) => {
  const row = event.target.closest("tr");
  const field = event.target.dataset.field;
  if (!field || !row) return;
  const index = Number(row.dataset.index);
  checklistItems[index][field] = event.target.value;
  if (index === getSyncSourceIndex() && ["checkDate", "item", "building", "floor"].includes(field)) {
    syncPrimaryField(field, event.target.value);
    if (field === "building") {
      const { count, limit } = assignRoomNumbers(event.target.value);
      if (limit && Math.ceil(count / 2) > limit) notify(`${event.target.value}棟最多可配置 ${limit} 個房號，每個房號對應 2 張照片，超出部分請手動確認。`);
    }
  }
  if (field === "room" && checklistItems[index].photo) {
    const assignment = assignRoomNumbersFrom(index, event.target.value);
    if (!assignment && event.target.value.trim()) {
      notify(`${event.target.value}不在目前棟別的房號清單中，後續照片未自動排序。`);
    } else if (assignment?.overflow) notify("後續照片超出可用房號，超出部分請手動確認。");
  }
  if (field === "standardType") {
    const item = checklistItems[index];
    const fixedSpacing = item.standardType === "固定間距";
    item.standardModel = "";
    item.standardSpacingSides = fixedSpacing ? "15" : "";
    item.standardSpacingMiddle = fixedSpacing ? "50" : "";
    item.actual = standardActualValue(item);
    updateStandardFields();
    updateActualFields();
  }
  if (["standardModel", "standardSpacingSides", "standardSpacingMiddle"].includes(field)) {
    checklistItems[index].actual = standardActualValue(checklistItems[index]);
    updateModelDimensionFields();
    updateActualFields();
  }
});
checklistBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  removeRecord(Number(button.dataset.remove));
});

function removeRecord(index) {
  const [removed] = checklistItems.splice(index, 1);
  if (removed?.photo) URL.revokeObjectURL(removed.photo.url);
  renderChecklist();
  const building = checklistItems[getSyncSourceIndex()]?.building;
  if (removed?.photo && building) assignRoomNumbers(building);
}

document.querySelector("#exportButton").addEventListener("click", () => {
  if (!checklistItems.length) {
    notify("先新增至少一個檢查項目，再匯出表格。");
    return;
  }
  const rows = [
    ["臺南市安平區億載安居社會住宅新建統包工程"],
    ["自主檢查照片"],
    ["表單名稱", document.querySelector("#checklistTitle").value],
    [],
    ["檢查日期", "檢查項目", "棟別", "樓層", "位置", "標準類型", "型號／兩側間距", "設計尺寸／中間間距", "實際"],
    ...checklistItems.map((item) => [item.checkDate, item.item, item.building, item.floor, item.room, item.standardType, item.standardType === "型號" ? item.standardModel : item.standardType === "固定間距" ? `兩側@${item.standardSpacingSides || ""}cm` : "", item.standardType === "型號" ? getModelDimension(item.standardModel) : item.standardType === "固定間距" ? `中間@@${item.standardSpacingMiddle || ""}cm` : "", item.actual]),
  ];
  const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${document.querySelector("#checklistTitle").value.trim() || "自檢表"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  notify("CSV 自檢表已匯出。");
});

function readPhotoAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

document.querySelector("#reportButton").addEventListener("click", async (event) => {
  if (!checklistItems.length) {
    notify("先新增檢查紀錄，再匯出照片文件。");
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const reportRows = await Promise.all(checklistItems.map(async (item) => {
      const photo = item.photo ? await readPhotoAsDataUrl(item.photo.file) : "";
      return `<tr>
        <td class="photo-cell">${photo ? `<img src="${photo}" alt="自主檢查照片" />` : "<span class=\"no-photo\">未附照片</span>"}</td>
        <td class="details-cell">
          <div class="meta-row"><b>日期：</b><span>${escapeHtml(item.checkDate)}</span></div>
          <div class="meta-row"><b>檢查項目：</b><span>${escapeHtml(item.item)}</span></div>
          <div class="meta-row"><b>檢查位置：</b><span>${escapeHtml([item.building, item.floor, item.room].filter(Boolean).join("／"))}</span></div>
          <section><b>檢查標準：</b><p>${escapeHtml(standardSummary(item)).replace(/\n/g, "<br>")}</p></section>
          <section><b>實際：</b><p>${escapeHtml(item.actual).replace(/\n/g, "<br>")}</p></section>
        </td>
      </tr>`;
    }));
    const title = document.querySelector("#checklistTitle").value.trim() || "自主檢查照片";
    const report = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>
      @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#172925;font-family:"Noto Sans TC",sans-serif;font-size:12px}h1,h2{text-align:center;margin:0;font-weight:600}h1{font-size:17px;padding:5px;border:1px solid #333}h2{font-size:15px;padding:5px 0 8px;border:1px solid #333;border-top:0;margin-bottom:12px}.form-title{margin:0 0 8px;font-size:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}tr{break-inside:avoid;page-break-inside:avoid}td{border:1px solid #333;vertical-align:top}.photo-cell{width:52%;height:290px;padding:0;text-align:center;vertical-align:middle;background:#f4f5f2}.photo-cell img{display:block;width:100%;height:288px;object-fit:contain}.no-photo{color:#89948c}.details-cell{width:48%;padding:0}.meta-row{display:grid;grid-template-columns:88px 1fr;min-height:25px;align-items:center;padding:3px 6px;border-bottom:1px solid #777}.details-cell section{min-height:105px;padding:9px 7px;border-bottom:1px solid #777}.details-cell section:last-child{border-bottom:0}.details-cell p{margin:7px 0 0;white-space:normal;line-height:1.6}@media screen{body{max-width:900px;margin:30px auto;padding:20px;background:#fff}.photo-cell,.photo-cell img{height:320px}}@media print{.photo-cell,.photo-cell img{height:275px}}
      </style></head><body><h1>臺南市安平區億載安居社會住宅新建統包工程</h1><h2>自主檢查照片</h2><p class="form-title">表單名稱：${escapeHtml(title)}</p><table><tbody>${reportRows.join("")}</tbody></table></body></html>`;
    const blob = new Blob([report], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = title.replace(/[\\/:*?"<>|]/g, "_");
    link.download = `${filename}-照片報告.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("含照片檢查文件已匯出，可開啟後列印或另存 PDF。");
  } catch (error) {
    console.error("Photo report export failed", error);
    notify("照片文件匯出失敗，請確認瀏覽器可讀取照片後重試。");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#printButton").addEventListener("click", () => window.print());

if (window.lucide) lucide.createIcons();
updateModelOptions();