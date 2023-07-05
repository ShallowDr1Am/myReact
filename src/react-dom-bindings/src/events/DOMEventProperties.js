import { registerTwoPhaseEvent } from './EventRegistry'
const simpleEventPluginEvetns = ['click']
export const topLevelEventsToReactNames = new Map()
function registerSimpleEvent(domEventName, reactName) {
  // onClick 虚拟DOM.props取到 workInpropgress.pendingProps = React元素或者虚拟DOM
  // const newProps = workInprogress.pendingProps
  // reactName可以从fiber上取到
  // 让真实DOM元素 updateFiberprops(domElement,props)
  // const inernalPropsKey = "__reactProps$"+randomKey
  // 真实DOM元素[internalPropsKey] = props
  topLevelEventsToReactNames.set(domEventName, reactName)// 原生事件与react名字的映射
  registerTwoPhaseEvent(reactName, [domEventName])// onClick ['click']
}

export function registerSimpleEvents() {
  for (let i = 0; i < simpleEventPluginEvetns.length; i++) {
    const eventName = simpleEventPluginEvetns[i]
    const domEventName = eventName.toLowerCase()//click
    const capitalizeEvent = eventName[0].toUpperCase() + eventName.slice(1)// Click
    registerSimpleEvent(domEventName, `on${capitalizeEvent}`)
  }
}