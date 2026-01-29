const express = require('express')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000
var cors = require('cors')
app.use(cors())

app.get('/', (req, res) => {
  res.send('Hello World from compete-x server')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
