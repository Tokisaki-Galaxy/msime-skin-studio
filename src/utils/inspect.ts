// 参数与预览的联动：右侧面板悬停某个字段时，预览里高亮对应的区域。
//
// 面板与预览在组件树上是兄弟，中间隔着 App 与两条分栏。为了不把回调一层层透传下去，
// 这里用一个极小的发布订阅：面板写，预览读。只承载「当前悬停的是哪一组字段」这一个字符串，
// 不做通用状态管理。
//
// 为什么值得做：皮肤字段名（content_insets_dip / outer_insets_dip）对新手是黑话，
// 光看数字不知道改的是屏幕上哪一块。Rime 主题工坊正是靠这类双向定位降低门槛的。

export type InspectTarget = 'content' | 'outer' | 'panel' | null;

type Listener = (target: InspectTarget) => void;

const listeners = new Set<Listener>();
let current: InspectTarget = null;

/** 面板侧调用：进入字段时传对应区域，离开时传 null。 */
export function setInspectTarget(target: InspectTarget): void {
  if (current === target) return;
  current = target;
  for (const listener of listeners) listener(current);
}

export function getInspectTarget(): InspectTarget {
  return current;
}

/** 预览侧订阅。返回取消订阅函数。 */
export function subscribeInspectTarget(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// 兜底：面板被折叠或字段被删除时 mouseleave 不一定触发，高亮可能卡在预览上。
// 滚动是「注意力已经转移」的明确信号，清掉即可。不监听 mousedown：那会让
// 用户在悬停状态下点数字框输入时高亮闪掉。
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => setInspectTarget(null), true);
}
