import { REACT_ELEMENT_TYPE } from "shared/ReactSymbol"
import { createFiberFromElement, createFiberFromText, createWorkInProgress } from './ReactFiber'
import { ChildDeletion, Placement } from "./ReactFiberFlags";
import isArray from 'shared/isArray'
import { HostText } from "./ReactWorkTags";
/**
 * 
 * @param {*} shouldTrackSideEffects 是否跟踪副作用
 */
function createChildReconciler(shouldTrackSideEffects) {
  function useFiber(fiber, pendingProps) {
    const clone = createWorkInProgress(fiber, pendingProps)
    clone.index = 0
    clone.sibling = null
    return clone
  }

  function deleteChild(returnFiber, childToDelete) {
    if (!shouldTrackSideEffects) {
      return
    }
    const deletions = returnFiber.deletions
    if (deletions === null) {
      returnFiber.deletions = [childToDelete]
      returnFiber.flags |= ChildDeletion
    } else {
      returnFiber.deletions.push(childToDelete)
    }
  }
  // 删除从currentFirstChild之后所有的fiber节点
  function deleteRemainingChildren(returnFiber, currentFirstChild) {
    if (!shouldTrackSideEffects) {
      return
    }
    let childToDelete = currentFirstChild
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete)
      childToDelete = childToDelete.sibling
    }
    return null
  }
  /**
   * 
   * @param {*} returnFiber 根fiber div#root对应的fiber
   * @param {*} currentFirstChild 老的FunctionComponent对应的fiber
   * @param {*} element 新的虚拟DOM 对象
   * @returns 返回新的第一个子fiber
   */
  function reconcileSingleElement(returnFiber, currentFirstChild, element) {
    const key = element.key
    let child = currentFirstChild
    while (child !== null) {
      if (child.key === key) {
        if (child.type === element.type) {
          deleteRemainingChildren(returnFiber, child.sibling)
          // 如果key一样，类型也一样，则认为此节点可以复用
          const existing = useFiber(child, element.props)
          existing.ref = element.ref
          existing.return = returnFiber
          return existing
        } else {
          // 如果找到key一样的老fiber但是类型不一样，一样删掉
          deleteRemainingChildren(returnFiber, child)
        }
      } else {
        deleteChild(returnFiber, child)
      }
      child = child.sibling
    }
    const created = createFiberFromElement(element);
    created.ref = element.ref
    created.return = returnFiber
    return created
  }
  /**
   * 设置副作用
   * @param {*} newFiber 
   * @param {*} newIndex 
   */
  function placeSingleChild(newFiber) {
    // 说明要添加副作用
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      // 要在最后的提交阶段插入此节点
      newFiber.flags |= Placement
    }
    return newFiber
  }

  function createChild(returnFiber, newChild) {
    if ((typeof newChild === 'string' && newChild !== "") || typeof newChild === 'number') {
      const created = createFiberFromText(`${newChild}`)
      created.return = returnFiber
      return created
    }
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(newChild)
          created.ref = newChild.ref
          created.return = returnFiber
          return created
        }
        default:
          break
      }
    }
    return null
  }
  function placeChild(newFiber, lastPlacedIndex, newIndex) {
    // 指定新的fiber在新的挂载索引
    newFiber.index = newIndex
    // 如果不需要跟踪副作用
    if (!shouldTrackSideEffects) {
      return lastPlacedIndex
    }
    const current = newFiber.alternate
    if (current !== null) {
      const oldIndex = current.index
      // 如果找到的老fiber索引比lastPlacedIndex小，则老Fiber对应DOM节点需要移动
      if (oldIndex < lastPlacedIndex) {
        newFiber.flags |= Placement
        return lastPlacedIndex
      } else {
        return oldIndex
      }
    } else {// 如果没有，说明是新节点
      newFiber.flags |= Placement
      return lastPlacedIndex
    }
  }
  function updateElement(returnFiber, current, element) {
    const elementType = element.type
    if (current !== null) {
      // 是否类型一样
      if (current.type === elementType) {
        const existing = useFiber(current, element.props)
        existing.ref = element.ref
        existing.return = returnFiber
        return existing
      }
    }
    const created = createFiberFromElement(element)
    created.ref = element.ref
    created.return = returnFiber
    return created
  }
  function updateSlot(returnFiber, oldFiber, newChild) {
    const key = oldFiber !== null ? oldFiber.key : null
    if (newChild !== null && typeof newChild === 'object') {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          // 如果key一样，进入更新逻辑
          if (newChild.key === key) {
            return updateElement(returnFiber, oldFiber, newChild)
          }
        }
        default:
          return null
      }
    }
    return null
  }
  function mapRemainingChildren(returnFiber, currentFirstChild) {
    const existingChildren = new Map()
    let existingChild = currentFirstChild
    while (existingChild != null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild)
      } else {
        existingChildren.set(existingChild.index, existingChild)
      }
      existingChild = existingChild.sibling
    }
    return existingChildren
  }
  function updateTextNode(returnFiber, current, textContent) {
    if (current === null || current.tag !== HostText) {
      const created = createFiberFromText(textContent)
      created.return = returnFiber
      return created
    } else {
      const existing = useFiber(current, textContent)
      existing.return = returnFiber
      return existing
    }
  }
  function updateFromMap(existingChildren, returnFiber, newIdx, newChild) {
    if ((typeof newChild === 'string' && newChild !== "") || typeof newChild === 'number') {
      const matchedFiber = existingChildren.get(newIdx) || null
      return updateTextNode(returnFiber, matchedFiber, "" + newChild)
    }
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber = existingChildren.get(newChild.key === null ?
            newIdx : newChild.key) || null
          return updateElement(returnFiber, matchedFiber, newChild)
        }
      }
    }
  }
  function reconcileChildrenArray(returnFiber, currentFirstFiber, newChildren) {
    let resultingFirstChild = null //返回的第一个新儿子
    let previousNewFiber = null // 上一个新fiber
    let newIndex = 0 //用来遍历新的虚拟DOM索引
    let oldFiber = currentFirstFiber // 第一个老fiber
    let nextOldFiber = null // 下一个fiber
    let lastPlacedIndex = 0 // 上一个不需要移动的节点索引
    for (; oldFiber !== null && newIndex < newChildren.length; newIndex++) {
      // 先暂存下一个老fiber
      nextOldFiber = oldFiber.sibling
      // 试图更新或者试图复用老的fiber
      const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIndex])
      if (newFiber === null) {
        break
      }
      if (shouldTrackSideEffects) {
        // 如果有老fiber，但是新的fiber并没有成功复用老fiber和老的真实DOM
        if (oldFiber && newFiber.alternate === null) {
          deleteChild(returnFiber, oldFiber)
        }
      }
      // 指定新fiber的位置
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex)
      if (previousNewFiber === null) {
        // previousNewFiber为null
        resultingFirstChild = newFiber
      } else {
        previousNewFiber.sibling = newFiber
      }
      previousNewFiber = newFiber
      oldFiber = nextOldFiber
    }
    // 新的虚拟DOM已经循环完毕
    if (newIndex === newChildren.length) {
      // 删除剩下的老Fiber
      deleteRemainingChildren(returnFiber, oldFiber)
      return resultingFirstChild
    }
    if (oldFiber === null) {
      for (; newIndex < newChildren.length; newIndex++) {
        const newFiber = createChild(returnFiber, newChildren[newIndex])
        if (newFiber === null) continue
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex)
        // previous为null，说明这是第一个fiber
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber // 这个fiber就是大儿子
        } else {// 否则说明这个不是大儿子，把newFiber添加到上一个子节点的后面
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
    }
    // 开始处理移动的情况
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber)
    // 遍历剩下的虚拟DOM
    for (; newIndex < newChildren.length; newIndex++) {
      const newFiber = updateFromMap(existingChildren, returnFiber, newIndex, newChildren[newIndex])
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          // 如果要跟踪副作用，并且有老fiber
          if (newFiber.alternate !== null) {
            existingChildren.delete(newFiber.key === null ? newIndex : newFiber.key)
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex)
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber // 这个fiber就是大儿子
        } else {// 否则说明这个不是大儿子，把newFiber添加到上一个子节点的后面
          previousNewFiber.sibling = newFiber
        }
        // 让newFiber成为最后一个
        previousNewFiber = newFiber
      }
    }
    if (shouldTrackSideEffects) {
      // 等全部处理完后，删除map中所有剩下的老fiber
      existingChildren.forEach(child => deleteChild(returnFiber, child))
    }
    return resultingFirstChild
  }
  /**
   * 比较子fibers DOM-DIFF 用老的子fiber链表和新的虚拟DOM进行比较的过程
   * @param {*} returnFiber 新的父fiber
   * @param {*} currentFirstFiber current一般指的是老的
   * @param {*} newChild 新的子虚拟DOM
   */
  function reconcileChildFibers(returnFiber, currentFirstChild, newChild) {
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(reconcileSingleElement(returnFiber, currentFirstChild, newChild))
        default:
          break
      }
    }
    if (isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild)
    }
    return null
  }
  return reconcileChildFibers
}

export const mountChildFibers = createChildReconciler(false)
export const reconcileChildFibers = createChildReconciler(true)