import logger, { indent } from "shared/logger";
import { HostComponent, HostRoot, HostText, FunctionComponent } from "./ReactWorkTags";
import { prepareUpdate } from 'react-dom-bindings/src/client/ReactDOMHostConfig'
import {
  createTextInstance,
  createInstance,
  appendInitialChild,
  finalizeInitialChildren,
} from 'react-dom-bindings/src/client/ReactDOMHostConfig'
import { NoFlags, Update, Ref } from "./ReactFiberFlags";
import { NoLanes, mergeLanes } from './ReactFiberLane'

function markRef(workInProgress) {
  workInProgress.flags |= Ref
}

/**
 * 把当前的完成的fiber所有的子节点对应的真实DOM都挂载到自己父parent真是DOM节点上
 * @param {*} parent 当前完成的fiber真是的DOM节点
 * @param {*} workInProgress 完成的fiber
 * @returns 
 */
function appendAllChildren(parent, workInProgress) {
  let node = workInProgress.child
  while (node) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node.stateNode)
      // 如果第一个儿子不是一个原生节点，则可能是个函数组件
    } else if (node.child !== null) {
      node = node.child
      continue
    }
    if (node === workInProgress) {
      return
    }
    // 如果当前的节点没有弟弟
    while (node.sibling === null) {
      if (node.return === workInProgress) {
        return
      }
      // 回到父节点
      node = node.return
    }
    node = node.sibling
  }
}
function markUpdate(workInProgress) {
  workInProgress.flags |= Update// 给当前fiber添加更新副作用ddd
}
/**
 * 更新DOM
 * @param {*} current 老fiber
 * @param {*} workInProgress 新fiber
 * @param {*} type 类型
 * @param {*} newProps 新属性
 */
function updateHostComponent(current, workInProgress, type, newProps) {
  const oldProps = current.memoizedProps
  const instance = workInProgress.stateNode
  // 比较新老属性，收集属性的差异
  const updatePayload = prepareUpdate(instance, type, oldProps, newProps)
  // 让原生组件的新fiber更新队列等于[]
  workInProgress.updateQueue = updatePayload
  if (updatePayload) {
    markUpdate(workInProgress)
  }
}
/**
 * 完成一个fiber节点
 * @param {*} current 
 * @param {*} workInProgress 
 */
export function completeWork(current, workInProgress) {
  const newProps = workInProgress.pendingProps
  switch (workInProgress.tag) {
    case HostRoot:
      bubbleProperties(workInProgress)
      break
    // 完成的是原生节点
    case HostComponent:
      const { type } = workInProgress
      // 如果老fiber存在，老fiber上有真实DOM节点,并且走节点更新
      if (current !== null && workInProgress.stateNode !== null) {
        updateHostComponent(current, workInProgress, type, newProps)
        if (current.ref !== workInProgress !== null) {
          markRef(workInProgress)
        }
      } else {
        const instance = createInstance(type, newProps, workInProgress)
        // 完成阶段将子节点转换成真实DOM添加到父节点
        appendAllChildren(instance, workInProgress)
        workInProgress.stateNode = instance
        finalizeInitialChildren(instance, type, newProps)
        if (workInProgress !== null) {
          markRef(workInProgress)
        }
      }
      bubbleProperties(workInProgress)
      break
    case FunctionComponent:
      bubbleProperties(workInProgress)
      break
    case HostText:
      // 如果完成的的fiber是文本，那么就创建真实的文本节点
      const newText = newProps
      // 创建真实的DOM节点并传给fiber的stateNode
      workInProgress.stateNode = createTextInstance(newText)
      // 向上冒泡属性
      bubbleProperties(workInProgress)
      break
  }
}

function bubbleProperties(completedWork) {
  let newChildLanes = NoLanes
  let subtreeFlags = NoFlags
  // 遍历当前fiber的所有子节点，把副作用合并
  let child = completedWork.child
  while (child !== null) {
    newChildLanes = mergeLanes(newChildLanes, mergeLanes(child.lanes, child.childLanes))
    subtreeFlags |= child.subtreeFlags
    subtreeFlags |= child.flags
    child = child.sibling
  }
  completedWork.childLanes = newChildLanes
  completedWork.subtreeFlags = subtreeFlags
}