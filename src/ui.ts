import type { ServerViewModel } from "./types";
// 默认/错误图标贴图（自带透明背景，直接作 img 使用）。
// 通过 import 让 Vite 处理路径与 base 前缀，适配 GitHub Pages 子路径部署。
import grassIconUrl from "../assets/textures/Grass_Block.png";
import barrierIconUrl from "../assets/textures/Barrier.png";
// MC 客户端 GUI 信号格图标（1.21.8 解包）；在线默认满格
import ping5Url from "../assets/mc/ping_5.png";
import unreachableUrl from "../assets/mc/unreachable.png";
// 加入箭头（游戏内悬停服务器图标时显示的原版素材）
import joinUrl from "../assets/mc/join.png";
import joinHighlightedUrl from "../assets/mc/join_highlighted.png";

const GRASS_ICON_URL = grassIconUrl;
const BARRIER_ICON_URL = barrierIconUrl;

/** 在线玩家列表最多直接展示的人数，其余折叠进 title */
const CREW_VISIBLE_MAX = 10;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 信号格图标：在线 = 满格；离线/故障 = 不可达图标；加载 = 原版 pinging 帧动画（CSS 驱动） */
function pingMarkup(view: Pick<ServerViewModel, "id" | "status">): string {
  if (view.status === "loading") {
    return `<span class="mc-ping-frame boot" role="img" aria-label="正在连接"></span>`;
  }

  if (view.status === "online") {
    return `<img class="mc-ping" src="${ping5Url}" alt="" role="img" aria-label="信号良好" />`;
  }

  const label = view.status === "error" ? "无法连接" : "无信号";
  return `<img class="mc-ping dead" src="${unreachableUrl}" alt="" role="img" aria-label="${label}" />`;
}

/** 复制地址并弹出反馈 */
export async function copyAddress(value: string): Promise<void> {
  if (!value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast(`已复制 ${value}`);
  } catch {
    toast("复制失败，请手动复制");
  }
}

/** 图标按钮：悬停出现原版"加入箭头"（普通/高亮双态），单击复制地址 */
function iconButtonMarkup(icon: string, address: string): string {
  const label = address ? `复制服务器地址 ${address}` : `复制服务器地址`;
  return `
    <button class="mc-icon-button" type="button" data-copy-address="${escapeHtml(address)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      ${icon}
      <span class="mc-icon-join" aria-hidden="true">
        <img class="join" src="${joinUrl}" alt="" />
        <img class="join-hi" src="${joinHighlightedUrl}" alt="" />
      </span>
    </button>
  `;
}

/** 展开区：服务器详细内容（物品提示框样式） */
function detailMarkup(view: ServerViewModel): string {
  const row = (key: string, value: string) =>
    `<p class="mc-detail-row"><span class="k">${key}</span><span class="v">${value}</span></p>`;

  const rows: string[] = [];

  if (view.status === "online") {
    const names = view.playerNames.map(escapeHtml).join("、");
    const anon = view.anonymousPlayerCount > 0 ? `、匿名 ×${view.anonymousPlayerCount}` : "";
    rows.push(row("玩家", names ? `${escapeHtml(view.playersText)}：${names}${anon}` : escapeHtml(view.playersText)));
  }

  rows.push(row("版本", escapeHtml(view.version)));
  rows.push(row("MOTD", escapeHtml(view.motdText)));

  if (view.note) {
    rows.push(row("备注", escapeHtml(view.note)));
  }

  if (view.errorText) {
    rows.push(row("错误", escapeHtml(view.errorText)));
  }

  return `
    <div class="mc-detail-wrap">
      <div class="mc-detail">
        <div class="mc-detail-box">
          ${rows.join("")}
          <p class="mc-detail-hint">双击条目或点击图标可复制地址</p>
        </div>
      </div>
    </div>
  `;
}

/** 条目图标：故障用屏障，无图标用草方块，否则用服务器图标。 */
function entryIconMarkup(view: ServerViewModel): string {
  if (view.status === "error") {
    return `<img class="mc-icon" src="${BARRIER_ICON_URL}" alt="${escapeHtml(view.name)} 不可用" loading="lazy" />`;
  }

  if (view.iconDataUrl) {
    return `<img class="mc-icon" src="${escapeHtml(view.iconDataUrl)}" alt="${escapeHtml(view.name)} 图标" loading="lazy" />`;
  }

  return `<img class="mc-icon" src="${GRASS_ICON_URL}" alt="${escapeHtml(view.name)} 默认图标" loading="lazy" />`;
}

function crewMarkup(view: ServerViewModel): string {
  if (view.status !== "online") {
    return "";
  }

  const names = view.playerNames;
  const anonymous = view.anonymousPlayerCount;
  if (names.length === 0 && anonymous === 0) {
    return "";
  }

  const visible = names.slice(0, CREW_VISIBLE_MAX).map(escapeHtml).join("、");
  const more = names.length > CREW_VISIBLE_MAX ? ` 等 ${names.length} 人` : "";
  const anon = anonymous > 0 ? `、匿名 ×${anonymous}` : "";
  const fullTitle = escapeHtml(names.join(", ") + (anonymous > 0 ? `, 匿名 ×${anonymous}` : ""));

  return `<p class="mc-crew" title="${fullTitle}">${visible}${more}${anon}</p>`;
}

function addrMarkup(view: Pick<ServerViewModel, "addresses" | "unreachableAddresses">): string {
  return view.addresses
    .map((item) => {
      const dead = view.unreachableAddresses?.includes(item) ? " dead" : "";
      return `<button class="mc-addr${dead}" type="button" data-copy-address="${escapeHtml(item)}" aria-label="复制服务器地址 ${escapeHtml(item)}">${escapeHtml(item)}</button>`;
    })
    .join("");
}

function toast(message: string): void {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);

  window.setTimeout(() => {
    node.classList.add("toast-out");
    window.setTimeout(() => node.remove(), 250);
  }, 1400);
}

/** 条目骨架（读取中） */
export function renderLoadingEntry(
  parent: HTMLElement,
  id: string,
  _tag: string,
  index: number,
  name: string,
  addresses: string[],
  note?: string
): void {
  const entry = document.createElement("article");
  entry.className = "mc-entry loading";
  entry.dataset.serverId = id;
  entry.dataset.primaryAddress = addresses[0] ?? "";
  entry.style.setProperty("--i", String(index));
  entry.innerHTML = `
    ${iconButtonMarkup(`<img class="mc-icon" src="${GRASS_ICON_URL}" alt="${escapeHtml(name)} 默认图标" loading="lazy" />`, addresses[0] ?? "")}
    <div class="mc-entry-main">
      <div class="mc-name">${escapeHtml(name)}${note ? ` <span class="mc-note">${escapeHtml(note)}</span>` : ""}</div>
      <div class="mc-motd" title="${escapeHtml(addresses.join("\n"))}"></div>
      <div class="mc-entry-foot">
        ${addrMarkup({ addresses })}
      </div>
    </div>
    <div class="mc-entry-side">
      <span class="mc-count dead">--/-- ${pingMarkup({ id, status: "loading" })}</span>
      <span class="mc-version">…</span>
    </div>
  `;
  parent.appendChild(entry);
  bindCopyButtons(entry);
}

/** 条目内容更新（保留元素本身与展开状态，避免重放入场动画） */
export function upsertServerEntry(parent: HTMLElement, view: ServerViewModel, _tag: string): void {
  const existing = parent.querySelector<HTMLElement>(`[data-server-id="${view.id}"]`);
  const entry = existing ?? document.createElement("article");
  const wasExpanded = existing?.classList.contains("expanded") ?? false;

  entry.className = `mc-entry ${view.status}${wasExpanded ? " expanded" : ""}`;
  entry.dataset.serverId = view.id;
  entry.dataset.primaryAddress = view.address;
  entry.setAttribute("aria-expanded", String(wasExpanded));
  entry.innerHTML = `
    ${iconButtonMarkup(entryIconMarkup(view), view.address)}
    <div class="mc-entry-main">
      <div class="mc-name">${escapeHtml(view.name)}${view.note ? ` <span class="mc-note">${escapeHtml(view.note)}</span>` : ""}</div>
      <div class="mc-motd" title="${escapeHtml(view.motdText)}">${view.motdHtml ?? escapeHtml(view.motdText)}</div>
      ${view.errorText ? `<p class="mc-error">${escapeHtml(view.errorText)}</p>` : ""}
      ${crewMarkup(view)}
      <div class="mc-entry-foot">
        ${addrMarkup(view)}
      </div>
      ${detailMarkup(view)}
    </div>
    <div class="mc-entry-side">
      <span class="mc-count${view.status === "online" ? "" : " dead"}">${escapeHtml(view.playersText)} ${pingMarkup(view)}</span>
      <span class="mc-version" title="${escapeHtml(view.version)}">${escapeHtml(view.version)}</span>
    </div>
  `;

  if (!existing) {
    parent.appendChild(entry);
  }

  bindCopyButtons(entry);
}

/** 绑定所有复制按钮（地址 chip 与图标按钮），阻止冒泡以免触发展开 */
function bindCopyButtons(entry: HTMLElement): void {
  const buttons = entry.querySelectorAll<HTMLButtonElement>(".mc-addr, .mc-icon-button");
  for (const button of buttons) {
    button.onclick = (event) => {
      event.stopPropagation();
      void copyAddress(button.dataset.copyAddress ?? "");
    };
  }
}
