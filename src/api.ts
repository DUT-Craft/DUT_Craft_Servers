import type { ApiServerResponse, ServerAddressTarget, ServerTarget, ServerViewModel } from "./types";
import { getServerId, toAddress, toAddressList } from "./config";

const API_BASE = "https://api.mcsrvstat.us/2";
const REQUEST_TIMEOUT_MS = 8000;

function withTimeout(timeoutMs: number): { signal: AbortSignal; clearTimer: () => void } {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clearTimer: () => clearTimeout(timerId) };
}

function normalizeMotd(cleanMotd?: string[]): string {
  if (!cleanMotd || cleanMotd.length === 0) {
    return "暂无 MOTD";
  }

  return cleanMotd.map((line) => decodeHtmlEntities(line)).join(" / ");
}

function decodeHtmlEntities(input: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");
  return doc.documentElement.textContent ?? input;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeStyle(input: string): string {
  const allowedProps = new Set(["color", "font-weight", "font-style", "text-decoration"]);
  const declarations = input
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      const [rawProp, ...rest] = item.split(":");
      if (!rawProp || rest.length === 0) {
        return undefined;
      }

      const prop = rawProp.trim().toLowerCase();
      if (!allowedProps.has(prop)) {
        return undefined;
      }

      const value = rest.join(":").trim();
      if (!/^[#(),.%\w\s-]+$/.test(value)) {
        return undefined;
      }

      return `${prop}: ${value}`;
    })
    .filter((item): item is string => Boolean(item));

  return declarations.join("; ");
}

function sanitizeMotdNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map(sanitizeMotdNode).join("");

  if (tag === "br") {
    return "<br>";
  }

  if (tag !== "span") {
    return children;
  }

  const safeStyle = sanitizeStyle(element.getAttribute("style") ?? "");
  if (!safeStyle) {
    return `<span>${children}</span>`;
  }

  return `<span style="${escapeHtml(safeStyle)}">${children}</span>`;
}

function normalizeMotdHtml(htmlMotd?: string[]): string | undefined {
  if (!htmlMotd || htmlMotd.length === 0) {
    return undefined;
  }

  const parser = new DOMParser();
  const lines = htmlMotd
    .map((line) => {
      const doc = parser.parseFromString(line, "text/html");
      return Array.from(doc.body.childNodes).map(sanitizeMotdNode).join("");
    })
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return undefined;
  }

  return lines.join("<br>");
}

function normalizeIcon(icon?: string): string | undefined {
  if (!icon) {
    return undefined;
  }

  const trimmed = icon.trim();
  if (!trimmed.startsWith("data:image/")) {
    return undefined;
  }

  return trimmed;
}

function normalizePlayerNames(rawList?: string[]): string[] {
  if (!rawList || rawList.length === 0) {
    return [];
  }

  return rawList
    .filter((name) => typeof name === "string")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/** 查询单个地址目标的完整视图（online/offline/error 三态） */
async function queryServerTarget(server: ServerTarget, target: ServerAddressTarget): Promise<ServerViewModel> {
  const id = getServerId(server);
  const addresses = toAddressList(server);
  const address = toAddress(target);
  const { signal, clearTimer } = withTimeout(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/${address}`, {
      method: "GET",
      signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as ApiServerResponse;
    const iconDataUrl = normalizeIcon(data.icon);
    const motdHtml = normalizeMotdHtml(data.motd?.html);
    const motdText = normalizeMotd(data.motd?.clean);

    if (!data.online) {
      return {
        id,
        name: server.name,
        note: server.note,
        address,
        addresses,
        iconDataUrl,
        status: "offline",
        version: "离线",
        playersText: "0 / 0",
        playerNames: [],
        anonymousPlayerCount: 0,
        motdText: "服务器离线或不可达"
      };
    }

    const playerNames = normalizePlayerNames(data.players?.list);
    const online = data.players?.online ?? 0;
    const max = data.players?.max ?? 0;
    const anonymousPlayerCount = Math.max(0, online - playerNames.length);

    return {
      id,
      name: server.name,
      note: server.note,
      address,
      addresses,
      iconDataUrl,
      status: "online",
      version: data.version ?? "未知版本",
      playersText: `${online} / ${max}`,
      playerNames,
      anonymousPlayerCount,
      motdText,
      motdHtml
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知错误";

    return {
      id,
      name: server.name,
      note: server.note,
      address,
      addresses,
      status: "error",
      version: "查询失败",
      playersText: "-",
      playerNames: [],
      anonymousPlayerCount: 0,
      motdText: "无法获取服务器状态",
      errorText: reason
    };
  } finally {
    clearTimer();
  }
}

/**
 * 查询服务器：所有地址并行查询，取第一个在线的作为展示数据；
 * 其余地址若确认离线则记入 unreachableAddresses（界面标红）。
 * 全部离线时显示离线；全部查询出错时显示故障。
 */
export async function fetchServerView(server: ServerTarget): Promise<ServerViewModel> {
  const results = await Promise.all(server.address.map((target) => queryServerTarget(server, target)));

  const chosen =
    results.find((result) => result.status === "online") ??
    results.find((result) => result.status === "offline") ??
    results[0];

  chosen.unreachableAddresses = results
    .filter((result) => result.status === "offline")
    .map((result) => result.address);

  return chosen;
}
