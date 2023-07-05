import hasOwnProperty from 'shared/hasOwnProperty'
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbol'

const RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true,
}

function hasValidRef(config) {
  return config.ref !== undefined
}

function ReactElement(type, key, ref, props) {
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
  }
}

// 17以前的转换函数中key是放在config中的
// 17之后新版的转换函数中key是放在第三个参数中的，children是放在config里的
export function jsxDEV(type, config, maybeKey) {
  let propName //属性名
  const props = {} //属性对象
  let key = null //每个虚拟DOM可以有一个可选的key属性，用来区分一个父节点下的不同子节点
  let ref = null //引入，后面可以获取真实DOM的需求
  if (typeof maybeKey !== 'undefined') {
    key = maybeKey
  }
  if (hasValidRef(config)) {
    ref = config.ref
  }
  for (propName in config) {
    if (hasOwnProperty.call(config, propName)
      && !RESERVED_PROPS.hasOwnProperty(propName)) {
      props[propName] = config[propName]
    }
  }
  return ReactElement(type, key, ref, props)
}