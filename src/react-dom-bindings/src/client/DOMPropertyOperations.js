
export function setValueForProperty(node, name, value) {
  if (value === null) {
    node.removeAttribute(name)
  }
  if (name in node) {
    node[name] = value;
  } else if (node.hasAttribute(name)) {
    node.removeAttribute(name);
  }
}