import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

export interface SessionRecord {
  name: string;
  projectPath: string | null;
  description: string | null;
  tags: string[];
  command: string | null;
  template: string | null;
  createdAt: string;
  lastActivity: string;
  commandsSent: number;
}

export interface SessionStats {
  totalSessions: number;
  totalCommands: number;
  sessions: {
    name: string;
    commandsSent: number;
    durationMs: number;
    durationHuman: string;
    createdAt: string;
    lastActivity: string;
    projectPath: string | null;
    template: string | null;
  }[];
}

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || SessionStore.defaultPath();
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  static defaultPath(): string {
    return path.join(os.homedir(), '.clux', 'sessions.db');
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        name            TEXT PRIMARY KEY,
        project_path    TEXT,
        description     TEXT,
        tags            TEXT DEFAULT '[]',
        command         TEXT,
        template        TEXT,
        created_at      TEXT NOT NULL,
        last_activity   TEXT NOT NULL,
        commands_sent   INTEGER DEFAULT 0
      )
    `);
  }

  save(record: SessionRecord): void {
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO sessions
        (name, project_path, description, tags, command, template, created_at, last_activity, commands_sent)
      VALUES
        (@name, @projectPath, @description, @tags, @command, @template, @createdAt, @lastActivity, @commandsSent)
    `,
      )
      .run({
        name: record.name,
        projectPath: record.projectPath,
        description: record.description,
        tags: JSON.stringify(record.tags),
        command: record.command,
        template: record.template,
        createdAt: record.createdAt,
        lastActivity: record.lastActivity,
        commandsSent: record.commandsSent,
      });
  }

  get(name: string): SessionRecord | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE name = ?').get(name) as any;
    return row ? this.toRecord(row) : null;
  }

  getAll(): SessionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM sessions ORDER BY last_activity DESC')
      .all() as any[];
    return rows.map((r) => this.toRecord(r));
  }

  delete(name: string): void {
    this.db.prepare('DELETE FROM sessions WHERE name = ?').run(name);
  }

  updateDescription(name: string, description: string): void {
    this.db.prepare('UPDATE sessions SET description = ? WHERE name = ?').run(description, name);
  }

  updateTags(name: string, tags: string[]): void {
    this.db.prepare('UPDATE sessions SET tags = ? WHERE name = ?').run(JSON.stringify(tags), name);
  }

  addTag(name: string, tag: string): void {
    const record = this.get(name);
    if (!record) return;
    const tags = record.tags.includes(tag) ? record.tags : [...record.tags, tag];
    this.updateTags(name, tags);
  }

  removeTag(name: string, tag: string): void {
    const record = this.get(name);
    if (!record) return;
    this.updateTags(
      name,
      record.tags.filter((t) => t !== tag),
    );
  }

  touchActivity(name: string): void {
    this.db
      .prepare('UPDATE sessions SET last_activity = ? WHERE name = ?')
      .run(new Date().toISOString(), name);
  }

  incrementCommandsSent(name: string): void {
    this.db
      .prepare(
        'UPDATE sessions SET commands_sent = commands_sent + 1, last_activity = ? WHERE name = ?',
      )
      .run(new Date().toISOString(), name);
  }

  search(query: string): SessionRecord[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM sessions
      WHERE name LIKE @q OR description LIKE @q OR tags LIKE @q OR project_path LIKE @q
      ORDER BY last_activity DESC
    `,
      )
      .all({ q: `%${query}%` }) as any[];
    return rows.map((r) => this.toRecord(r));
  }

  findByTag(tag: string): SessionRecord[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM sessions WHERE tags LIKE @q ORDER BY last_activity DESC
    `,
      )
      .all({ q: `%"${tag}"%` }) as any[];
    return rows.map((r) => this.toRecord(r));
  }

  getStats(name?: string): SessionStats {
    if (name) {
      const record = this.get(name);
      if (!record) return { totalSessions: 0, totalCommands: 0, sessions: [] };
      const duration = Date.now() - new Date(record.createdAt).getTime();
      return {
        totalSessions: 1,
        totalCommands: record.commandsSent,
        sessions: [
          {
            name: record.name,
            commandsSent: record.commandsSent,
            durationMs: duration,
            durationHuman: this.formatDuration(duration),
            createdAt: record.createdAt,
            lastActivity: record.lastActivity,
            projectPath: record.projectPath,
            template: record.template,
          },
        ],
      };
    }

    const rows = this.db
      .prepare('SELECT * FROM sessions ORDER BY last_activity DESC')
      .all() as any[];
    const records = rows.map((r) => this.toRecord(r));
    const totalCommands = records.reduce((sum, r) => sum + r.commandsSent, 0);

    return {
      totalSessions: records.length,
      totalCommands,
      sessions: records.map((r) => {
        const duration = Date.now() - new Date(r.createdAt).getTime();
        return {
          name: r.name,
          commandsSent: r.commandsSent,
          durationMs: duration,
          durationHuman: this.formatDuration(duration),
          createdAt: r.createdAt,
          lastActivity: r.lastActivity,
          projectPath: r.projectPath,
          template: r.template,
        };
      }),
    };
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (hours < 24) return `${hours}h ${remainingMins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  private toRecord(row: any): SessionRecord {
    return {
      name: row.name,
      projectPath: row.project_path,
      description: row.description,
      tags: JSON.parse(row.tags || '[]'),
      command: row.command,
      template: row.template,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      commandsSent: row.commands_sent,
    };
  }

  close(): void {
    this.db.close();
  }
}
