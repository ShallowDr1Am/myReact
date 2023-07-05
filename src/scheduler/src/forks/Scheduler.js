import { push, pop, peek } from './SchedulerMinHeap'
import {
  ImmediatePriority,
  UserBlockingPriority,
  IdlePriority,
  LowPriority,
  NormalPriority,
} from './SchedulerPriorities'

var maxSigned31BitInt = 1073741823;

// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
var USER_BLOCKING_PRIORITY_TIMEOUT = 250;
// 正常优先级的过期时间
var NORMAL_PRIORITY_TIMEOUT = 5000;
// 低优先级的过期时间
var LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

let scheduleHostCallback = null
let startTime = null
// 每帧工作5ms
const frameInterval = 5

const channel = new MessageChannel()
var port2 = channel.port2
var port1 = channel.port1
port1.onmessage = performWorkUntilDeadline

// Tasks are stored on a min heap
var taskQueue = [];
var timerQueue = [];

// Incrementing id counter. Used to maintain insertion order.
var taskIdCounter = 1;

// Pausing the scheduler is useful for debugging.
var isSchedulerPaused = false;

var currentTask = null;
var currentPriorityLevel = NormalPriority;

// This is set while performing work, to prevent re-entrance.
var isPerformingWork = false;

var isHostCallbackScheduled = false;
var isHostTimeoutScheduled = false;

function getCurrentTime() {
  return performance.now()
}

/**
 * 
 * 按优先级执行任务
 * @param {*} priorityLevel 
 * @param {*} callback 
 */
function scheduleCallback(priorityLevel, callback) {
  // 获取当前的时间
  const currentTime = getCurrentTime()
  // 此任务的开始时间
  const startTime = currentTime
  let timeout
  // 根据优先级计算过期的时间
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;
      break;
    case NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT;
      break;
  }
  // 计算此任务的过期时间
  const expirationTime = startTime + timeout
  const newTask = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: expirationTime, // 排序依据
  }
  // 向任务最小堆里添加任务，排序的依据是过期时间
  push(taskQueue, newTask)
  // flushwork执行工作，刷新工作，执行任务
  requestHostCallback(workLoop)
  return newTask
}

function shouldYieldToHost() {
  // 用当前时间减去开始的时间就是过去的时间
  const timeElapsed = getCurrentTime() - startTime
  if (timeElapsed < frameInterval) {
    return false
  }
  return true
}

function workLoop(startTime) {
  let currentTime = startTime
  // 取出优先级最高的任务
  currentTask = peek(taskQueue)
  while (currentTask !== null) {
    // 如果此任务过期时间小于当前时间
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break
    }
    // 取出当前的任务重的回调函数
    const callback = currentTask.callback
    if (typeof callback === 'function') {
      currentTask.callback = null
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime
      const continuationCallback = callback(didUserCallbackTimeout)
      if (typeof continuationCallback === 'function') {
        currentTask.callback = continuationCallback
        return true
      }
      // 如果此任务已经完成,则不需要继续执行
      if (currentTask === peek(taskQueue)) {
        pop(taskQueue)
      }
    } else {
      pop(taskQueue)
    }
    currentTask = peek(taskQueue)
  }
  if (currentTask !== null) {
    return true
  } else {
    return false
  }
}
function requestHostCallback(flushWork) {
  // 先缓存回调函数
  scheduleHostCallback = flushWork
  // 执行工作直到截止时间
  schedulePerformWorkUntilDeadline()
}
function schedulePerformWorkUntilDeadline() {
  port2.postMessage(null)
}
function performWorkUntilDeadline() {
  if (scheduleHostCallback) {
    // 先获取开始执行任务的时间
    startTime = getCurrentTime()
    // 是否有更多的工作
    let hasMoreWork = true
    try {
      // 执行flushwork,并判断有没有返回值
      hasMoreWork = scheduleHostCallback(startTime)
    } finally {
      // 执行完后为true,说明还有更多工作要做
      if (hasMoreWork) {
        // 调度一个新的
        schedulePerformWorkUntilDeadline()
      } else {
        scheduleHostCallback = null
      }
    }
  }
}
function unstable_cancelCallback(task) {
  task.callback = null
}
export {
  scheduleCallback as unstable_scheduleCallback,
  shouldYieldToHost as unstable_shouldYield,
  NormalPriority as unstable_NormalPriority,
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  LowPriority as unstable_LowPriority,
  IdlePriority as unstable_IdlePriority,
  unstable_cancelCallback,
  getCurrentTime as now,
}

// // 开始任务队列中的任务
// function flushWork(startTime) {
//   return workLoop(startTime)
// }
