import { getServerId, loadServerList, toAddressList } from "./config";
import { fetchServerView } from "./api";
import type { ServerTarget, ServerViewModel } from "./types";
import { renderLoadingEntry, upsertServerEntry, copyAddress } from "./ui";
import { initThemeToggle } from "./theme";

// 初始化主题切换（按钮绑定 + 文案同步 + 系统偏好跟随）
initThemeToggle();

const boardNode = document.querySelector<HTMLElement>("#status-board");
const refreshButtonNode = document.querySelector<HTMLButtonElement>("#refresh-all");
const configBannerNode = document.querySelector<HTMLElement>("#config-banner");
const statUnitsNode = document.querySelector<HTMLElement>("#stat-units");
const statOnlineNode = document.querySelector<HTMLElement>("#stat-online");
const statPlayersNode = document.querySelector<HTMLElement>("#stat-players");
const lastSyncNode = document.querySelector<HTMLElement>("#last-sync");
const clockTimeNode = document.querySelector<HTMLElement>("#clock-time");

if (
  !boardNode ||
  !refreshButtonNode ||
  !configBannerNode ||
  !statUnitsNode ||
  !statOnlineNode ||
  !statPlayersNode ||
  !lastSyncNode ||
  !clockTimeNode
) {
  throw new Error("页面初始化失败：缺少必要 DOM 节点");
}

const board = boardNode;
const refreshButton = refreshButtonNode;
const configBanner = configBannerNode;
const statUnits = statUnitsNode;
const statOnline = statOnlineNode;
const statPlayers = statPlayersNode;
const lastSync = lastSyncNode;
const clockTime = clockTimeNode;

let activeServerList: ServerTarget[] = [];
let activeServerSignature = "";
let latestViews: ServerViewModel[] = [];
let syncing = false;

/** 每台服务器的序号（01、02……按配置顺序，重排后保持不变） */
const unitTagById = new Map<string, { tag: string; index: number }>();

const AUTO_REFRESH_MS = 60_000;

function formatClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function serverSignature(list: ServerTarget[]): string {
  return list.map(getServerId).join("||");
}

function rebuildUnitTags(): void {
  unitTagById.clear();
  activeServerList.forEach((server, index) => {
    unitTagById.set(getServerId(server), { tag: String(index + 1).padStart(2, "0"), index });
  });
}

function unitTagOf(serverId: string): { tag: string; index: number } {
  return unitTagById.get(serverId) ?? { tag: "—", index: 0 };
}

function renderInitialLoading(list: ServerTarget[]): void {
  board.innerHTML = "";
  for (const server of list) {
    const id = getServerId(server);
    const { tag, index } = unitTagOf(id);
    renderLoadingEntry(board, id, tag, index, server.name, toAddressList(server), server.note);
  }
}

/** 配置问题胶带：fallback 时为 error 级，仅条目被忽略时为 warning 级。 */
function updateConfigBanner(level: "error" | "warning" | null, text?: string): void {
  if (!level || !text) {
    configBanner.hidden = true;
    configBanner.className = "alarm-tape";
    configBanner.textContent = "";
    return;
  }

  configBanner.hidden = false;
  configBanner.className = `alarm-tape ${level}`;
  configBanner.textContent = text;
}

async function syncServerList(): Promise<boolean> {
  const { servers, usedFallback, problemText } = await loadServerList();
  const nextSignature = serverSignature(servers);
  const changed = nextSignature !== activeServerSignature;

  activeServerList = servers;
  activeServerSignature = nextSignature;
  rebuildUnitTags();
  updateConfigBanner(usedFallback ? "error" : problemText ? "warning" : null, problemText);

  return changed;
}

function activityPriority(view: ServerViewModel): number {
  if (view.status === "online") {
    return view.playerNames.length > 0 ? 0 : 1;
  }

  return 2;
}

function sortViews(views: ServerViewModel[]): ServerViewModel[] {
  return [...views].sort((left, right) => {
    const leftPriority = activityPriority(left);
    const rightPriority = activityPriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftIndex = unitTagOf(left.id).index;
    const rightIndex = unitTagOf(right.id).index;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function renderSortedViews(views: ServerViewModel[]): void {
  const sorted = sortViews(views);
  const validIds = new Set(sorted.map((v) => v.id));

  for (const view of sorted) {
    upsertServerEntry(board, view, unitTagOf(view.id).tag);
  }

  // 调整 DOM 顺序与排序结果一致
  for (const view of sorted) {
    const card = board.querySelector<HTMLElement>(`[data-server-id="${CSS.escape(view.id)}"]`);
    if (card) {
      board.appendChild(card);
    }
  }

  // 移除已不存在的服务器
  for (const child of Array.from(board.querySelectorAll<HTMLElement>(".mc-entry"))) {
    if (child.dataset.serverId && !validIds.has(child.dataset.serverId)) {
      child.remove();
    }
  }
}

function updateStats(): void {
  const onlineViews = latestViews.filter((view) => view.status === "online");
  const playersTotal = onlineViews.reduce((sum, view) => {
    const online = Number.parseInt(view.playersText, 10);
    return sum + (Number.isFinite(online) ? online : 0);
  }, 0);

  statUnits.textContent = String(activeServerList.length);
  statOnline.textContent = String(onlineViews.length);
  statPlayers.textContent = String(playersTotal);
}

async function refreshAll(): Promise<void> {
  if (syncing) {
    return;
  }
  syncing = true;
  refreshButton.disabled = true;
  refreshButton.textContent = "同步中…";

  const listChanged = await syncServerList();
  if (listChanged) {
    renderInitialLoading(activeServerList);
  }

  const results = await Promise.allSettled(activeServerList.map((item) => fetchServerView(item)));
  latestViews = results
    .filter((result): result is PromiseFulfilledResult<ServerViewModel> => result.status === "fulfilled")
    .map((result) => result.value);

  renderSortedViews(latestViews);
  updateStats();
  lastSync.textContent = `上次同步 ${formatClock(new Date())}`;

  refreshButton.disabled = false;
  refreshButton.textContent = "⟳ 同步全部";
  syncing = false;
}

refreshButton.addEventListener("click", () => {
  void refreshAll();
});

/* ============================================================
 * 条目交互（游戏内手感）：
 * 单击条目 → 展开详情；双击条目 → 复制地址。
 * 用 240ms 定时器区分单击与双击，避免双击时先触发展开。
 * 地址 chip 与图标按钮自带复制行为，不参与展开。
 * ============================================================ */
const CLICK_DELAY_MS = 240;
let pendingExpand: { entry: HTMLElement; timer: number } | null = null;

function toggleExpand(entry: HTMLElement): void {
  const expanded = entry.classList.toggle("expanded");
  entry.setAttribute("aria-expanded", String(expanded));
}

board.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const entry = target.closest<HTMLElement>(".mc-entry");
  if (!entry) {
    return;
  }

  if (target.closest(".mc-addr") || target.closest(".mc-icon-button")) {
    return; // 复制按钮自行处理
  }

  if (window.getSelection()?.toString()) {
    return; // 正在选取文字时不切换
  }

  if (pendingExpand) {
    window.clearTimeout(pendingExpand.timer);
    pendingExpand = null;
  }

  const timer = window.setTimeout(() => {
    pendingExpand = null;
    // 手风琴：展开新条目前先收起其他条目
    if (!entry.classList.contains("expanded")) {
      for (const other of Array.from(board.querySelectorAll<HTMLElement>(".mc-entry.expanded"))) {
        if (other !== entry) {
          other.classList.remove("expanded");
          other.setAttribute("aria-expanded", "false");
        }
      }
    }
    toggleExpand(entry);
  }, CLICK_DELAY_MS);
  pendingExpand = { entry, timer };
});

board.addEventListener("dblclick", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const entry = target.closest<HTMLElement>(".mc-entry");
  if (!entry) {
    return;
  }

  if (target.closest(".mc-addr") || target.closest(".mc-icon-button")) {
    return;
  }

  if (pendingExpand) {
    window.clearTimeout(pendingExpand.timer);
    pendingExpand = null;
  }

  void copyAddress(entry.dataset.primaryAddress ?? "");
});

// 值班时钟
function tickClock(): void {
  clockTime.textContent = formatClock(new Date());
}
tickClock();
window.setInterval(tickClock, 1000);

// 自动同步：页面不可见时跳过，回到前台后的下一个周期自然恢复
window.setInterval(() => {
  if (!syncing && !document.hidden) {
    void refreshAll();
  }
}, AUTO_REFRESH_MS);

void refreshAll();
