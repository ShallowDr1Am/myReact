
export const allNativeEvents = new Set()

/**
 * 注册两个阶段的事件
 * 在页面触发时间，会走事件处理函数
 * 事件处理函数需要找到DOM元素对应的要执行的事件 onClick，onClickCapture
 * @param {*} registrationName React事件名 onClick
 * @param {*} dependencies 原生事件数组 [click]
 */
export function registerTwoPhaseEvent(registrationName, dependencies) {
  // 注册冒泡事件的对应关系
  registerDirectEvent(registrationName, dependencies)
  // 注册捕获事件的对印关系
  registerDirectEvent(registrationName + 'Capture', dependencies)
}

export function registerDirectEvent(registrationName, dependencies) {
  for (let i = 0; i < dependencies.length; i++) {
    allNativeEvents.add(dependencies[i])
  }
}