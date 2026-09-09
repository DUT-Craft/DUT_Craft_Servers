export interface ServerAddressTarget {
  id?: string;
  host: string;
  port?: number;
}

export interface ServerTarget {
  name: string;
  address: ServerAddressTarget[];
  /** 备注，显示在卡片标题下方，可当作配置注释使用 */
  note?: string;
}

export interface ApiServerResponse {
  online: boolean;
  ip?: string;
  port?: number;
  icon?: string;
  version?: string;
  players?: {
    online?: number;
    max?: number;
    list?: string[];
  };
  motd?: {
    clean?: string[];
    html?: string[];
  };
}

export type ServerUiStatus = "loading" | "online" | "offline" | "error";

export interface ServerViewModel {
  id: string;
  name: string;
  note?: string;
  address: string;
  addresses: string[];
  /** 查询确认不可达的地址（显示为红色） */
  unreachableAddresses?: string[];
  iconDataUrl?: string;
  status: ServerUiStatus;
  version: string;
  playersText: string;
  playerNames: string[];
  anonymousPlayerCount: number;
  motdText: string;
  motdHtml?: string;
  errorText?: string;
}
