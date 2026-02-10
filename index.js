const express = require('express')
require('dotenv').config()
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const cors = require('cors')



// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.egyokrx.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    const db = client.db('competexDB');
    const userCollections = db.collection('user');
    const contestCollections = db.collection('contest');




    // Users Api

    app.get('/users', async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const userInfo = req.body;
      userInfo.createdAt = new Date();

      const email = userInfo.email;
      const uesrExisted = await userCollections.findOne({ email })


      if (uesrExisted) {
        return res.send({ message: "User already existed" })
      }
      const result = await userCollections.insertOne(userInfo);
      res.send(result);
    })




    // Contest Related API


    app.get('/all-contests', async (req, res) => {
      const result = await contestCollections.find().toArray();
      res.send(result);
    })
    app.get('/top-contests', async (req, res) => {
      const result = await contestCollections.find().sort({ participantCount: -1 }).limit(3).toArray();
      res.send(result);
    })


    app.get('/contest/:id', async (req, res) => {
      const id = req.params.id;
      const cursor = { _id: new ObjectId(id) };
      const result = await contestCollections.findOne(cursor);
      res.send(result)
    })

    app.post('/contest', async (req, res) => {
      const contestInfo = req.body;
      contestInfo.createdAt = new Date();
      const result = await contestCollections.insertOne(contestInfo)
      res.send(result);
    })


    // Search Contest

    app.get('/contests', async (req, res) => {
      const searchText = req.query.search;
      const query = {};
      if (searchText) {
        query.$or = [
          {
            name: { $regex: searchText, $options: 'i' }
          }
        ];
      }
      const result = await contestCollections.find(query).sort({ createdAt: -1 }).limit(3).toArray();
      res.send(result);
    })












    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World from compete-x server')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})




