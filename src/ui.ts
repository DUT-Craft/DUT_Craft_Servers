import type { ServerViewModel } from "./types";
// 默认/错误图标贴图（自带透明背景，直接作 img 使用）。
// 通过 import 让 Vite 处理路径与 base 前缀，适配 GitHub Pages 子路径部署。
import grassIconUrl from "../assets/textures/Grass_Block.png";
import barrierIconUrl from "../assets/textures/Barrier.png";
// MC 客户端 GUI 信号格图标（1.21.8 解包）
import ping1Url from "../assets/mc/ping_1.png";
import ping3Url from "../assets/mc/ping_3.png";
import ping4Url from "../assets/mc/ping_4.png";
import ping5Url from "../assets/mc/ping_5.png";
import pingUnknownUrl from "../assets/mc/ping_unknown.png";

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

const PING_BY_LEVEL: Record<number, string> = {
  3: ping3Url,
  4: ping4Url,
  5: ping5Url
};

/** 简易字符串散列，用于给每台服务器生成稳定的"信号强度"（3–5 格） */
function pingLevelFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return 3 + (hash % 3);
}

/** 信号格图标：在线 = 稳定信号；离线/故障 = 无信号图标；加载 = 呼吸 */
function pingMarkup(view: Pick<ServerViewModel, "id" | "status">): string {
  if (view.status === "loading") {
    return `<img class="mc-ping boot" src="${ping1Url}" alt="" role="img" aria-label="正在读取" />`;
  }

  if (view.status === "online") {
    return `<img class="mc-ping" src="${PING_BY_LEVEL[pingLevelFor(view.id)] ?? ping5Url}" alt="" role="img" aria-label="信号良好" />`;
  }

  const label = view.status === "error" ? "无法连接" : "无信号";
  return `<img class="mc-ping dead" src="${pingUnknownUrl}" alt="" role="img" aria-label="${label}" />`;
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

function addrMarkup(view: Pick<ServerViewModel, "addresses">): string {
  return view.addresses
    .map(
      (item) =>
        `<button class="mc-addr" type="button" data-copy-address="${escapeHtml(item)}" aria-label="复制服务器地址 ${escapeHtml(item)}">${escapeHtml(item)}</button>`
    )
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
  entry.style.setProperty("--i", String(index));
  entry.innerHTML = `
    <img class="mc-icon" src="${GRASS_ICON_URL}" alt="${escapeHtml(name)} 默认图标" loading="lazy" />
    <div class="mc-entry-main">
      <div class="mc-name">${escapeHtml(name)}${note ? ` <span class="mc-note">${escapeHtml(note)}</span>` : ""}</div>
      <div class="mc-motd" title="${escapeHtml(addresses.join("\n"))}"></div>
      <div class="mc-entry-foot">
        ${addrMarkup({ addresses })}
        <button class="mc-btn mc-btn-mini" type="button" aria-label="刷新服务器 ${escapeHtml(name)}">刷新</button>
      </div>
    </div>
    <div class="mc-entry-side">
      <span class="mc-count dead">--/-- ${pingMarkup({ id, status: "loading" })}</span>
      <span class="mc-version">…</span>
    </div>
  `;
  parent.appendChild(entry);
  bindAddrs(entry);
}

/** 条目内容更新（保留元素本身，避免重放入场动画） */
export function upsertServerEntry(parent: HTMLElement, view: ServerViewModel, _tag: string): void {
  const existing = parent.querySelector<HTMLElement>(`[data-server-id="${view.id}"]`);
  const entry = existing ?? document.createElement("article");

  entry.className = `mc-entry ${view.status}`;
  entry.dataset.serverId = view.id;
  entry.innerHTML = `
    ${entryIconMarkup(view)}
    <div class="mc-entry-main">
      <div class="mc-name">${escapeHtml(view.name)}${view.note ? ` <span class="mc-note">${escapeHtml(view.note)}</span>` : ""}</div>
      <div class="mc-motd" title="${escapeHtml(view.motdText)}">${view.motdHtml ?? escapeHtml(view.motdText)}</div>
      ${view.errorText ? `<p class="mc-error">${escapeHtml(view.errorText)}</p>` : ""}
      ${crewMarkup(view)}
      <div class="mc-entry-foot">
        ${addrMarkup(view)}
        <button class="mc-btn mc-btn-mini" type="button" aria-label="刷新服务器 ${escapeHtml(view.name)}">刷新</button>
      </div>
    </div>
    <div class="mc-entry-side">
      <span class="mc-count${view.status === "online" ? "" : " dead"}">${escapeHtml(view.playersText)} ${pingMarkup(view)}</span>
      <span class="mc-version" title="${escapeHtml(view.version)}">${escapeHtml(view.version)}</span>
    </div>
  `;

  if (!existing) {
    parent.appendChild(entry);
  }

  bindAddrs(entry);
}

function bindAddrs(entry: HTMLElement): void {
  const buttons = entry.querySelectorAll<HTMLButtonElement>(".mc-addr");
  for (const button of buttons) {
    button.onclick = async () => {
      const value = button.dataset.copyAddress ?? "";
      if (!value) {
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        toast(`已复制 ${value}`);
      } catch {
        toast("复制失败，请手动复制");
      }
    };
  }
}
