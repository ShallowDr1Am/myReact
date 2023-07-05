import { enqueueConcurrentHookUpdate, enqueueConcurrentClassUpdate } from "./ReactFiberConcurrentUpdates"
import assign from 'shared/assign'
import {
  NoLanes,
  NoLane,
  mergeLanes,
  isSubsetOfLanes,
} from "./ReactFiberLane"
export const UpdateState = 0

export function initialUpdateQueue(fiber) {
  const queue = {
    baseState: fiber.memoizedState,
    shared: {
      pending: null
    },
    lastBaseUpdate: null,
    firstBaseUpdate: null,
  }
  fiber.updateQueue = queue
}

export function createUpdate(lane) {
  const update = { tag: UpdateState, lane, next: null }
  return update
}

export function enqueueUpdate(fiber, update, lane) {
  // 获取更新队列
  const updateQueue = fiber.updateQueue
  // 获取共享队列
  const sharedQueue = updateQueue.shared
  return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane)
}

/**
 * 根据老状态和更新队列中的更新计算最新的状态
 * @param {*} workInProgress 
 */
export function processUpdateQueue(workInProgress, nextProps, renderLanes) {
  const queue = workInProgress.updateQueue
  let firstBaseUpdate = queue.firstBaseUpdate
  let lastBaseUpdate = queue.lastBaseUpdate
  const pendingQueue = queue.shared.pending
  // 合并新老链表
  if (pendingQueue !== null) {
    queue.shared.pending = null
    const lastPendingUpdate = pendingQueue
    const firstPendingUpdate = lastPendingUpdate.next
    lastPendingUpdate.next = null
    // 如果没有老链表
    if (lastBaseUpdate === null) {
      firstBaseUpdate = firstPendingUpdate
    } else {
      lastBaseUpdate.next = firstPendingUpdate
    }
    lastBaseUpdate = lastPendingUpdate
  }
  // 链表不为空
  if (firstBaseUpdate !== null) {
    let newState = queue.baseState
    // 尚未执行的更新的lane
    let newLanes = NoLanes
    let newBaseState = null
    let newFirstBaseUpdate = null
    let newLastBaseUpdate = null
    let update = firstBaseUpdate // updateA
    do {
      const updateLane = update.lane
      // 如果说updatelane不是renderlane的子集 不处理更新
      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // 把此更新克隆一份
        const clone = {
          id: update.id,
          lane: updateLane,
          payload: update.payload
        }
        // 新的跳过的base链表为空   该更新为第一个跳过的更新
        if (newLastBaseUpdate === null) {
          newFirstBaseUpdate = newLastBaseUpdate = clone
          newBaseState = newState
        } else {
          newLastBaseUpdate = newLastBaseUpdate.next = clone
        }
        // 如果有跳过的更新，就把跳过的更新所在的赛道合并到newlane
        newLanes = mergeLanes(newLanes, updateLane)
      } else {
        if (newLastBaseUpdate !== null) {
          const clone = {
            id: update.id,
            lane: NoLane,
            payload: update.payload
          }
          newLastBaseUpdate = newLastBaseUpdate.next = clone
        }
        newState = getStateFromUpdate(update, newState)
      }
      update = update.next
    } while (update)
    if (!newLastBaseUpdate) {
      newBaseState = newState
    }
    queue.baseState = newBaseState
    queue.firstBaseUpdate = newFirstBaseUpdate
    queue.lastBaseUpdate = newLastBaseUpdate
    workInProgress.lanes = newLanes
    // 本次渲染完会判断，此fiber上还有没有不为0的lane
    workInProgress.memoizedState = newState
  }
}
/**
 * 根据老状态和更新计算新状态
 * @param {*} update  更新的对象其实有很多种类型
 * @param {*} prevState 
 */
function getStateFromUpdate(update, prevState, nextProps) {
  switch (update.tag) {
    case UpdateState:
      const { payload } = update
      let partialState
      if (typeof payload === 'function') {
        partialState = payload.call(null, prevState, next, nextProps)
      } else {
        partialState = payload
      }
      return assign({}, prevState, partialState)
  }
}

export function cloneUpdateQueue(current, workInProgress) {
  const workInProgressQueue = workInProgress.updateQueue
  const currentQueue = current.updateQueue
  // 如果新的队列和老的队列不是用一个对象的话 
  if (currentQueue === workInProgressQueue) {
    const clone = {
      baseState: currentQueue.baseState,
      firstPendingUpdate: currentQueue.firstPendingUpdate,
      firstBaseUpdate: currentQueue.firstBaseUpdate,
      lastBaseUpdate: currentQueue.lastBaseUpdate,
      shared: currentQueue.shared
    }
    workInProgress.updateQueue = clone
  }
}