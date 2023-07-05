import { HostRoot } from "./ReactWorkTags";
import { mergeLanes } from "./ReactFiberLane";

const concurrentQueue = []
let concurrentQueuesIndex = 0

/**
 * 把更新先缓存到concurrentQueue数组
 * @param {*} fiber 
 * @param {*} queue 
 * @param {*} update 
 */
function enqueueUpdate(fiber, queue, update, lane) {
  concurrentQueue[concurrentQueuesIndex++] = fiber
  concurrentQueue[concurrentQueuesIndex++] = queue
  concurrentQueue[concurrentQueuesIndex++] = update
  concurrentQueue[concurrentQueuesIndex++] = lane
  // 向fiber上添加一个更新的时候，要把此更新的赛道合并到此fiber的赛道上
  fiber.lanes = mergeLanes(fiber.lanes, lane)
}

/**
 * 函数组件的更新
 * 函数组件fiber的memoizedState = hook链表头 = updateQueue {action:更新函数state=>state+'A'}
 */
export function finishQueueingConcurrentUpdates() {
  const endIndex = concurrentQueuesIndex
  concurrentQueuesIndex = 0
  let i = 0
  while (i < endIndex) {
    const fiber = concurrentQueue[i++]
    const queue = concurrentQueue[i++]
    const update = concurrentQueue[i++]
    const lane = concurrentQueue[i++]
    if (queue !== null && update !== null) {
      const pending = queue.pending
      if (pending === null) {
        update.next = update
      } else {
        update.next = pending.next
        pending.next = update
      }
      queue.pending = update
    }
  }
}
/**
 * 把更新队列添加到更新队列中
 * @param {*} fiber 函数组件对应的fiber
 * @param {*} queue 要更新的hook对应的更新队列
 * @param {*} update 更新对象
 */
export function enqueueConcurrentHookUpdate(fiber, queue, update, lane) {
  enqueueUpdate(fiber, queue, update, lane)
  return getRootForUpdatedFiber(fiber)
}
function getRootForUpdatedFiber(sourceFiber) {
  let node = sourceFiber
  let parent = node.return
  while (parent !== null) {
    node = parent
    parent = node.return
  }
  return node.tag === HostRoot ? node.stateNode : null
}

/**
 * 把更新入队
 * @param {*} fiber 入队的fiber 根fiber
 * @param {*} queue sharedQueue 待生效的队列
 * @param {*} update 更新
 * @param {*} lane 此更新的车道
 */
export function enqueueConcurrentClassUpdate(fiber, queue, update, lane) {
  enqueueUpdate(fiber, queue, update, lane)
  return getRootForUpdatedFiber(fiber)
}