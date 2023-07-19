import { getEventTarget } from './getEventTarget'
import { getClosestInstanceFromNode } from '../client/ReactDOMComponentTree'
import { dispatchEventForPluginEventSystem } from './DOMPluginEventSystem'
import { ContinuousEventPriority, DefaultEventPriority, DiscreteEventPriority, setCurrentUpdatePriority } from 'react-reconciler/src/ReactEventPriorities'
import { getCurrentEventPriority } from '../client/ReactDOMHostConfig'
export function createEventListenerWrapperWithPriorty(
  targetContainer,
  domEventName,
  eventSystemFlags
) {
  const listenerWrapper = dispatchDiscreteEvent
  return listenerWrapper.bind(null, domEventName, eventSystemFlags, targetContainer)
}

/**
 * 派发离散的事件的监听函数
 * @param {*} domEventName 事件名 click
 * @param {*} eventSystemFlags 阶段0 冒泡 4 捕获
 * @param {*} container 容器div#root
 * @param {*} nativeEvent 原生的事件
 */
function dispatchDiscreteEvent(domEventName, eventSystemFlags, container, nativeEvent) {
  // 点击按钮的时候需要设置优先级
  // 现获取老的更新优先级
  const previousPriority = getCurrentEventPriority()
  try {
    // 把当前的更新优先级设置成离散事件优先级
    setCurrentUpdatePriority(DiscreteEventPriority)
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent)
  } finally {
    setCurrentUpdatePriority(previousPriority)
  }
}

/**
 * 此方法就是委托给容器的回调，当容器#root在捕获或者说冒泡阶段处理事件的时候会触发此函数
 * @param {*} domEventName 
 * @param {*} eventSystemFlags 
 * @param {*} container 
 * @param {*} nativeEvent 
 */
export function dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent) {
  // 获取事件源，它是一个真实DOM
  const nativeEventTarget = getEventTarget(nativeEvent)
  // 获取真实DOM的fiber实例
  const targetInst = getClosestInstanceFromNode(nativeEventTarget)
  dispatchEventForPluginEventSystem(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    targetInst,
    container
  )
}


/**
 * 获取事件优先级
 * @param {*} domEventName 事件的名称 click
 */
export function getEventPriority(domEventName) {
  switch (domEventName) {
    case 'click':
      return DiscreteEventPriority
    case 'drag':
      return ContinuousEventPriority
    default:
      return DefaultEventPriority
  }
}