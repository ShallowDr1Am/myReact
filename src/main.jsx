import * as React from 'react'
import { createRoot } from 'react-dom/client'
// debugger

let counter = 0
let timer
let bCounter = 0
let cCounter = 0
function FunctionComponent() {
  const [number, setNumber] = React.useState(new Array(10).fill('A'))
  const divRef = React.useRef()
  const updateB = (numbers) => new Array(10).fill(numbers[0] + 'B')
  updateB.id = 'updateB' + (bCounter++)
  const updateC = (numbers) => new Array(10).fill(numbers[0] + 'C')
  updateC.id = 'updateC' + (cCounter++)
  React.useEffect(() => {
    // console.log('123')
    // timer = setInterval(() => {
    //   divRef.current.click() // 1
    //   if (counter++ === 0) {
    //     setNumber(updateB) // 16
    //   }
    //   divRef.current.click()
    //   if (counter++ > 10) {
    //     clearInterval(timer)
    //   }
    // }, 1)
    console.log('timer', timer)
  }, [])
  return (
    <button ref={divRef} onClick={() => {
      setNumber(updateC)
    }}>
      {number.map((number, index) => <span key={index}>{number}</span>)}
    </button>
  )
}
let element = <FunctionComponent />
const root = createRoot(document.getElementById('root'))
root.render(element)