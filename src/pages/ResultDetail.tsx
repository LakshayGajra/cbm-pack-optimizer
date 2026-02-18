import { useParams } from 'react-router-dom'

export function ResultDetail() {
  const { id } = useParams()
  return (
    <div>
      <h1>Result Detail</h1>
      <p>ID: {id}</p>
    </div>
  )
}
