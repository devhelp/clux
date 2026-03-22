export interface TmuxSession {
  name: string;
  createdAt: Date;
  isAttached: boolean;
  windows: TmuxWindow[];
  metadata?: SessionMetadata;
}

export interface SessionMetadata {
  projectPath?: string;
  description?: string;
  tags?: string[];
  command?: string;
  commandsSent?: number;
  mainClaudeSessionId?: string;
}

export interface TmuxWindow {
  index: number;
  name: string;
  isActive: boolean;
  panes: TmuxPane[];
}

export interface TmuxPane {
  id: string;
  index: number;
  isActive: boolean;
  width: number;
  height: number;
  pid: number;
  currentPath: string;
  currentCommand?: string;
  role?: string;
}

export interface ProjectConfig {
  projectName: string;
  projectPath: string;
  command?: string;
  layout?: 'tiled' | 'even-horizontal' | 'even-vertical' | 'main-horizontal' | 'main-vertical';
}

export interface PaneOutput {
  sessionName: string;
  paneId: string;
  content: string;
  timestamp: Date;
  lines: number;
}

export interface SendKeysOptions {
  literal?: boolean;
  noEnter?: boolean;
  delay?: number;
}

export interface SessionEvent {
  type:
    | 'created'
    | 'killed'
    | 'attached'
    | 'detached'
    | 'output-changed'
    | 'keys-sent'
    | 'message-relayed'
    | 'window-added'
    | 'window-renamed';
  sessionName: string;
  paneId?: string;
  data?: unknown;
  timestamp: Date;
}
