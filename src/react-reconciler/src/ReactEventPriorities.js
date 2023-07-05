import {
  DefaultLane,
  IdleLane,
  InputContinuousLane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  includesNonIdleWork,
  // isHigherEventPriority
} from "./ReactFiberLane";

// 默认事件车道
export const DefaultEventPriority = DefaultLane
// 离散事件优先级
export const DiscreteEventPriority = SyncLane
// 连续事件的优先级
export const ContinuousEventPriority = InputContinuousLane
// 空闲事件优先级
export const IdleEventPriority = IdleLane

let currentUpdatePriority = NoLane
export function getCurrentUpdatePriority() {
  return currentUpdatePriority
}

export function setCurrentUpdatePriority(newPriority) {
  currentUpdatePriority = newPriority
}

/**
 * 判斷eventPriority 是否比
 * @param { } eventPriority 
 * @param {*} lane 
 * @returns 
 */
export function isHigherEventPriority(eventPriority, lane) {
  return (eventPriority !== 0) && eventPriority < lane
}

/**
 * 把lane转成事件优先级
 * lane 31个
 * 事件优先级 4个
 * 调度优先级 5个
 * @param {*} lanes 
 * @returns 
 */
export function lanesToEventPriority(lanes) {
  let lane = getHighestPriorityLane(lanes)
  if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
    return DiscreteEventPriority
  }
  if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
    return ContinuousEventPriority
  }
  if (includesNonIdleWork(lane)) {
    return DefaultEventPriority
  }
  return IdleEventPriority
}