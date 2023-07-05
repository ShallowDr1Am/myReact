const NoLanes = 0b00
const NoLane = 0b00
const SyncLane = 0b01
const InputContinuousHydrationLane = 0b10

function isSubsetOfLanes(set, subSet) {
  return (set & subSet) === subSet
}

function mergeLanes(a, b) {
  return a | b
}

function initializeUpdateQueue(fiber) {
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

function enqueueUpdate(fiber, update) {
  const updateQueue = fiber.updateQueue
  const sharedQueue = updateQueue.shared
  const pending = sharedQueue.pending
  if (pending === null) {
    update.next = update
  } else {
    update.next = pending.next
    pending.next = update
  }
  sharedQueue.pending = update
}
function processUpdateQueue(fiber, renderLanes) {
  const queue = fiber.updateQueue
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
    let newLanes = Nolanes
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
            lane: Nolane,
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
    fiber.lanes = newLanes
    // 本次渲染完会判断，此fiber上还有没有不为0的lane
    fiber.memoizedState = newState
  }
}
function getStateFromUpdate(update, prevState) {
  return update.payload(prevState)
}

// 新建fiber
let fiber = { memoizedState: '' }
initializeUpdateQueue(fiber)
let update1 = { id: 'A', payload: (state) => state + 'A', lane: InputContinuousHydrationLane }
enqueueUpdate(fiber, update1)
let update2 = { id: 'B', payload: (state) => state + 'B', lane: Synclane }
enqueueUpdate(fiber, update2)
let update3 = { id: 'C', payload: (state) => state + 'C', lane: InputContinuousHydrationLane }
enqueueUpdate(fiber, update3)
let update4 = { id: 'D', payload: (state) => state + 'D', lane: Synclane }
enqueueUpdate(fiber, update4)

// 处理新队列 在处理的时候需要指定一个渲染优先级
processUpdateQueue(fiber, Synclane)

console.log(fiber.memoizedState)
console.log('updateQueue', printUpdateQueue(fiber.updateQueue))

let update5 = { id: 'E', payload: (state) => state + 'E', lane: InputContinuousHydrationLane }
enqueueUpdate(fiber, update3)
let update6 = { id: 'F', payload: (state) => state + 'F', lane: Synclane }
enqueueUpdate(fiber, update4)

processUpdateQueue(fiber, InputContinuousHydrationLane)

console.log(fiber.memoizedState)

function printUpdateQueue(updateQueue) {
  const { baseState, firstBaseUpdate } = updateQueue
  let desc = baseState + '#'
  let update = firstBaseUpdate
  while (update) {
    desc += (update.id + '=>')
    update = update.next
  }
  desc += 'null'
  console.log(desc)
}