
import { createFiberRoot } from './ReactFiberRoot'
import { createUpdate, enqueueUpdate } from './ReactFiberClassUpdateQueue'
import { scheduleUpdateOnFiber, requestUpdateLane, requestEventTime } from './ReactFiberWorkLoop'
//创建容器
export function createContainer(containerInfo) {
  return createFiberRoot(containerInfo);
}

/**
 * 更新容器，把虚拟dom element变成真实DOM插入到container容器中
 * @param {*} element  虚拟DOM
 * @param {*} container   DOM容器，FiberRootNode containerInfo div#root
 */
export function updateContainer(element, container) {
  const current = container.current //根fiber
  const eventTime = requestEventTime()
  // 请求一个更新车道
  const lane = requestUpdateLane(current)
  // 创建更新
  const update = createUpdate(lane)
  // 要更新的虚拟DOM
  update.payload = { element }
  // 把此更新对象添加到current这个根Fiber的更新队列上
  debugger
  const root = enqueueUpdate(current, update, lane, eventTime)
  // 返回根节点
  scheduleUpdateOnFiber(root, current, lane, eventTime)
}
