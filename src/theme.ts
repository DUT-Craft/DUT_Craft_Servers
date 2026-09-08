// 主题切换：深色（暖夜）/ 浅色（暖纸）
// 偏好持久化于 localStorage（key 与 index.html 的防 FOUC 脚本共用 "dutcraft-theme"），
// 未存储时跟随系统 prefers-color-scheme。

export type Theme = "dark" | "light";

const STORAGE_KEY = "dutcraft-theme";

const THEME_NAME: Record<Theme, string> = {
  dark: "夜晚",
  light: "白天"
};

function resolveStored(): Theme | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : undefined;
  } catch {
    return undefined;
  }
}

function persist(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 无痕模式或禁用存储时静默忽略
  }
}

export function currentTheme(): Theme {
  return (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "dark";
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);

  const nameNode = document.getElementById("shift-name");
  if (nameNode) {
    nameNode.textContent = THEME_NAME[theme];
  }
}

function toggle(): void {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  persist(next);
  applyTheme(next);
}

/** 初始化主题切换按钮与系统偏好跟随。返回当前主题。 */
export function initThemeToggle(): Theme {
  // 首次访问（无存储）时，跟随系统明暗
  if (resolveStored() === undefined) {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  } else {
    applyTheme(currentTheme());
  }

  // 系统偏好变化时，若用户未显式选择，则跟随
  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  const onSystemChange = (event: MediaQueryListEvent) => {
    if (resolveStored() !== undefined) {
      return;
    }
    applyTheme(event.matches ? "light" : "dark");
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onSystemChange);
  } else {
    // 旧版 Safari 兼容
    mediaQuery.addListener(onSystemChange);
  }

  const button = document.querySelector<HTMLButtonElement>("#theme-toggle");
  if (button) {
    button.addEventListener("click", toggle);
  }

  return currentTheme();
}
