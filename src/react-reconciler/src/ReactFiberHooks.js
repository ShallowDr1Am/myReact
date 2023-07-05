import ReactSharedInternals from "shared/ReactSharedInternals"
import { requestEventTime, requestUpdateLane, scheduleUpdateOnFiber } from './ReactFiberWorkLoop'
import { enqueueConcurrentHookUpdate } from './ReactFiberConcurrentUpdates'
import {
  Passive as PassiveEffect,
  Update as UpdateEffect
} from './ReactFiberFlags'
import {
  HasEffect as HookHasEffect,
  Passive as HookPassive,
  Layout as HookLayout
} from './ReactHookEffectTags.js'
import { NoLane, NoLanes, isSubsetOfLanes } from "./ReactFiberLane"

const { ReactCurrentDispatcher } = ReactSharedInternals

let currentlyRenderingFiber = null
let workInProgressHook = null
let currentHook = null
let renderLanes = NoLanes

const HooksDispatcherOnMount = {
  useReducer: mountReducer,
  useState: mountState,
  useEffect: mountEffect,
  useLayoutEffect: mountLayoutEffect,
  useRef: mountRef,
}
const HooksDispatcherOnUpdate = {
  useReducer: updateReducer,
  useState: updateState,
  useEffect: updateEffect,
  useLayoutEffect: updateLayoutEffect,
  useRef: updateRef,
}
function mountRef(initialValue) {
  const hook = mountWorkInprogressHook()
  const ref = {
    current: initialValue
  }
  hook.memoizedState = ref
  return ref
}

function updateRef(initialValue) {
  const hook = updateWorkInProgressHook()
  return hook.memoizedState
}

function mountLayoutEffect(create, deps) {
  return mountEffectImpl(UpdateEffect, HookLayout, create, deps)
}
function updateLayoutEffect(create, deps) {
  return updateEffectImpl(UpdateEffect, HookLayout, create, deps)
}
function updateEffect(create, deps) {
  return updateEffectImpl(PassiveEffect, HookPassive, create, deps)
}
function mountEffect(create, deps) {
  return mountEffectImpl(PassiveEffect, HookPassive, create, deps)
}
function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  let destroy
  // 上一个老hook
  if (currentHook !== null) {
    // 获取此useEffect这个hook上老的effect对象
    const prevEffect = currentHook.memoizedState
    destroy = prevEffect.destroy
    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps
      // 用新数组和老数组进行一个对比，如果一样就不需要执行
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps)
        return
      }
    }
  }
  // 如果要执行的话需要修改fiber的flags
  currentlyRenderingFiber.flags |= fiberFlags
  // 如果要执行的话 添加HookHasEffect flags
  hook.memoizedState = pushEffect(HookHasEffect | hookFlags, create, destroy, nextDeps)
}
function areHookInputsEqual(nextDeps, prevDeps) {
  if (prevDeps === null) {
    return null
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue
    }
    return false
  }
  return true
}
function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = mountWorkInprogressHook()
  const nextDeps = deps === undefined ? null : deps
  // 给当前的函数组件fiber添加flags
  currentlyRenderingFiber.flags |= fiberFlags
  hook.memoizedState = pushEffect(HookHasEffect | hookFlags, create, undefined, nextDeps)
}
/**
 * 添加effect链表
 * @param {*} tag  effect的标签
 * @param {*} create 创建方法
 * @param {*} destroy 销毁方法
 * @param {*} deps 依赖数组
 */
function pushEffect(tag, create, destroy, deps) {
  const effect = {
    tag,
    create,
    destroy,
    deps,
    next: null
  }
  let componentUpdateQueue = currentlyRenderingFiber.updateQueue
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue()
    currentlyRenderingFiber.updateQueue = componentUpdateQueue
    componentUpdateQueue.lastEffect = effect.next = effect
  } else {
    const lastEffect = componentUpdateQueue.lastEffect
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect
    } else {
      const firstEffect = lastEffect.next
      lastEffect.next = effect
      effect.next = firstEffect
      componentUpdateQueue.lastEffect = effect
    }
  }
  return effect
}
function createFunctionComponentUpdateQueue() {
  return {
    lastEffect: null
  }
}
// useState = 内置了reducer的useReducer
function baseStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action
}
function updateState(initialState) {
  return updateReducer(baseStateReducer, initialState)
}

/**
 * hook的属性
 * memoizedState 当前hook真正显示出来的状态
 * baseState 第一个跳过的更新之前的老状态
 * lastRenderState 上一个计算的状态
 * @param {*} initialState 
 * @returns 
 */
function mountState(initialState) {
  const hook = mountWorkInprogressHook()
  hook.memoizedState = hook.baseState = initialState
  const queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: baseStateReducer,
    lastRenderedState: initialState
  }
  hook.queue = queue
  const dispatch = (queue.dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue))
  return [hook.memoizedState, dispatch]
}
function dispatchSetState(fiber, queue, action) {
  // 获取当前的更新赛道
  const lane = requestUpdateLane()
  const update = {
    lane,// 本次更新优先级
    action,
    hasEagerState: false,// 是否有急切的更新
    eagerState: null,// 紧急更新
    next: null
  }
  const alternate = fiber.alternate
  // 只有第一个更新能进行此项优化
  // 当你派发动作后，立刻用上一次的状态和上一次的reducer计算状态
  if (fiber.lanes === NoLanes && (alternate === null || alternate.lanes == NoLanes)) {
    // 获取队列上的老的状态和老的Reducer
    const { lastRenderedReducer, lastRenderedState } = queue
    // 使用上次的状态和上次的reducer结合本次acton进行计算新状态
    const eagerState = lastRenderedReducer(lastRenderedState, action)
    update.hasEagerState = true
    update.eagerState = eagerState
    if (Object.is(eagerState, lastRenderedState)) {
      return;
    }
  }
  // 入队更新并调度
  const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane)
  const eventTime = requestEventTime()
  scheduleUpdateOnFiber(root, fiber, lane, eventTime)
}

/**
 * 构建新hook
 */
function updateWorkInProgressHook() {
  // 获取将要构建的新的hook的老hook
  if (currentHook === null) {
    const current = currentlyRenderingFiber.alternate
    currentHook = current.memoizedState
  } else {
    currentHook = currentHook.next
  }
  // 根据老hook创建新hook
  const newHook = {
    memoizedState: currentHook.memoizedState,
    queue: currentHook.queue,
    next: null,
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue,
  }
  if (workInProgressHook === null) {
    currentlyRenderingFiber.memoizedState = workInProgressHook = newHook
  } else {
    workInProgressHook = workInProgressHook.next = newHook
  }
  return workInProgressHook
}

function updateReducer(reducer) {
  const hook = updateWorkInProgressHook()
  const queue = hook.queue
  queue.lastRenderedReducer = reducer
  const current = currentHook
  let baseQueue = current.baseQueue
  const pendingQueue = queue.pending
  // 新旧更新链表合并
  if (pendingQueue !== null) {
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next
      const pendingFirst = pendingQueue.next
      baseQueue.next = pendingFirst
      pendingQueue.next = baseFirst
    }
    current.baseQueue = baseQueue = pendingQueue
    queue.pending = null
  }
  if (baseQueue !== null) {
    printQueue(baseQueue)
    const first = baseQueue.next
    let newState = current.baseState
    let newBaseState = null
    let newBaseQueueFirst = null
    let newBaseQueueLast = null
    let update = first
    do {
      const updateLane = update.lane
      const shouldSkipUpdate = !isSubsetOfLanes(renderLanes, updateLane)
      if (shouldSkipUpdate) {
        const clone = {
          lane: updateLane,
          action: update.action,
          hasEagerState: update.hasEagerState,
          eagerState: update.eagerState,
          next: null,
        }
        if (newBaseQueueFirst === null) {
          newBaseQueueFirst = newBaseQueueLast = clone
          newBaseState = newState
        } else {
          newBaseQueueLast = newBaseQueueLast.next = clone
        }
        currentlyRenderingFiber.lanes = mergeLanes(currentlyRenderingFiber.lanes, updateLane)
      } else {
        if (newBaseQueueLast !== null) {
          const clone = {
            lane: NoLane,
            action: update.action,
            hasEagerState: update.hasEagerState,
            eagerState: update.eagerState,
            next: null,
          }
          newBaseQueueLast = newBaseQueueLast.next = clone
        }
        if (update.hasEagerState) {
          newState = update.eagerState
        } else {
          const action = update.action
          newState = reducer(newState, action)
        }
      }
      update = update.next
    } while (update !== null && update !== first)
    if (newBaseQueueLast === null) {
      newBaseState = newState
    } else {
      newBaseQueueLast.next = newBaseQueueFirst
    }
    hook.memoizedState = newState
    hook.baseState = newBaseState
    hook.baseQueue = newBaseQueueLast
    queue.lastRenderedState = newState
  }
  if (baseQueue === null) {
    queue.lanes = NoLanes
  }
  const dispatch = queue.dispatch
  return [hook.memoizedState, dispatch]
}
function printQueue(queue) {
  console.log('queue', queue)
}

function mountReducer(reducer, initialArg) {
  const hook = mountWorkInprogressHook()
  hook.memoizedState = initialArg
  const queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialArg,
  }
  hook.queue = queue
  const dispatch = (queue.dispatch = dispatchReducerAction.bind(null, currentlyRenderingFiber, queue))
  return [hook.memoizedState, dispatch]
}

/**
 * 执行派发动作的方法，它要更新状态，并且让界面重新更新
 * @param {*} fiber function 对应的fiber
 * @param {*} queue hook对应的更新队列
 * @param {*} action 派发的动作
 */
function dispatchReducerAction(fiber, queue, action) {
  // 再每个hook里会存放一个更新队列，更新队列是一个更新对象的循环链表
  const update = {
    action,
    next: null,
  }
  // 把当前最新的更新添加到更新队列中，并且返回当前的根fiber
  const root = enqueueConcurrentHookUpdate(fiber, queue, update)
  const eventTime = requestEventTime()
  scheduleUpdateOnFiber(root, fiber, lane, eventTime)
}

function mountWorkInprogressHook() {
  const hook = {
    memoizedState: null,// hook的状态
    queue: null,// 存放本hook的更新队列
    next: null,// 指向下一个hook,一个函数里面可以有多个hook,组成一个单向链表
    baseState: null,// 第一个跳过的更新前的状态
    baseQueue: null,// 跳过的更新的链表
  }
  if (workInProgressHook === null) {
    // 当前函数对应的fiber的状态等于第一个hook
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook
  } else {
    workInProgressHook = workInProgressHook.next = hook
  }
  return workInProgressHook
}
/**
 * 渲染函数组件
 * @param {*} current  老fiber
 * @param {*} workInProgress  新fiber
 * @param {*} Component 组件定义
 * @param {*} props 组件属性
 * @returns 虚拟DOM或REact元素
 */
export function renderWithHooks(current, workInProgress, Component, props, nextRenderLanes) {
  renderLanes = nextRenderLanes
  currentlyRenderingFiber = workInProgress// Function组件对应的fiber
  // 函数组件更新队列里存的effect
  workInProgress.updateQueue = null
  // 函数组件状态存的hooks链表
  workInProgress.memoizedState = null
  if (current !== null && current.memoizedState !== null) {
    ReactCurrentDispatcher.current = HooksDispatcherOnUpdate
  } else {
    ReactCurrentDispatcher.current = HooksDispatcherOnMount
  }
  // 需要函数组件执行前给ReactCurrentDispatcher.current赋值
  const children = Component(props)
  currentlyRenderingFiber = null
  workInProgress = null
  currentHook = null
  renderLanes = NoLanes
  return children
}