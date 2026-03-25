import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SessionStore } from './SessionStore';
import type { SessionRecord } from './SessionStore';

describe('SessionStore', () => {
  let tmpDir: string;
  let store: SessionStore;

  function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
    return {
      name: 'test-session',
      projectPath: '/tmp/project',
      description: 'A test session',
      tags: [],
      command: 'claude',
      template: 'solo',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      commandsSent: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clux-session-test-'));
    store = new SessionStore(path.join(tmpDir, 'sessions.db'));
  });

  afterEach(() => {
    store.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('save() and get() round-trip', () => {
    const record = makeRecord();
    store.save(record);
    const retrieved = store.get('test-session');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('test-session');
    expect(retrieved!.projectPath).toBe('/tmp/project');
    expect(retrieved!.description).toBe('A test session');
    expect(retrieved!.command).toBe('claude');
    expect(retrieved!.template).toBe('solo');
    expect(retrieved!.commandsSent).toBe(0);
  });

  it('getAll() returns all records', () => {
    store.save(makeRecord({ name: 'session-1' }));
    store.save(makeRecord({ name: 'session-2' }));
    store.save(makeRecord({ name: 'session-3' }));
    const all = store.getAll();
    expect(all).toHaveLength(3);
    const names = all.map((r) => r.name);
    expect(names).toContain('session-1');
    expect(names).toContain('session-2');
    expect(names).toContain('session-3');
  });

  it('delete() removes a record', () => {
    store.save(makeRecord({ name: 'to-delete' }));
    expect(store.get('to-delete')).not.toBeNull();
    store.delete('to-delete');
    expect(store.get('to-delete')).toBeNull();
  });

  it('updateDescription() updates description', () => {
    store.save(makeRecord({ name: 'desc-test', description: 'old desc' }));
    store.updateDescription('desc-test', 'new desc');
    const record = store.get('desc-test');
    expect(record!.description).toBe('new desc');
  });

  it('addTag() adds a tag', () => {
    store.save(makeRecord({ name: 'tag-test', tags: [] }));
    store.addTag('tag-test', 'important');
    const record = store.get('tag-test');
    expect(record!.tags).toContain('important');
  });

  it('addTag() does not duplicate existing tag', () => {
    store.save(makeRecord({ name: 'tag-test', tags: ['existing'] }));
    store.addTag('tag-test', 'existing');
    const record = store.get('tag-test');
    expect(record!.tags.filter((t) => t === 'existing')).toHaveLength(1);
  });

  it('removeTag() removes a tag', () => {
    store.save(makeRecord({ name: 'tag-rm', tags: ['keep', 'remove'] }));
    store.removeTag('tag-rm', 'remove');
    const record = store.get('tag-rm');
    expect(record!.tags).toEqual(['keep']);
  });

  it('incrementCommandsSent() increments the counter', () => {
    store.save(makeRecord({ name: 'cmd-test', commandsSent: 5 }));
    store.incrementCommandsSent('cmd-test');
    store.incrementCommandsSent('cmd-test');
    const record = store.get('cmd-test');
    expect(record!.commandsSent).toBe(7);
  });

  it('search() finds by name', () => {
    store.save(makeRecord({ name: 'alpha-project' }));
    store.save(makeRecord({ name: 'beta-project' }));
    const results = store.search('alpha');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('alpha-project');
  });

  it('search() finds by description', () => {
    store.save(makeRecord({ name: 'session-1', description: 'working on frontend' }));
    store.save(makeRecord({ name: 'session-2', description: 'working on backend' }));
    const results = store.search('frontend');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('session-1');
  });

  it('search() finds by tags', () => {
    store.save(makeRecord({ name: 'tagged-session', tags: ['urgent', 'bugfix'] }));
    store.save(makeRecord({ name: 'other-session', tags: ['feature'] }));
    const results = store.search('urgent');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('tagged-session');
  });

  it('findByTag() finds by specific tag', () => {
    store.save(makeRecord({ name: 's1', tags: ['dev', 'frontend'] }));
    store.save(makeRecord({ name: 's2', tags: ['dev', 'backend'] }));
    store.save(makeRecord({ name: 's3', tags: ['prod'] }));
    const results = store.findByTag('dev');
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name);
    expect(names).toContain('s1');
    expect(names).toContain('s2');
  });

  it('getStats() returns correct statistics', () => {
    store.save(makeRecord({ name: 'stat-1', commandsSent: 10 }));
    store.save(makeRecord({ name: 'stat-2', commandsSent: 20 }));
    const stats = store.getStats();
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalCommands).toBe(30);
    expect(stats.sessions).toHaveLength(2);
  });

  it('getStats() with specific session name', () => {
    store.save(makeRecord({ name: 'specific', commandsSent: 42 }));
    store.save(makeRecord({ name: 'other', commandsSent: 10 }));
    const stats = store.getStats('specific');
    expect(stats.totalSessions).toBe(1);
    expect(stats.totalCommands).toBe(42);
    expect(stats.sessions).toHaveLength(1);
    expect(stats.sessions[0].name).toBe('specific');
  });
});
