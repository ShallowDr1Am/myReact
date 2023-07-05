import {
  scheduleCallback as Scheduler_scheduleCallback,
  shouldYield,
  NormalPriority as NormalSchedulerPriority,
  ImmediatePriority as ImmediateSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
  IdlePriority as IdleSchedulerPriority,
  unstable_cancelCallback as Scheduler_cancelCallback,
  now,
} from './Scheduler'
import { getCurrentEventPriority } from 'react-dom-bindings/src/client/ReactDOMHostConfig'
import { createWorkInProgress } from './ReactFiber'
import { beginWork } from './ReactFiberBeginWork'
import { completeWork } from './ReactFiberCompleteWork'
import { ChildDeletion, MutationMask, NoFlags, Passive, Placement, Update } from './ReactFiberFlags';
import {
  commitMutationEffectsOnFiber,
  commitPassiveUnmountEffects,
  commitPassiveMountEffects,
  commitLayoutEffects,
} from './ReactFiberCommitWork'
import { FunctionComponent, HostComponent, HostRoot, HostText } from './ReactWorkTags';
import { finishQueueingConcurrentUpdates } from './ReactFiberConcurrentUpdates'
import {
  NoLanes,
  markRootUpdated,
  getNextLanes,
  getHighestPriorityLane,
  SyncLane,
  includesBlockingLane,
  markStarvedLanesAsExpired,
  NoTimestamp,
  includesExpiredLane,
  markRootFinished,
  mergeLanes,
} from './ReactFiberLane'

import {
  DiscreteEventPriority,
  ContinuousEventPriority,
  DefaultEventPriority,
  IdleEventPriority,
  setCurrentUpdatePriority,
} from './ReactEventPriorities'
import { getCurrentUpdatePriority, lanesToEventPriority } from './ReactEventPriorities'
import { scheduleSyncCallback, flushSyncCallbacks } from './ReactFiberSyncTaskQueue'

let workInProgress = null;
let workInProgressRoot = null // 正在构建中的根节点
let rootDoesHavePassiveEffect = false // 次根节点上有没有useEffect副作用
let rootWithPendingPassiveEffects = null //具有Effect副作用的根节点
let workInProgressRootRenderLanes = NoLanes

// 构建fiber树正在进行中
const RootInProgress = 0
// 构建fiber树已经完成
const RootCompleted = 5
// 当渲染工作结束的时候当前的fiber树处于什么状态，默认进行中
let workInProgressRootExitStatus = RootInProgress
let currentEventTime = NoTimestamp

/**
 * 计划更新root，具有调度任务的功能
 * @param {*} root 
 */
export function scheduleUpdateOnFiber(root, fiber, lane, eventTime) {
  markRootUpdated(root, lane, eventTime)
  //确保调度执行root上的更新
  ensureRootIsScheduled(root, eventTime)
}

function ensureRootIsScheduled(root, currentTime) {
  // 先获取当前根上执行的任务
  const existingCallbackNode = root.callbackNode
  // 把所有饿死的赛道标记为过期
  markStarvedLanesAsExpired(root, currentTime)
  // 获取当前优先级最高的车道
  const nextLanes = getNextLanes(root, workInProgressRootRenderLanes)
  if (nextLanes === NoLanes) {
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return
  }
  // 获取新的调度优先级
  let newCallbackPriority = getHighestPriorityLane(nextLanes)
  // 获取现在根上正在运行的优先级
  const existingCallbackPriority = root.callbackPriority
  // 如果新的优先级和老的优先级一样，则可以进行批量更新
  if (existingCallbackPriority === newCallbackPriority) {
    return
  }
  if (existingCallbackNode !== null) {
    Scheduler_cancelCallback(existingCallbackNode)
  }
  // 新的回调任务
  let newCallbackNode = null
  // 如果新的优先级是同步的话
  if (newCallbackPriority === SyncLane) {
    // 先把performSyncWorkOnRoot 添加到同步队列中
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
    // 再把flushSyncCallbacks放入微任务中
    queueMicrotask(flushSyncCallbacks)
    newCallbackNode = null
  } else {
    // 如果不是同步，就需要调度一个任务
    let schedulerPriorityLevel
    switch (lanesToEventPriority(nextLanes)) {
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediateSchedulerPriority;
        break;
      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingSchedulerPriority;
        break;
      case DefaultEventPriority:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
      case IdleEventPriority:
        schedulerPriorityLevel = IdleSchedulerPriority;
        break;
      default:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
    }
    newCallbackNode = Scheduler_scheduleCallback(schedulerPriorityLevel, performConcurrentWorkOnRoot.bind(null, root))
  }
  // 在根节点的执行的任务是newcallbackNode
  root.callbackNode = newCallbackNode
  root.callbackPriority = newCallbackPriority
  // if (workInProgressRoot) return
  // workInProgressRoot = root
  // 告知浏览器执行performConcurrentWorkOnRoot
}
/**
 * 在根上执行同步工作
 */
function performSyncWorkOnRoot(root) {
  const lanes = getNextLanes(root)
  renderRootSync(root, lanes)
  // 获取渲染完成的fiber根
  const finishedWork = root.current.alternate
  root.finishedWork = finishedWork
  commitRoot(root)
  return null
}

/**
 * 根据虚拟DOM构建fiber树，创建真实DOM节点,把真实DOM节点插入容器
 * @param {*} root 
 */
function performConcurrentWorkOnRoot(root, didTimeout) {
  // debugger
  // 先获取当前根节点上的任务
  const originalCallbackNode = root.callbackNode
  const lanes = getNextLanes(root, NoLanes)
  if (lanes === NoLanes) {
    return null
  }
  // 如果不包含阻塞的车道并且没有超时，就可以并行渲染，启用时间分片
  // 是否不包含阻塞车道
  const nonIncludesBlockingLane = !includesBlockingLane(root, lanes)
  // 是否不包含过期的车道
  const nonIncludesExpiredLane = !includesExpiredLane(root, lanes)
  // 时间片没有过期
  const nonTimeout = !didTimeout
  const shouldTimeSlice = nonIncludesBlockingLane && nonIncludesExpiredLane && nonTimeout
  // 执行渲染，得到推出的状态
  const exitStatus = shouldTimeSlice ? renderRootConcurrent(root, lanes) : renderRootSync(root, lanes)
  // 如果不是渲染中的话，那说明肯定渲染完了
  if (exitStatus !== RootInProgress) {
    const finishedWork = root.current.alternate
    root.finishedWork = finishedWork
    commitRoot(root)
  }
  // 说明任务没有完成
  if (root.callbackNode === originalCallbackNode) {
    // 把此函数返回，下次接着执行
    return performConcurrentWorkOnRoot.bind(null, root)
  }
  return null
}
function renderRootConcurrent(root, lanes) {
  // 因为在构建fiber树的过程中，此方法会反复进入，会进入多次
  // 只有在第一次进来的时候会创建新的fiber树，或者说新的fiber
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    prepareFreshStack(root, lanes)
  }
  // 在当前分配的时间片内执行fiber树的构建渲染
  workLoopConcurrent()
  // 不为null，说明fiber树的构建还没有完成
  if (workInProgress !== null) {
    return RootInProgress
  }
  // 渲染结束
  return workInProgressRootExitStatus
}
function flushPassiveEffect() {
  if (rootWithPendingPassiveEffects !== null) {
    const root = rootWithPendingPassiveEffects
    // 执行卸载副作用,destroy
    commitPassiveUnmountEffects(root.current)
    // 执行挂载副作用,create
    commitPassiveMountEffects(root, root.current)
  }
}
function commitRoot(root) {
  const previousUpdatePriority = getCurrentUpdatePriority()
  try {
    // 把当前的更新优先级设置为1
    setCurrentUpdatePriority(DiscreteEventPriority)
    commitRootImpl(root)
  } finally {
    setCurrentUpdatePriority(previousUpdatePriority)
  }
}
function commitRootImpl(root) {
  const { finishedWork } = root
  workInProgressRoot = null
  workInProgressRootRenderLanes = NoLanes
  root.callbackNode = null
  root.callbackPriority = null
  // 合并统计当前新的根上剩下的车道
  const remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes)
  markRootFinished(root, remainingLanes)
  if ((finishedWork.subtreeFlags & Passive) !== NoFlags
    || (finishedWork.flags & Passive) !== NoFlags) {
    if (!rootDoesHavePassiveEffect) {
      rootDoesHavePassiveEffect = true
      Scheduler_scheduleCallback(NormalSchedulerPriority, flushPassiveEffect)
    }
  }
  const subtreeHasEffects = (finishedWork.subtreeFlags & MutationMask) !== NoFlags
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags
  // 如果自己的副作用或者子节点有副作用
  if (subtreeHasEffects || rootHasEffect) {
    // dom执行变更
    commitMutationEffectsOnFiber(finishedWork, root)
    // 執行layout
    commitLayoutEffects(finishedWork, root)
    if (rootDoesHavePassiveEffect) {
      rootDoesHavePassiveEffect = false
      rootWithPendingPassiveEffects = root
    }
  }
  // 等DOM变更后，就可以让把root的current进行DOM操作
  root.current = finishedWork
  // 在提交之后，因为根上可能会有跳过的更新，所以需要重新调度
  ensureRootIsScheduled(root, now())
}

function prepareFreshStack(root, renderLanes) {
  workInProgress = createWorkInProgress(root.current, null)
  workInProgressRoot = root
  workInProgressRootRenderLanes = renderLanes
  finishQueueingConcurrentUpdates()
}

function renderRootSync(root, renderLanes) {
  // 如果新的根和老的根不一样，或者新的渲染优先级和老的渲染优先级不一样
  if (root !== workInProgressRoot || workInProgressRootRenderLanes !== renderLanes) {
    // 开始构建fiber树
    prepareFreshStack(root, renderLanes)
  }
  workLoopSync()
  return RootCompleted
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}
function workLoopConcurrent() {
  // 如果有下一个要构建的fiber并且时间片没有过期
  while (workInProgress !== null && !shouldYield()) {
    // sleep(6)
    performUnitOfWork(workInProgress)
  }
}

/**
 * 执行一个工作单元
 * @param {*} unitOfWork 
 */
function performUnitOfWork(unitOfWork) {
  // 获取新fiber对应的老fiber
  const current = unitOfWork.alternate
  // 完成当前fiber的子fiber链表构建后
  const next = beginWork(current, unitOfWork, workInProgressRootRenderLanes)
  unitOfWork.memoizedProps = unitOfWork.pendingProps
  if (next === null) {// 如果没有子节点标识当前的fiber已经完成了
    completeUnitOfWork(unitOfWork)
  } else {// 如果有子节点，就让子节点成为下一个工作单元
    workInProgress = next
  }
}

function completeUnitOfWork(unitOfWork) {
  let completedWork = unitOfWork
  do {
    const current = completedWork.alternate
    const returnFiber = completedWork.return
    // 执行此fiber的完成工作
    // 如果是原生组件的话就是创建真实的DOM
    completeWork(current, completedWork)
    // 如果有弟弟，就构建弟弟对应的fiber子链表
    const siblingFiber = completedWork.sibling
    if (siblingFiber !== null) {
      workInProgress = siblingFiber
      return
    }
    // 如果没有弟弟，当前完成的是父FIber的最后一个节点，即所有子fiber都完成
    // 当前父fiber的所有子fiber都完成了  向上递归逐渐到顶部
    completedWork = returnFiber
    workInProgress = completedWork
  } while (completedWork !== null)
  // fiber树全部构建完毕,把构建状态设置为完成
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted
  }
}

function printFinishedWork(fiber) {
  const { flags, deletions } = fiber
  if ((flags & ChildDeletion) !== NoFlags) {
    fiber.flags &= (~ChildDeletion)
    console.log('子节点有删除' + (deletions.map(fiber => `${fiber.type}#${fiber.memoizedProps.id}`).join(',')))
  }
  let child = fiber.child
  while (child) {
    printFinishedWork(child)
    child = child.sibling
  }
  if (fiber.flags !== NoFlags) {
    console.log(getFlags(fiber), getTag(fiber.tag), fiber.type, fiber.memoizedProps)
  }
}

function getFlags(fiber) {
  const { flags, deletions } = fiber
  if (flags === (Placement | Update)) {
    return '移动'
  }
  if (flags === Placement) {
    return '插入'
  }
  if (flags === Update) {
    return '更新'
  }
  return flags

}

function getTag(tag) {
  switch (tag) {
    case FunctionComponent:
      return 'FunctionComponent'
    case HostRoot:
      return 'HostRoot'
    case HostComponent:
      return 'HostComponent'
    case HostText:
      return 'HostText'
    default:
      return
  }
}

export function requestUpdateLane() {
  const updateLane = getCurrentUpdatePriority()
  if (updateLane !== NoLanes) {
    return updateLane
  }
  const eventLane = getCurrentEventPriority()
  return eventLane
}

function sleep(duration) {
  const timestamp = new Date().getTime()
  const endTime = timestamp + duration
  while (true) {
    if (new Date().getTime() > endTime) {
      return
    }
  }
}

// 请求当前的时间
export function requestEventTime() {
  currentEventTime = now()
  return currentEventTime // performance.now()
}