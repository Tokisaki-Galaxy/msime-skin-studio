import { describe, expect, it, vi } from 'vitest';
import { getInspectTarget, setInspectTarget, subscribeInspectTarget } from './inspect';

// 面板悬停 → 预览高亮的唯一通路。这里钉住三条语义：
// 值相同的重复设置不触发、取消订阅后不再收到、读取到的是最后一次设置的值。
describe('参数与预览的联动通道', () => {
  it('设置后订阅者能收到', () => {
    const spy = vi.fn();
    const off = subscribeInspectTarget(spy);
    setInspectTarget('content');
    expect(spy).toHaveBeenCalledWith('content');
    expect(getInspectTarget()).toBe('content');
    off();
    setInspectTarget(null);
  });

  it('订阅时立刻回放当前值，避免热更新后组件以为没有高亮', () => {
    setInspectTarget('panel');
    const spy = vi.fn();
    const off = subscribeInspectTarget(spy);
    expect(spy).toHaveBeenCalledWith('panel');
    off();
    setInspectTarget(null);
  });

  it('重复设置同一个值不会再通知，避免无谓重渲染', () => {
    setInspectTarget(null);
    const spy = vi.fn();
    const off = subscribeInspectTarget(spy);
    spy.mockClear();
    setInspectTarget('outer');
    setInspectTarget('outer');
    expect(spy).toHaveBeenCalledTimes(1);
    off();
    setInspectTarget(null);
  });

  it('取消订阅后不再收到通知', () => {
    const spy = vi.fn();
    const off = subscribeInspectTarget(spy);
    spy.mockClear();
    off();
    setInspectTarget('panel');
    expect(spy).not.toHaveBeenCalled();
    setInspectTarget(null);
  });

  it('多个订阅者都能收到', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeInspectTarget(a);
    const offB = subscribeInspectTarget(b);
    setInspectTarget('content');
    expect(a).toHaveBeenCalledWith('content');
    expect(b).toHaveBeenCalledWith('content');
    offA();
    offB();
    setInspectTarget(null);
  });
});
