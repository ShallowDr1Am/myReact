import { HostRoot, HostText, HostComponent, IndeterminateComponent } from './ReactWorkTags'
import { NoFlags } from './ReactFiberFlags'
import { NoLanes } from './ReactFiberLane'
/**
 * 
 * @param {*} tag fiber的类型 
 * @param {*} pendingProps 新属性，等待处理和生效
 * @param {*} key 唯一标识
 */
export function FiberNode(tag, pendingProps, key) {
  this.tag = tag
  this.key = key
  this.type = null
  this.stateNode = null

  this.return = null
  this.child = null
  this.sibling = null

  this.pendingProps = pendingProps
  this.memoizedProps = null

  this.memoizedState = null //每个fiber还有自己的状态
  this.updateQueue = null

  //副作用标识
  this.flags = NoFlags
  //子节点副作用标识
  this.subtreeFlags = NoFlags
  this.alternate = null
  this.index = 0 // 索引，在父fiber排第几
  this.deletions = null
  this.lanes = NoLanes
  this.childLanes = NoLanes
  this.ref = null
}
export function createFiber(tag, pendingProps, key) {
  return new FiberNode(tag, pendingProps, key);
}
export function createHostRootFiber() {
  return createFiber(HostRoot, null, null)
}

/**
 * 基于老的fiber和新的属性创建新的fiber
 * 1.current和workInProgress不是一个对象
 * 2.workInProgress有两种情况：
 *    A.一种是没有，创建一个新，互相通过alternate指向
 *    B.存在alterante,直接复用老的alternate
 * @param {*} current  老fiber
 * @param {*} pendingProps  新属性
 */
export function createWorkInProgress(current, pendingProps) {
  let workInProgress = current.alternate
  if (workInProgress === null) {
    workInProgress = createFiber(current.tag, pendingProps, current.key)
    workInProgress.type = current.type
    workInProgress.stateNode = current.stateNode
    workInProgress.alternate = current
    current.alternate = workInProgress
  } else {
    workInProgress.pendingProps = pendingProps
    workInProgress.type = current.type
    workInProgress.flags = NoFlags
    workInProgress.subtreeFlags = NoFlags
  }
  workInProgress.child = current.child
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.memoizedState = current.memoizedState
  workInProgress.updateQueue = current.updateQueue
  workInProgress.sibling = current.sibling
  workInProgress.index = current.index
  workInProgress.ref = current.ref
  workInProgress.flags = current.flags
  workInProgress.lanes = current.lanes
  workInProgress.childLanes = current.childLanes
  return workInProgress
}

/**
 * 根据虚拟DOM节点创建fiber节点
 * @param {*} element 
 */
export function createFiberFromElement(element) {
  const { type, key } = element
  const pendingProps = element.props
  return createFiberFromTypeAndProps(type, key, pendingProps)
}

function createFiberFromTypeAndProps(type, key, pendingProps) {
  let tag = IndeterminateComponent
  // 如果类型type是一个字符串 span div  说明fiber类型是原生组件
  if (typeof type === 'string') {
    tag = HostComponent
  }
  const fiber = createFiber(tag, pendingProps, key);
  fiber.type = type
  return fiber
}

export function createFiberFromText(content) {
  const fiber = createFiber(HostText, content, null)
  return fiber
}