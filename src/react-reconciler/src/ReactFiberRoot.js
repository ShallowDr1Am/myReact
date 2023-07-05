import { createHostRootFiber } from './ReactFiber'
import { initialUpdateQueue } from './ReactFiberClassUpdateQueue'
import { NoLanes, NoLane, createLaneMap, NoTimestamp } from './ReactFiberLane'
function FiberRootNode(containerInfo) {
  this.containerInfo = containerInfo
  // 表示此根上有哪些赛道等待被执行
  this.pendingLanes = NoLanes
  this.callbackNode = null
  this.callbackPriority = NoLane
  // 过期时间 存放每个赛道的过期时间
  this.expirationTimes = createLaneMap(NoTimestamp)
  // 过期赛道
  this.expiredLanes = NoLanes
  this.eventTimes = createLaneMap(NoLanes)
}
export function createFiberRoot(containerInfo) {
  const root = new FiberRootNode(containerInfo)
  // 初始化fiber根节点
  const uninitializeFiber = createHostRootFiber()
  root.current = uninitializeFiber
  uninitializeFiber.stateNode = root
  initialUpdateQueue(uninitializeFiber)
  return root;
}