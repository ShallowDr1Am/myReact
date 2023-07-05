import { HostComponent, HostRoot, HostText, IndeterminateComponent, FunctionComponent } from './ReactWorkTags'
import { processUpdateQueue, cloneUpdateQueue } from './ReactFiberClassUpdateQueue'
import { mountChildFibers, reconcileChildFibers } from './ReactChildFiber'
import { shouldSetTextContent } from 'react-dom-bindings/src/client/ReactDOMHostConfig'
import { renderWithHooks } from './ReactFiberHooks'
import { NoLane, NoLanes } from './ReactFiberLane'
/**
 * 
 * @param {*} current 老的父Fiber
 * @param {*} workInProgress 新的fiber
 * @param {*} nextChildren 新的子虚拟DOM
 */
function reconcileChildren(current, workInProgress, nextChildren) {
  // 如果此新fiber没有老fiber，说明此新fiber是创建的
  if (current === null) {
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren)
  } else {
    // 如果没有老fiber的话，做dom-diff，拿老的子fiber链表和新的子虚拟DOM进行比较，进行最小化的更新
    workInProgress.child = reconcileChildFibers(workInProgress, current.child, nextChildren)
  }
}

function updateHostRoot(current, workInProgress, renderLanes) {
  const nextProps = workInProgress.pendingProps
  cloneUpdateQueue(current, workInProgress)
  //需要知道它的子虚拟DOM,知道它的儿子的虚拟DOM信息
  processUpdateQueue(workInProgress, nextProps, renderLanes);//workInprogress.memoizedState={element}
  const nextState = workInProgress.memoizedState
  // nextchildren 新的子虚拟DOM
  const nextChildren = nextState.element
  // 协调子节点 DOM-DIFF
  // 根据新的虚拟DOM生成子Fiber链表
  reconcileChildren(current, workInProgress, nextChildren)
  return workInProgress.child
}

/**
 * 构建原生组件的子fiber链表
 * @param {*} current 
 * @param {*} workInProgress 
 */
function updateHostComponent(current, workInProgress) {
  const { type } = workInProgress
  const nextProps = workInProgress.pendingProps
  const nextChildren = nextProps.children
  // 判断当前虚拟DOM它的儿子是不是文本的独生子
  const isDirectTextChild = shouldSetTextContent(type, nextProps)
  if (isDirectTextChild) {
    nextChildren = null
  }
  reconcileChildren(current, workInProgress, nextChildren)
  return workInProgress.child
}

/**
 * 挂载函数组件
 * @param {*} current  old fiber
 * @param {*} workInProgress new fiber
 * @param {*} Component 组件类型
 */
export function mountIndeterminateComponent(current, workInProgress, Component) {
  const props = workInProgress.pendingProps
  // const value = Component(props)
  const value = renderWithHooks(current, workInProgress, Component, props)
  workInProgress.tag = FunctionComponent
  reconcileChildren(current, workInProgress, value)
  return workInProgress.child
}

export function updateFunctionComponent(current, workInProgress, Component, nextProps, renderLanes) {
  const nextChildren = renderWithHooks(current, workInProgress, Component, nextProps, renderLanes)
  reconcileChildren(current, workInProgress, nextChildren)
  return workInProgress.child
}
/**
 * 目标是根据虚拟DOM构建新的fiber链表
 * @param {*} current 老fiber
 * @param {*} workInProgress  新fiber
 * @returns 
 */
export function beginWork(current, workInProgress, renderLanes) {
  // 构建fiber树之前清空lanes
  workInProgress.lanes = 0
  switch (workInProgress.tag) {
    // 在react组件有两种，一种是函数组件，一种是类组件，他们都是函数
    case IndeterminateComponent:
      return mountIndeterminateComponent(current, workInProgress, workInProgress.type, renderLanes)
    case FunctionComponent: {
      const Component = workInProgress.type
      const nextProps = workInProgress.pendingProps
      return updateFunctionComponent(current, workInProgress, Component, nextProps, renderLanes)
    }
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes)
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes)
    case HostText:
      return null
    default:
      return null
  }
}