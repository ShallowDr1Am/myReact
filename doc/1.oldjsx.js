const babel = require('@babel/core')
const sourceCode = `
let element = (
  <h1>
    heloo<span>word</span>
  </h1>
)
`
const result = babel.transform(sourceCode, {
  plugins: [
    ["@babel/plugin-transform-react-jsx", { runtime: 'classic' }]
  ]
})
React.createElement("h1", null, "hello", React.createElement("span", {
  style: {
    color: "red"
  }
}, "world"))