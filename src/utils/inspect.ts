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

/**
 * 预览侧订阅。订阅时立刻回放一次当前值，避免热更新或二次挂载后组件以为「没有高亮」，
 * 而模块里其实还留着一个未清掉的目标。
 */
export function subscribeInspectTarget(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

// 模块级单例在热更新时会残留旧状态，重载前清干净。
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    listeners.clear();
    current = null;
  });
}
